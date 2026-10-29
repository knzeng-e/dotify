import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  StreamingEncryptor,
  decryptStreamingObject,
  parseStreamingManifest,
  verifyStreamingManifest,
  validateStreamingScope,
  type StreamingScope,
  type StreamingIdentity
} from './streamingFormat.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger, STREAM_NONCE_SCHEME } from './streamingNonces.js';
import { encodeStreamingRelease } from './streamingEncoder.js';
import type { EncodedStreamingAudio } from './streamingTranscoder.js';
import { PinataError, type PinataFile } from './pinata.js';
const MAX_JOBS = 64,
  MAX_QUEUED = 4,
  MAX_SOURCE_BYTES = 200 * 1024 * 1024,
  RETENTION_MS = 7 * 24 * 60 * 60_000;
const address = z.string().regex(/^0x[0-9a-f]{40}$/);
const scopeSchema = z
  .object({
    chainId: z.number().int().positive(),
    runtimeAddress: address,
    contentHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    keyVersion: z.string().regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
  })
  .strict();
type StreamingFailure = {
  stage: 'authority' | 'key' | 'encoding' | 'encryption' | 'validation' | 'storage' | 'persistence';
  storageStatus?: number;
};
const jobSchema = z
  .object({
    id: z.string().uuid(),
    owner: address,
    scope: scopeSchema,
    state: z.enum(['queued', 'encoding', 'encrypting', 'publishing', 'ready', 'failed', 'expired']),
    attempts: z.number().int().min(0).max(3),
    createdAt: z.number().int().positive(),
    updatedAt: z.number().int().positive(),
    sourceBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    sourceGeneration: z.string().regex(/^[0-9a-f]{16}$/),
    ref: z.string().max(256).optional(),
    reason: z.enum(['PREPARATION_FAILED', 'RETRY_LIMIT']).optional()
  })
  .strict();
