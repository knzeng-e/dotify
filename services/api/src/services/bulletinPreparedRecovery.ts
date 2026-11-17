// Maintenance-only recovery of one already-bound audio job. No encoder, new job,
// nonce reservation, attempt reset, public route, or alternate provider.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { blake2b } from '@noble/hashes/blake2';
import { z } from 'zod';
import { buildBulletinMediaGraph, BULLETIN_GRAPH_MAX } from './bulletinGraph.js';
import { buildBulletinCompactMediaGraph } from './bulletinCompactGraph.js';
import { privateDirectory, save, sync } from './bulletinMediaState.js';
import type { BulletinStorageLayout } from './bulletinStorageLayout.js';
import type { BulletinPipelineLimits } from './bulletinPipeline.js';
import { readPreparedPublicationBinding, readRecoveryProfileBinding } from './bulletinRecoveryBinding.js';
import { assertFreshContentKey } from './freshContentKey.js';
import type { ContentKeyVaultConfigInput } from './keyVault.js';
import { CID } from 'multiformats/cid';
import { formatStreamingReference } from './streamingReference.js';
import { assertPublicationBinding, publicationBinding, readBulletinPublisherProfile, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { decryptStreamingObject, parseStreamingManifest, verifyStreamingManifest, type StreamingScope } from './streamingFormat.js';
import { STREAM_NONCE_SCHEME, streamingKeyFingerprint } from './streamingNonces.js';
import { streamingJobsSchema, type StreamingJob } from './streamingJobs.js';
import { acquireBulletinPublisherLock, createStreamingPublicationStore, type PublisherDependencies } from './streamingPublicationStore.js';
import type { PinataFile } from './pinata.js';

const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const inputSchema = z.object({ jobId: z.string().uuid(), owner: z.string().regex(/^0x[0-9a-f]{40}$/) }).strict();
const nonceMarker = 'dotify.streaming.nonce-ledger.v1';
// No raw errors or key fingerprints are returned in the operator report.
type RecoveryPlanFields = {
  jobId: string;
  owner: string;
  scope: StreamingScope;
  root: string;
  attempts: number;
  blocks: number;
  graphBytes: number;
  attemptedStores: number;
  attemptedBytes: number;
  receipts: number;
  pending: number;
  maxTransactions: number;
  maxBytes: number;
  snapshotSha256: string;
};
export type PreparedRecoveryPlan = RecoveryPlanFields &
  (
    | { schema: 'dotify.bulletin.prepared-recovery.v1' }
    | { schema: 'dotify.bulletin.prepared-recovery.v2'; audioLayout: BulletinStorageLayout; admissionSha256: string; pipeline: BulletinPipelineLimits }
  );
type Options = {
  queue: string;
  profileFile: string;
  jobId: string;
  owner: string;
  /** Absent = local inspection. Present = explicit execution of this exact plan. */
  executePlan?: string;
  signal: AbortSignal;
};
type Dependencies = {
  deriveKey(scope: StreamingScope): Buffer | null;
  authority(owner: string, runtime: string, chainId: number): Promise<boolean>;
  publisher?: PublisherDependencies;
  /** Trusted server/test vault selection, never an operator CLI key argument. */
  contentKeyVault?: ContentKeyVaultConfigInput;
};
async function privateBytes(file: string, maximum: number): Promise<Buffer> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    assert.ok(
      info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= maximum && !(info.mode & 0o077) && info.uid === process.getuid?.(),
      'Unsafe or oversized recovery file'
    );
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
async function prepare(options: Options, profile: BulletinPublisherProfile, deps: Dependencies) {
  options.signal.throwIfAborted();
  await privateDirectory(options.queue);
  await privateDirectory(join(options.queue, 'jobs'));
  await assertPublicationBinding(options.queue, profile);
  await lstat(join(profile.directory, 'writer.lock')).then(
    () => {
      throw new Error('Existing writer lock requires operator inspection');
    },
    error => {
      if (error.code !== 'ENOENT') throw error;
    }
  );
  assertFreshContentKey(profile.freshContentKey, deps.contentKeyVault);
  const snapshots: Array<[string, string]> = [];
  const read = async (name: string, file: string, limit = 2 * 1024 * 1024) => {
    options.signal.throwIfAborted();
    const bytes = await privateBytes(file, limit);
    options.signal.throwIfAborted();
    snapshots.push([name, sha256(bytes)]);
    return bytes;
  };
  const queueBytes = await read('queue', join(options.queue, 'jobs.json'), 256 * 1024);
  const queue = streamingJobsSchema.parse(JSON.parse(queueBytes.toString('utf8')));
  assert.equal(new Set(queue.jobs.map(job => job.id)).size, queue.jobs.length, 'Duplicate streaming jobs');
  const job = queue.jobs.find(job => job.id === options.jobId);
  assert.ok(job && job.owner === options.owner, 'Recovery job/owner mismatch');
  assert.ok(job.state === 'failed' && job.attempts === 3 && !job.ref, 'Recovery requires an exhausted failed job');
  await readRecoveryProfileBinding(profile, options.profileFile, options.queue, read);
  const binding = await readPreparedPublicationBinding(profile, job, read);
  const allowed = () => deps.authority(job.owner, job.scope.runtimeAddress, job.scope.chainId);
  assert.ok(await allowed(), 'Artist authority unavailable');
  const folder = join(options.queue, 'jobs', job.id);
  const output = join(folder, 'output');
  await privateDirectory(folder);
  await privateDirectory(output);
  await privateDirectory(join(options.queue, 'nonces'));
  const key = deps.deriveKey(job.scope);
  assert.ok(key, 'Release key unavailable');
  try {
    const marker = JSON.parse((await read('nonce-ledger', join(options.queue, 'nonces', 'ledger.json'))).toString('utf8'));
    assert.deepEqual(marker, { schema: nonceMarker }, 'Nonce ledger unavailable');
    const manifest = parseStreamingManifest(await read('manifest', join(output, 'manifest.json'), 256 * 1024));
    verifyStreamingManifest(manifest, key, job.scope);
    const keyDirectory = join(options.queue, 'nonces', streamingKeyFingerprint(key));
    await privateDirectory(keyDirectory);
    for (const generation of new Set([job.sourceGeneration, manifest.generation])) {
      const reservation = JSON.parse((await read(`reservation-${generation}`, join(keyDirectory, `${generation}.json`))).toString('utf8'));
      assert.deepEqual(reservation, { schema: nonceMarker, fingerprint: streamingKeyFingerprint(key), generation }, 'Nonce reservation unavailable');
    }
    const source = await read('source', join(folder, 'source.bin'), 50 * 1024 * 1024 + 16);
    assert.equal(source.length, job.sourceBytes + 16, 'Source size changed');
    const sourcePlain = decryptStreamingObject(
      source,
      key,
      { ...manifest, nonceScheme: STREAM_NONCE_SCHEME, generation: job.sourceGeneration },
      {
        rendition: 'archive',
        kind: 'master',
        index: 0,
        path: 'archive/master.bin',
        counter: 0,
        plainLength: job.sourceBytes,
        encryptedLength: job.sourceBytes + 16
      }
    );
    try {
      assert.equal(`0x${Buffer.from(blake2b(sourcePlain, { dkLen: 32 })).toString('hex')}`, job.scope.contentHash, 'Source hash changed');
    } finally {
      sourcePlain.fill(0);
    }
    const files: PinataFile[] = [];
    const objects = [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])];
    assert.ok(objects.reduce((n, object) => n + object.encryptedLength, 0) <= BULLETIN_GRAPH_MAX, 'Prepared output exceeds byte bound');
    for (const object of objects) {
      options.signal.throwIfAborted();
      await privateDirectory(join(output, object.rendition));
      const bytes = await read(object.path, join(output, object.path), object.encryptedLength);
      assert.equal(bytes.length, object.encryptedLength, 'Prepared object size changed');
      const plain = decryptStreamingObject(bytes, key, manifest, object);
      try {
        if (object.kind === 'master') {
          assert.equal(plain.length, job.sourceBytes, 'Prepared master size changed');
          assert.equal(`0x${Buffer.from(blake2b(plain, { dkLen: 32 })).toString('hex')}`, job.scope.contentHash, 'Prepared master hash changed');
        }
      } finally {
        plain.fill(0);
      }
      files.push({ path: object.path, bytes });
    }
    // Same representation as the normal queue, preserving the existing root.
    files.push({ path: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
    const graph = await (binding.layout === 'rendition-pack-v1' ? buildBulletinCompactMediaGraph : buildBulletinMediaGraph)(files, options.signal);
    const { inventory } = binding;
    const expectedInventory = {
      job: binding.name,
      genesis: profile.genesis,
      account: profile.account,
      root: graph.root,
      scope: graph.scope,
      generation: graph.generation,
      blocks: graph.blocks.map(block => ({ cid: block.cid, bytes: block.bytes.length })),
      budget: profile.budget,
      pipeline: binding.pipeline
    };
    for (const field of Object.keys(expectedInventory) as (keyof typeof expectedInventory)[])
      assert.deepEqual(inventory[field], expectedInventory[field], 'Saved publication binding changed');
    assert.ok(
      inventory.attemptedStores <= profile.budget.maxTransactions && inventory.attemptedBytes <= profile.budget.maxBytes,
      'Existing allowance exhausted'
    );
    const plan: PreparedRecoveryPlan = {
      ...(binding.admissionSha256
        ? {
            schema: 'dotify.bulletin.prepared-recovery.v2' as const,
            audioLayout: binding.layout,
            admissionSha256: binding.admissionSha256,
            pipeline: binding.pipeline
          }
        : { schema: 'dotify.bulletin.prepared-recovery.v1' as const }),
      jobId: job.id,
      owner: job.owner,
      scope: job.scope,
      root: graph.root,
      attempts: job.attempts,
      blocks: graph.blocks.length,
      graphBytes: graph.bytes,
      attemptedStores: inventory.attemptedStores,
      attemptedBytes: inventory.attemptedBytes,
      receipts: Object.keys(inventory.receipts).length,
      pending: Object.keys(inventory.pending).length,
      maxTransactions: profile.budget.maxTransactions,
      maxBytes: profile.budget.maxBytes,
      snapshotSha256: sha256(JSON.stringify({ queue: options.queue, profile: publicationBinding(profile), snapshots }))
    };
    const planSha256 = sha256(JSON.stringify(plan));
    return { plan, planSha256, files, queue, queueBytes, job, allowed, layout: binding.layout };
  } finally {
    key.fill(0);
  }
}
export async function recoverPreparedBulletinJob(options: Options, deps: Dependencies) {
  inputSchema.parse({ jobId: options.jobId, owner: options.owner });
  assert.ok(isAbsolute(options.queue), 'Absolute queue path required');
  if (options.executePlan !== undefined) assert.match(options.executePlan, /^[0-9a-f]{64}$/, 'Exact inspected plan hash required');
  const profile = await readBulletinPublisherProfile(options.profileFile);
  if (options.executePlan === undefined) {
    const unlock = await acquireBulletinPublisherLock(profile);
    try {
      const { plan, planSha256 } = await prepare(options, profile, deps);
      return { mode: 'inspect' as const, plan, planSha256 };
    } finally {
      await unlock();
    }
  }
  let prepared: Awaited<ReturnType<typeof prepare>> | undefined;
  // The same lifetime publisher lease excludes the running custody queue. The
  // callback runs before the signer, and does not start/prune any queue jobs.
  const publication = await createStreamingPublicationStore(
    {
      provider: 'bulletin',
      queue: options.queue,
      profileFile: options.profileFile,
      contentKeyVault: deps.contentKeyVault,
      ...(profile.releasePolicy
        ? {
            releaseAssets: true,
            // Enable the multi-release validator, never public-asset publication.
            assetAuthority: async () => false
          }
        : {}),
      validateBeforeSigner: async () => {
        prepared = await prepare(options, profile, deps);
        assert.equal(prepared.planSha256, options.executePlan, 'Recovery plan changed; inspect again');
      }
    },
    deps.publisher
  );
  const auditId = `prepared-recovery-${randomUUID()}.json`;
  let auditStarted = false;
  let audit: { schema: string; plan: PreparedRecoveryPlan; planSha256: string; previousJob: StreamingJob; startedAt: number } | undefined;
  try {
    assert.ok(prepared);
    const { job, plan, planSha256 } = prepared;
    options.signal.throwIfAborted();
    assert.ok(await prepared.allowed(), 'Artist authority changed before recovery publication');
    audit = {
      schema:
        plan.schema === 'dotify.bulletin.prepared-recovery.v2'
          ? 'dotify.bulletin.prepared-recovery-attempt.v2'
          : 'dotify.bulletin.prepared-recovery-attempt.v1',
      plan,
      planSha256,
      previousJob: { ...job },
      startedAt: Date.now()
    };
    const audits = join(options.queue, 'recoveries');
    await mkdir(audits, { mode: 0o700 }).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
    await privateDirectory(audits);
    await sync(options.queue);
    await save(audits, auditId, { ...audit, state: 'started' });
    auditStarted = true;
    const cid = await publication.pin(prepared.files, `stream-${job.id}`, options.signal);
    options.signal.throwIfAborted();
    assert.equal(cid, plan.root, 'Recovered publication root changed');
    assert.ok((await privateBytes(join(options.queue, 'jobs.json'), 256 * 1024)).equals(prepared.queueBytes), 'Queue changed during exclusive recovery');
    const expectedRef = formatStreamingReference(cid, job.scope.keyVersion, prepared.layout, value => CID.parse(value));
    const ref = publication.audioReference ? await publication.audioReference(job.scope, cid) : expectedRef;
    assert.equal(ref, expectedRef, 'Recovered reference differs from the inspected layout');
    job.ref = ref;
    job.state = 'ready';
    job.updatedAt = Date.now();
    delete job.reason;
    await save(options.queue, 'jobs.json', prepared.queue);
    await save(audits, auditId, { ...audit, state: 'ready', completedAt: Date.now(), ref });
    // Keep source/output for the operator's coherent backup. Normal startup
    // cleans only ready files after the queue reference has been committed.
    return { mode: 'execute' as const, plan, planSha256, ref, auditId };
  } catch (error) {
    if (audit && auditStarted) await save(join(options.queue, 'recoveries'), auditId, { ...audit, state: 'needs-inspection', stoppedAt: Date.now() });
    throw error;
  } finally {
    await publication.close();
  }
}
