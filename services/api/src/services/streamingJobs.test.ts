import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { blake2b } from '@noble/hashes/blake2';
import { initializeStreamingJobs, StreamingJobs, type StreamingJobDeps } from './streamingJobs.js';
import { decryptStreamingObject, parseStreamingManifest, verifyStreamingManifest } from './streamingFormat.js';
import { packStreamingBundle, unpackStreamingBundle } from './streamingBundle.js';
import { createStreamingWorkerClient } from './streamingWorkerClient.js';
const owner = `0x${'12'.repeat(20)}`,
  runtime = `0x${'34'.repeat(20)}`,
  cid = `Qm${'a'.repeat(44)}`;
function master() {
  const b = Buffer.alloc(48 * 1000 + 44);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}
const audio = master(),
  key = Buffer.alloc(32, 37);
const scope = {
  chainId: 420420417,
  runtimeAddress: runtime,
  contentHash: `0x${Buffer.from(blake2b(audio, { dkLen: 32 })).toString('hex')}`,
  keyVersion: 'dotify-content-key-v2'
};
const encoded = {
  durationSeconds: 1,
  integratedLufs: -20,
  gainDb: 1,
  renditions: ([96, 160, 320] as const).map(bitrateKbps => ({ bitrateKbps, init: Buffer.from('synthetic init'), segments: [Buffer.from('synthetic segment')] }))
};
async function fixture(work: (directory: string, deps: StreamingJobDeps) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'dotify-jobs-test-')),
    directory = path.join(root, 'custody');
  try {
    await initializeStreamingJobs(directory);
    await work(directory, { directory, deriveKey: () => Buffer.from(key), authority: async () => true, transcode: async () => encoded, pin: async () => cid });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const input = { owner, scope, master: audio };
describe('durable streaming publications', () => {
  it('deduplicates admission, persists ciphertext only and publishes authenticated objects', async () =>
    fixture(async (directory, deps) => {
      let pins = 0;
      let files: Parameters<StreamingJobDeps['pin']>[0] = [];
      const jobs = new StreamingJobs({
        ...deps,
        pin: async value => {
          pins++;
          files = value;
          return cid;
        }
      });
      await jobs.start(false);
      const [a, b] = await Promise.all([
        jobs.enqueue(input),
        jobs.enqueue({ ...input, scope: { keyVersion: scope.keyVersion, contentHash: scope.contentHash, runtimeAddress: runtime, chainId: scope.chainId } })
      ]);
      assert.equal(a.id, b.id);
      assert.equal(jobs.get(a.id, `0x${'99'.repeat(20)}`, scope.chainId), null);
      assert.equal(jobs.get(a.id, owner, 1), null);
      const source = await readFile(path.join(directory, 'jobs', a.id, 'source.bin'));
      assert.notDeepEqual(source.subarray(0, 4), audio.subarray(0, 4));
      assert(!source.includes(key));
      assert(!(await readFile(path.join(directory, 'jobs.json'))).includes(key));
      await jobs.runNext();
      assert.equal(pins, 1);
      const result = jobs.get(a.id, owner, scope.chainId)!;
      assert.equal(result.state, 'ready');
      assert.equal(result.result?.ref, `dotify:enc:v3:key-v2:ipfs://${cid}`);
      const manifest = parseStreamingManifest(files.find(f => f.path === 'manifest.json')!.bytes);
      verifyStreamingManifest(manifest, key, scope);
      assert.deepEqual(decryptStreamingObject(files.find(f => f.path === 'archive/master.bin')!.bytes, key, manifest, manifest.master), audio);
      assert.deepEqual(await readdir(path.join(directory, 'jobs')), []);
      await jobs.stop();
    }));
  it('recovers a committed admission missing from its index and completes expiry tombstones', async () =>
    fixture(async (directory, deps) => {
      const first = new StreamingJobs(deps);
      await first.start(false);
      const job = await first.enqueue(input);
      await first.stop();
      const file = path.join(directory, 'jobs.json');
      const snapshot = JSON.parse(await readFile(file, 'utf8'));
      await writeFile(file, JSON.stringify({ ...snapshot, jobs: [] }));
      const restored = new StreamingJobs(deps);
      await restored.start(false);
      assert.equal(restored.get(job.id, owner, scope.chainId)?.state, 'queued');
      await restored.stop();
      const recovered = JSON.parse(await readFile(file, 'utf8'));
      recovered.jobs[0].state = 'expired';
      await writeFile(file, JSON.stringify(recovered));
      const cleanup = new StreamingJobs(deps);
      await cleanup.start(false);
      assert.equal(cleanup.get(job.id, owner, scope.chainId), null);
      assert.deepEqual(await readdir(path.join(directory, 'jobs')), []);
      await cleanup.stop();
      assert((await readdir(path.join(directory, 'nonces'))).length > 1);
    }));

  it('restores failed publishing and reuses ciphertext without invoking the encoder again', async () =>
    fixture(async (directory, deps) => {
      let calls = 0;
      const prepared: Buffer[] = [];
      const first = new StreamingJobs({
        ...deps,
        transcode: async () => {
          calls++;
          return encoded;
        },
        pin: async files => {
          prepared.push(Buffer.from(files.find(f => f.path === 'manifest.json')!.bytes));
          throw new Error('synthetic storage outage');
        }
      });
      await first.start(false);
      const job = await first.enqueue(input);
      await first.runNext();
      assert.equal(first.get(job.id, owner, scope.chainId)?.state, 'failed');
      await first.stop();
      const before = await readFile(path.join(directory, 'jobs', job.id, 'output', 'manifest.json'));
      const restored = new StreamingJobs({
        ...deps,
        transcode: async () => {
          throw new Error('must not encode twice');
        },
        pin: async files => {
          assert.deepEqual(Buffer.from(files.find(f => f.path === 'manifest.json')!.bytes), before);
          return cid;
        }
      });
      await restored.start(false);
      await restored.retry(job.id, owner, scope.chainId);
      await restored.runNext();
      assert.equal(restored.get(job.id, owner, scope.chainId)?.state, 'ready');
      assert.equal(calls, 1);
      assert.deepEqual(before, prepared[0]);
      await restored.stop();
    }));
  it('rechecks authority, bounds admission and refuses lost nonce custody without recreating it', async () =>
    fixture(async (directory, deps) => {
      const jobs = new StreamingJobs({
        ...deps,
        authority: async () => false,
        pin: async () => {
          throw new Error('must not publish');
        }
      });
      await jobs.start(false);
      const job = await jobs.enqueue(input);
      await jobs.runNext();
      assert.equal(jobs.get(job.id, owner, scope.chainId)?.state, 'failed');
      for (let n = 1; n < 4; n++) await jobs.enqueue({ ...input, scope: { ...scope, runtimeAddress: `0x${String(n).repeat(40)}` } });
      await assert.rejects(jobs.enqueue({ ...input, scope: { ...scope, runtimeAddress: `0x${'5'.repeat(40)}` } }), /STREAMING_QUEUE_BUSY/);
      await jobs.stop();
      const another = path.join(path.dirname(directory), 'fresh');
      await initializeStreamingJobs(another);
      const missing = new StreamingJobs({ ...deps, directory: another });
      await missing.start(false);
      await rm(path.join(another, 'nonces', 'ledger.json'));
      await assert.rejects(missing.enqueue(input));
      assert.deepEqual(await readdir(path.join(another, 'nonces')), []);
      await missing.stop();
    }));
  it('retains encrypted input on shutdown and burns the interrupted generation before resuming', async () =>
    fixture(async (directory, deps) => {
      let entered!: () => void;
      const ready = new Promise<void>(resolve => (entered = resolve));
      const first = new StreamingJobs({
        ...deps,
        transcode: async (_master, signal) => {
          entered();
          return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }));
        }
      });
      await first.start(false);
      const job = await first.enqueue(input);
      const running = first.runNext();
      await ready;
      await first.stop();
      await running;
      const folder = (await readdir(path.join(directory, 'nonces'))).find(name => name !== 'ledger.json')!;
      assert.equal((await readdir(path.join(directory, 'nonces', folder))).length, 2);
      const second = new StreamingJobs(deps);
      await second.start(false);
      await second.runNext();
      assert.equal(second.get(job.id, owner, scope.chainId)?.state, 'ready');
      assert.equal((await readdir(path.join(directory, 'nonces', folder))).length, 3);
      await second.stop();
    }));
});
describe('isolated encoder boundary', () => {
  it('bounds bundles and endpoints, refuses redirects and sends no content key to the parser', async () => {
    const bytes = packStreamingBundle(encoded);
    assert.deepEqual(unpackStreamingBundle(bytes), encoded);
    assert.throws(() => unpackStreamingBundle(Buffer.concat([bytes, Buffer.alloc(1)])));
    const malformed = Buffer.from(bytes);
    malformed.writeUInt32BE(50_000);
    assert.throws(() => unpackStreamingBundle(malformed));
    for (const url of ['http://example.org', 'https://example.org/private', 'https://user:pass@example.org', 'file:///tmp/encoder'])
      assert.throws(() => createStreamingWorkerClient(url, 'x'.repeat(32)));
    let options: RequestInit | undefined;
    const client = createStreamingWorkerClient('http://encoder.internal', 'x'.repeat(32), async (_url, init) => {
      options = init;
      return new Response(new Uint8Array(bytes));
    });
    assert.deepEqual(await client(audio), encoded);
    assert.equal(options?.redirect, 'error');
    assert(!JSON.stringify(options?.headers).includes(key.toString('hex')));
  });
});