export type StreamingJob = z.infer<typeof jobSchema>;
export type StreamingJobView = Pick<StreamingJob, 'id' | 'state' | 'attempts' | 'updatedAt' | 'reason'> & {
  failure?: StreamingFailure;
  result?: { ref: string; runtimeAddress: string; contentHash: string; keyVersion: string };
};
export class StreamingJobError extends Error {
  constructor(
    readonly code: string,
    readonly status = 503
  ) {
    super(code);
  }
}
async function syncDir(directory: string) {
  const file = await open(directory, 'r');
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
async function durableFile(file: string, bytes: Uint8Array) {
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await durableFile(temporary, Buffer.from(JSON.stringify(value)));
    await rename(temporary, file);
    await syncDir(path.dirname(file));
  } finally {
    await rm(temporary, { force: true });
  }
}
/** Explicit fresh-store provisioning only. Never recreate lost queue/nonce state. */
export async function initializeStreamingJobs(directory: string) {
  await mkdir(directory, { mode: 0o700 });
  await initializeStreamingNonceLedger(path.join(directory, 'nonces'));
  await mkdir(path.join(directory, 'jobs'), { mode: 0o700 });
  await mkdir(path.join(directory, 'incoming'), { mode: 0o700 });
  await durableFile(path.join(directory, 'jobs.json'), Buffer.from(JSON.stringify({ schema: 'dotify.streaming.jobs.v1', jobs: [] })));
  await syncDir(directory);
  await syncDir(path.dirname(directory));
}
export type StreamingJobDeps = {
  directory: string;
  deriveKey: (scope: StreamingScope) => Buffer | null;
  authority: (owner: string, runtime: string, chainId: number) => Promise<boolean>;
  transcode: (master: Buffer, signal?: AbortSignal) => Promise<EncodedStreamingAudio>;
  pin: (files: PinataFile[], name: string, signal: AbortSignal) => Promise<string>;
  /** Allowlisted diagnostics only. Never pass raw errors, source data or keys. */
  onFailure?: (failure: { jobId: string } & StreamingFailure) => void;
  now?: () => number;
};
export class StreamingJobs {
  private jobs: StreamingJob[] = [];
  // Diagnostics are not custody state: keep the on-disk v1 schema unchanged
  // so rollback never requires rewriting encrypted jobs or nonce reservations.
  private failures = new Map<string, StreamingFailure>();
  private serial: Promise<unknown> = Promise.resolve();
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private abort = new AbortController();
  private initialized = false;
  private failed = false;
  readonly ledger: StreamingNonceLedger;
  private now: () => number;
  constructor(private deps: StreamingJobDeps) {
    this.ledger = new StreamingNonceLedger(path.join(deps.directory, 'nonces'));
    this.now = deps.now ?? Date.now;
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.serial.then(work);
    this.serial = result.catch(() => undefined);
    return result;
  }
  private folder(id: string) {
    return path.join(this.deps.directory, 'jobs', id);
  }
  private async save() {
    try {
      await atomicJson(path.join(this.deps.directory, 'jobs.json'), { schema: 'dotify.streaming.jobs.v1', jobs: this.jobs });
    } catch (error) {
      this.failed = true;
      throw error;
    }
  }
  private available() {
    if (!this.initialized || this.failed) throw new StreamingJobError('STREAMING_STORAGE_UNAVAILABLE');
  }
  async start(background = true) {
    if (this.initialized) throw new Error('Streaming queue already started');
    const file = path.join(this.deps.directory, 'jobs.json');
    if ((await stat(file)).size > 256 * 1024) throw new Error('Streaming queue metadata exceeds budget');
    const data = z
      .object({ schema: z.literal('dotify.streaming.jobs.v1'), jobs: z.array(jobSchema).max(MAX_JOBS) })
      .strict()
      .parse(JSON.parse(await readFile(file, 'utf8')));
    const marker = JSON.parse(await readFile(path.join(this.deps.directory, 'nonces', 'ledger.json'), 'utf8'));
    if (marker.schema !== 'dotify.streaming.nonce-ledger.v1') throw new Error('Streaming nonce custody unavailable');
    this.jobs = data.jobs;
    if (new Set(this.jobs.map(job => job.id)).size !== this.jobs.length) throw new Error('Duplicate durable streaming jobs');
    // Admission commits an encrypted source + envelope by atomic directory
    // rename before updating the global index. Recover that specific gap.
    const incoming = path.join(this.deps.directory, 'incoming');
    const admissions = await readdir(incoming);
    if (admissions.length > MAX_QUEUED) throw new Error('Interrupted admission count exceeds budget');
    for (const id of admissions) {
      if (!z.string().uuid().safeParse(id).success) throw new Error('Unknown admission state');
      const folder = path.join(incoming, id);
      const info = await lstat(folder);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe admission directory');
      const names = await readdir(folder);
      if (names.length > 2) throw new Error('Unknown admission entries');
      for (const name of names) {
        const file = await lstat(path.join(folder, name));
        if (!['source.bin', 'job.json'].includes(name) || !file.isFile() || file.isSymbolicLink() || file.nlink !== 1)
          throw new Error('Unknown admission entry');
      }
      // This directory was never committed/acknowledged. Only its encrypted
      // temporary files are removed; permanent nonce custody is separate.
      await rm(folder, { recursive: true });
    }
    const names = await readdir(path.join(this.deps.directory, 'jobs'));
    if (names.length > MAX_JOBS) throw new Error('Streaming directory count exceeds budget');
    for (const id of names.filter(name => !this.jobs.some(job => job.id === name))) {
      if (!z.string().uuid().safeParse(id).success) throw new Error('Unknown streaming state');
      const file = path.join(this.folder(id), 'job.json');
      if ((await stat(file)).size > 8192) throw new Error('Admission envelope exceeds budget');
      const admitted = jobSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      if (admitted.id !== id || admitted.state !== 'queued' || admitted.attempts !== 0) throw new Error('Invalid committed admission');
      this.jobs.push(admitted);
    }
    if (this.jobs.length > MAX_JOBS) throw new Error('Recovered streaming queue exceeds budget');
    for (const job of this.jobs) {
      validateStreamingScope(job.scope);
      if (job.state === 'expired') {
        await rm(this.folder(job.id), { recursive: true, force: true });
        continue;
      }
      if (job.state === 'ready' && !job.ref) throw new Error('Completed streaming job has no publication reference');
      if (job.state === 'ready') await rm(this.folder(job.id), { recursive: true, force: true });
      if (job.state !== 'ready') {
        if ((await stat(path.join(this.folder(job.id), 'source.bin'))).size !== job.sourceBytes + 16) throw new Error('Streaming master custody unavailable');
        if (job.state !== 'failed') job.state = job.attempts >= 3 ? 'failed' : 'queued';
      } else if (!job.ref) throw new Error('Completed streaming job has no publication reference');
    }
    this.jobs = this.jobs.filter(job => job.state !== 'expired');
    const retained = this.jobs.filter(job => job.state !== 'ready');
    if (retained.length > MAX_QUEUED || retained.reduce((sum, job) => sum + job.sourceBytes, 0) > MAX_SOURCE_BYTES)
      throw new Error('Recovered streaming custody exceeds admission budget');
    this.initialized = true;
    await this.save();
    if (background) {
      this.timer = setInterval(() => {
        void this.runNext().catch(() => {
          this.failed = true;
        });
      }, 1000);
      this.timer.unref();
    }
  }
  private view(job: StreamingJob): StreamingJobView {
    return {
      id: job.id,
      state: job.state,
      attempts: job.attempts,
      updatedAt: job.updatedAt,
      ...(job.reason ? { reason: job.reason } : {}),
      ...(job.state === 'failed' && this.failures.has(job.id) ? { failure: this.failures.get(job.id) } : {}),
      ...(job.state === 'ready' && job.ref
        ? { result: { ref: job.ref, runtimeAddress: job.scope.runtimeAddress, contentHash: job.scope.contentHash, keyVersion: job.scope.keyVersion } }
        : {})
    };
  }
  get(id: string, owner: string, chainId: number): StreamingJobView | null {
    this.available();
    const job = this.jobs.find(j => j.state !== 'expired' && j.id === id && j.owner === owner.toLowerCase() && j.scope.chainId === chainId);
    return job ? this.view(job) : null;
  }
  async enqueue(input: { owner: string; scope: StreamingScope; master: Buffer }): Promise<StreamingJobView> {
    return this.exclusive(async () => {
      this.available();
      validateStreamingScope(input.scope);
      const owner = address.parse(input.owner.toLowerCase());
      await this.prune();
      for (const ready of this.jobs.filter(job => job.state === 'ready')) await rm(this.folder(ready.id), { recursive: true, force: true });
      const existing = this.jobs.find(
        j =>
          j.owner === owner &&
          j.scope.chainId === input.scope.chainId &&
          j.scope.runtimeAddress === input.scope.runtimeAddress &&
          j.scope.contentHash === input.scope.contentHash &&
          j.scope.keyVersion === input.scope.keyVersion
      );
      if (existing) {
        if (existing.state === 'failed') return this.retryExisting(existing);
        return this.view(existing);
      }
      const active = this.jobs.filter(j => j.state !== 'ready');
      if (this.jobs.length >= MAX_JOBS || active.length >= MAX_QUEUED || active.reduce((n, j) => n + j.sourceBytes, 0) + input.master.length > MAX_SOURCE_BYTES)
        throw new StreamingJobError('STREAMING_QUEUE_BUSY', 429);
      if (!input.master.length || input.master.length > 50 * 1024 * 1024) throw new StreamingJobError('STREAMING_AUDIO_TOO_LARGE', 413);
      const key = this.deps.deriveKey(input.scope);
      if (!key) throw new StreamingJobError('CONTENT_KEY_NOT_CONFIGURED');
      const id = randomUUID();
      try {
        const reservation = await this.ledger.reserve(key);
        const encryptor = new StreamingEncryptor(key, reservation, input.scope);
        const source = encryptor.object(input.master, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
        const now = this.now();
        const job: StreamingJob = {
          id,
          owner,
          scope: { ...input.scope },
          state: 'queued',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          sourceBytes: input.master.length,
          sourceGeneration: encryptor.identity.generation
        };
        const staging = path.join(this.deps.directory, 'incoming', id);
        await mkdir(staging, { mode: 0o700 });
        await durableFile(path.join(staging, 'source.bin'), source.bytes);
        await durableFile(path.join(staging, 'job.json'), Buffer.from(JSON.stringify(job)));
        await syncDir(staging);
        await rename(staging, this.folder(id));
        await syncDir(path.join(this.deps.directory, 'incoming'));
        await syncDir(path.join(this.deps.directory, 'jobs'));
        this.jobs.push(job);
        await this.save();
        return this.view(job);
      } finally {
        key.fill(0);
      }
    });
  }
  private async retryExisting(job: StreamingJob): Promise<StreamingJobView> {
    if (job.attempts >= 3) throw new StreamingJobError('STREAMING_RETRY_LIMIT', 409);
    if (this.jobs.filter(j => !['ready', 'failed'].includes(j.state)).length >= MAX_QUEUED) throw new StreamingJobError('STREAMING_QUEUE_BUSY', 429);
    job.state = 'queued';
    delete job.reason;
    this.failures.delete(job.id);
    job.updatedAt = this.now();
    await this.save();
    return this.view(job);
  }
  async retry(id: string, owner: string, chainId: number) {
    return this.exclusive(async () => {
      this.available();
      const job = this.jobs.find(j => j.state !== 'expired' && j.id === id && j.owner === owner.toLowerCase() && j.scope.chainId === chainId);
      if (!job) throw new StreamingJobError('STREAMING_JOB_NOT_FOUND', 404);
      return job.state === 'failed' ? this.retryExisting(job) : this.view(job);
    });
  }
  async discard(id: string, owner: string, chainId: number) {
    await this.exclusive(async () => {
      this.available();
      const job = this.jobs.find(j => j.id === id && j.owner === owner.toLowerCase() && j.scope.chainId === chainId && j.state !== 'expired');
      if (!job) throw new StreamingJobError('STREAMING_JOB_NOT_FOUND', 404);
      if (job.state !== 'failed') throw new StreamingJobError('STREAMING_JOB_ACTIVE', 409);
      job.state = 'expired';
      this.failures.delete(job.id);
      await this.save();
      await rm(this.folder(id), { recursive: true, force: true });
      this.jobs = this.jobs.filter(j => j !== job);
      await this.save();
    });
  }
  private async prune() {
    const old = this.jobs.filter(j => ['failed', 'ready'].includes(j.state) && j.updatedAt < this.now() - RETENTION_MS);
    // Persist tombstones before deleting files. A crash at any deletion point
    // is completed on startup without losing nonce reservations or admitting
    // a metadata entry whose encrypted source has disappeared.
    if (!old.length) return;
    for (const job of old) {
      job.state = 'expired';
      this.failures.delete(job.id);
    }
    await this.save();
    for (const job of old) await rm(this.folder(job.id), { recursive: true, force: true });
    this.jobs = this.jobs.filter(job => !old.includes(job));
    await this.save();
  }

  async runNext(): Promise<void> {
    if (this.running) return this.running;
    this.available();
    if (this.abort.signal.aborted) return;
    this.running = this.execute().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async phase(job: StreamingJob, state: StreamingJob['state']) {
    await this.exclusive(async () => {
      job.state = state;
      job.updatedAt = this.now();
      await this.save();
    });
  }
  private async execute() {
    const job = await this.exclusive(async () => {
      await this.prune();
      const next = this.jobs.find(j => j.state === 'queued');
      if (!next) return null;
      next.attempts++;
      next.state = 'encoding';
      next.updatedAt = this.now();
      await this.save();
      return next;
    });
    if (!job) return;
    const signal = this.abort.signal;
    let stage: StreamingFailure['stage'] = 'authority';
    let key: Buffer | null = null,
      master: Buffer | undefined;
    try {
      if (!(await this.deps.authority(job.owner, job.scope.runtimeAddress, job.scope.chainId))) throw new Error('Artist authority changed');
      stage = 'key';
      key = this.deps.deriveKey(job.scope);
      if (!key) throw new Error('Release key unavailable');
      stage = 'validation';
      const output = path.join(this.folder(job.id), 'output');
      let manifest;
      try {
        manifest = parseStreamingManifest(await readFile(path.join(output, 'manifest.json')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (!manifest) {
        const identity: StreamingIdentity = {
          ...job.scope,
          schema: 'dotify.audio.v3' as const,
          version: 1 as const,
          nonceScheme: STREAM_NONCE_SCHEME,
          generation: job.sourceGeneration
        };
        master = decryptStreamingObject(await readFile(path.join(this.folder(job.id), 'source.bin')), key, identity, {
          rendition: 'archive',
          kind: 'master',
          index: 0,
          path: 'archive/master.bin',
          counter: 0,
          plainLength: job.sourceBytes,
          encryptedLength: job.sourceBytes + 16
        });
        stage = 'encoding';
        const encoded = await encodeStreamingRelease({
          master,
          key,
          scope: job.scope,
          ledger: this.ledger,
          signal,
          transcode: async (bytes, cancel) => {
            const result = await this.deps.transcode(bytes, cancel);
            stage = 'encryption';
            await this.phase(job, 'encrypting');
            return result;
          }
        });
        await rm(output, { recursive: true, force: true });
        await mkdir(output, { mode: 0o700 });
        // manifest.json is the last durable marker: retries reuse only a complete result.
        for (const file of encoded.files.filter(file => file.name !== 'manifest.json')) {
          const target = path.join(output, file.name);
          await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await durableFile(target, file.bytes);
          await syncDir(path.dirname(target));
        }
        await syncDir(output);
        await atomicJson(path.join(output, 'manifest.json'), encoded.manifest);
        await syncDir(output);
        await syncDir(this.folder(job.id));
        manifest = encoded.manifest;
      }
      stage = 'validation';
      verifyStreamingManifest(manifest, key, job.scope);
      stage = 'authority';
      if (!(await this.deps.authority(job.owner, job.scope.runtimeAddress, job.scope.chainId))) throw new Error('Artist authority changed before publication');
      await this.phase(job, 'publishing');
      stage = 'validation';
      const objects = [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])];
      const files: PinataFile[] = [];
      for (const object of objects) {
        const file = path.join(output, object.path);
        if ((await stat(file)).size !== object.encryptedLength) throw new Error('Incomplete encrypted object');
        const bytes = await readFile(file);
        // A corrupted persisted output must not become a published release.
        decryptStreamingObject(bytes, key, manifest, object).fill(0);
        files.push({ path: object.path, bytes });
      }
      files.push({ path: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
      const publishSignal = AbortSignal.any([signal, AbortSignal.timeout(5 * 60_000)]);
      stage = 'storage';
      const cid = await this.deps.pin(files, `stream-${job.id}`, publishSignal);
      publishSignal.throwIfAborted();
      if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110})$/.test(cid)) throw new Error('Invalid storage directory');
      stage = 'persistence';
      const version = job.scope.keyVersion.replace('dotify-content-', '');
      await this.exclusive(async () => {
        job.ref = `dotify:enc:v3:${version}:ipfs://${cid}`;
        job.state = 'ready';
        job.updatedAt = this.now();
        delete job.reason;
        this.failures.delete(job.id);
        await this.save();
      });
      // Ready metadata was committed first. A crash here is cleaned on restart.
      // Nonce reservations are never removed with job files.
      await rm(this.folder(job.id), { recursive: true, force: true }).catch(() => undefined);
    } catch (error) {
      const failure = { stage, ...(error instanceof PinataError && error.providerStatus ? { storageStatus: error.providerStatus } : {}) };
      if (!signal.aborted) this.deps.onFailure?.({ jobId: job.id, ...failure });
      await this.exclusive(async () => {
        this.failures.set(job.id, failure);
        job.state = signal.aborted ? 'queued' : 'failed';
        job.reason = job.attempts >= 3 ? 'RETRY_LIMIT' : 'PREPARATION_FAILED';
        job.updatedAt = this.now();
        await this.save();
      });
    } finally {
      key?.fill(0);
      master?.fill(0);
    }
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.abort.abort();
    await this.running;
    await this.serial;
  }
}
