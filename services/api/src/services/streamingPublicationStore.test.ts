import assert from 'node:assert/strict';
import { it, type TestContext } from 'node:test';
import { mkdtemp, mkdir, chmod, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getTxCreator } from 'polkadot-api/tx-creator';
import { AccountId } from '@polkadot-api/substrate-bindings';
import { getPublicKey, secretFromSeed } from '@scure/sr25519';
import { initializeBulletinPublisher, publicationBinding, publisherProfileSchema, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { createStreamingPublicationStore, retainedPublicationReserve, type PublisherDependencies } from './streamingPublicationStore.js';
import { loadBulletinSigner } from './bulletinPublicationSession.js';
import { BULLETIN_MEDIA_GENESIS } from './bulletinHttpReader.js';
import { jobSchema, save } from './bulletinMediaState.js';
import { initializeStreamingJobs, StreamingJobs } from './streamingJobs.js';
import type { BulletinMediaTransport } from './bulletinMedia.js';

async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'dotify-publication-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const seed = Buffer.alloc(32, 47); // Only a generated, non-live test identity.
  const secret = secretFromSeed(seed);
  const account = AccountId(42).dec(getPublicKey(secret));
  secret.fill(0);
  const queue = join(root, 'queue');
  const profile: BulletinPublisherProfile = {
    schema: 'dotify.bulletin.publisher.v1',
    genesis: BULLETIN_MEDIA_GENESIS,
    endpoint: 'wss://bulletin.example:8443',
    account,
    directory: join(root, 'inventories'),
    seedFile: join(root, 'keys', 'storage.seed'),
    budget: { maxBytes: 1024 * 1024, maxTransactions: 64, minimumLifetimeBlocks: 100 },
    pipeline: { concurrency: 2, maxInFlightBytes: 512 * 1024 },
    priorRenewalReserve: { transactions: 107, bytes: 20 * 1024 * 1024 }
  };
  const file = join(root, 'profile.json');
  await mkdir(join(root, 'keys'), { mode: 0o700 });
  await writeFile(profile.seedFile, seed, { mode: 0o600 });
  await writeFile(file, JSON.stringify(profile), { mode: 0o600 });
  await initializeBulletinPublisher(queue, profile);
  const events: string[] = [],
    reserves: { transactions: number; bytes: number }[] = [];
  let disposed = 0,
    closed = 0;
  const transport: BulletinMediaTransport = {
    genesis: profile.genesis,
    account,
    writable: true,
    async status() {
      events.push('status');
      return { head: 1000, authorization: { expiresAt: 2000, remainingBytes: 100_000_000, remainingTransactions: 1000, remainingRenewBytes: 100_000_000 } };
    },
    async nextNonce() {
      return { nonce: 10, head: 1000 };
    },
    async lookup() {
      return null;
    },
    async lookupSubmission() {
      return null;
    },
    async readBlock() {
      throw new Error('No simulated stored block');
    },
    async store() {
      throw new Error('No writes authorized in this unit test');
    }
  };
  const deps: PublisherDependencies = {
    async loadSigner() {
      events.push('signer');
      return {
        account,
        createTransaction: getTxCreator(new Uint8Array(32), 'Sr25519', () => {
          throw new Error('No unit-test signatures');
        }),
        dispose() {
          disposed++;
        }
      };
    },
    openSession(_profile, signer, reserve) {
      events.push(signer ? 'write-session' : 'readonly-session');
      reserves.push(reserve);
      return {
        transport,
        close() {
          closed++;
          events.push('closed');
        }
      };
    }
  };
  const options = { provider: 'bulletin' as const, queue, profileFile: file };
  return {
    root,
    queue,
    file,
    profile,
    options,
    transport,
    deps,
    events,
    reserves,
    get disposed() {
      return disposed;
    },
    get closed() {
      return closed;
    }
  };
}
it('actual publisher preflights without a signer, binds its provider, holds a lifetime lease and disposes on close', async t => {
  const c = await setup(t);
  const store = await createStreamingPublicationStore(c.options, c.deps);
  assert.deepEqual(c.events, ['readonly-session', 'status', 'closed', 'signer']);
  assert.deepEqual(c.reserves, [c.profile.priorRenewalReserve]);
  await assert.rejects(createStreamingPublicationStore(c.options, c.deps), /EEXIST/);
  await assert.rejects(createStreamingPublicationStore({ provider: 'pinata', queue: c.queue }), /cannot be opened/);
  await store.close();
  await store.close();
  assert.equal(c.disposed, 1);
  await assert.rejects(access(join(c.profile.directory, 'publisher.lock')));
  const restarted = await createStreamingPublicationStore(c.options, c.deps);
  await restarted.close();
});
it('no missing journal, changed profile, or wrong transport identity can load a signer', async t => {
  const c = await setup(t);
  const changed = { ...c.profile, budget: { ...c.profile.budget, maxTransactions: 65 } };
  await writeFile(c.file, JSON.stringify(changed), { mode: 0o600 });
  await assert.rejects(createStreamingPublicationStore(c.options, c.deps), /profile changed/);
  await writeFile(c.file, JSON.stringify(c.profile));
  c.transport.genesis = `0x${'ab'.repeat(32)}`;
  await assert.rejects(createStreamingPublicationStore(c.options, c.deps), /identity changed/);
  assert(!c.events.includes('signer'));
  await assert.rejects(access(join(c.profile.directory, 'publisher.lock')));
  await rm(join(c.profile.directory, 'owner.json'));
  await assert.rejects(createStreamingPublicationStore(c.options, c.deps), /ENOENT/);
  assert(!c.events.includes('signer'));
});
it('refuses an invalid profile, symlink or public key file; key identity is checked and its disposed creator cannot sign', async t => {
  const c = await setup(t);
  for (const endpoint of [
    'ws://bulletin.example',
    'wss://user:pass@bulletin.example',
    'wss://localhost',
    'wss://bulletin.example/private',
    'wss://bulletin.example?key=x'
  ]) {
    assert(!publisherProfileSchema.safeParse({ ...c.profile, endpoint }).success);
  }
  assert(!publisherProfileSchema.safeParse({ ...c.profile, genesis: `0x${'11'.repeat(32)}` }).success);
  await chmod(c.profile.seedFile, 0o644);
  await assert.rejects(loadBulletinSigner(c.profile), /Invalid private/);
  await chmod(c.profile.seedFile, 0o600);
  await assert.rejects(loadBulletinSigner({ ...c.profile, account: 'other' }), /does not match/);
  const signer = await loadBulletinSigner(c.profile);
  assert.equal(signer.account, c.profile.account);
  signer.dispose();
  await assert.rejects(signer.createTransaction.signBytes(new Uint8Array([1])), /disposed/);
  assert.equal((await readFile(c.profile.seedFile)).length, 32);
  const { symlink } = await import('node:fs/promises');
  const link = join(c.root, 'keys', 'alias.seed');
  await symlink(c.profile.seedFile, link);
  await assert.rejects(loadBulletinSigner({ ...c.profile, seedFile: link }));
});
it('cross-release renewal obligations include partial stores, exclude unattempted drafts, and survive discarded queue entries', async t => {
  const c = await setup(t);
  const name = `stream-${'1'.repeat(8)}-${'1'.repeat(4)}-${'1'.repeat(4)}-${'1'.repeat(4)}-${'1'.repeat(12)}`;
  const job = jobSchema.parse({
    schema: 'dotify.bulletin.media-job.v2',
    genesis: c.profile.genesis,
    account: c.profile.account,
    job: name,
    root: 'cid',
    scope: { chainId: 1, runtimeAddress: 'runtime', contentHash: 'hash', keyVersion: 'version' },
    generation: 'generation',
    blocks: [{ cid: 'cid', bytes: 100 }],
    budget: c.profile.budget,
    pipeline: c.profile.pipeline,
    attemptedBytes: 100,
    attemptedStores: 1,
    receipts: {},
    pending: { cid: { nonce: 10, afterBlock: 1000 } },
    nextNonce: 11,
    ready: false
  });
  await save(c.profile.directory, 'owner.json', {
    schema: 'dotify.bulletin.media-owner.v2',
    genesis: c.profile.genesis,
    account: c.profile.account,
    jobs: [name],
    activeJob: name,
    nextNonce: 11
  });
  await save(c.profile.directory, `${name}.json`, job);
  assert.deepEqual(await retainedPublicationReserve(c.profile), { transactions: 108, bytes: c.profile.priorRenewalReserve.bytes + 100 });
  assert.deepEqual(await retainedPublicationReserve(c.profile, name), c.profile.priorRenewalReserve);
  const store = await createStreamingPublicationStore(c.options, c.deps);
  assert.equal(await store.canDiscard(name), false);
  await assert.rejects(store.pin([], name.replace(/^stream-1/, 'stream-2'), new AbortController().signal), /requires reconciliation/);
  assert(!c.events.includes('write-session'));
  await save(c.profile.directory, 'owner.json', {
    schema: 'dotify.bulletin.media-owner.v2',
    genesis: c.profile.genesis,
    account: c.profile.account,
    jobs: [name],
    activeJob: null,
    nextNonce: 11
  });
  await save(c.profile.directory, `${name}.json`, { ...job, attemptedBytes: 0, attemptedStores: 0, pending: {} });
  assert.deepEqual(await retainedPublicationReserve(c.profile), c.profile.priorRenewalReserve);
  assert.equal(await store.canDiscard(name), true);
  await store.close();
});
it('failed publication files cannot be discarded or pruned while recovery is required', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dotify-prune-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'queue');
  await initializeStreamingJobs(directory);
  const owner = `0x${'12'.repeat(20)}`,
    id = '11111111-1111-4111-8111-111111111111';
  const job = {
    id,
    owner,
    scope: { chainId: 1, runtimeAddress: owner, contentHash: `0x${'12'.repeat(32)}`, keyVersion: 'dotify-content-key-v2' },
    state: 'failed',
    attempts: 1,
    createdAt: 1,
    updatedAt: 1,
    sourceBytes: 1,
    sourceGeneration: '1234567890123456'
  };
  await mkdir(join(directory, 'jobs', id), { mode: 0o700 });
  await writeFile(join(directory, 'jobs', id, 'source.bin'), 'ciphertext-17byte');
  await writeFile(join(directory, 'jobs.json'), JSON.stringify({ schema: 'dotify.streaming.jobs.v1', jobs: [job] }));
  const jobs = new StreamingJobs({
    directory,
    deriveKey: () => null,
    authority: async () => true,
    transcode: async () => {
      throw new Error('unused');
    },
    pin: async () => {
      throw new Error('unused');
    },
    canDiscard: async () => false,
    now: () => 10 * 24 * 60 * 60_000
  });
  await jobs.start(false);
  await assert.rejects(jobs.discard(id, owner, 1), { code: 'STREAMING_RECOVERY_REQUIRED' });
  await jobs.runNext();
  assert.equal(jobs.get(id, owner, 1)?.state, 'failed');
  assert.equal(await readFile(join(directory, 'jobs', id, 'source.bin'), 'utf8'), 'ciphertext-17byte');
  await jobs.stop();
});
