// The application's storage choice. There is no retry across providers.
import assert from 'node:assert/strict';
import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createBulletinMediaStore, type BulletinMediaTransport } from './bulletinMedia.js';
import { jobSchema, load, ownerSchema, privateDirectory, sync } from './bulletinMediaState.js';
import { assertPublicationBinding, readBulletinPublisherProfile, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { pinFilesToPinata, type PinataFile } from './pinata.js';
import { parseStreamingManifest } from './streamingFormat.js';
import type { BulletinSigner } from './bulletinPapiTransport.js';
type Reserve = { transactions: number; bytes: number };
export type PublicationStore = {
  pin(files: PinataFile[], name: string, signal: AbortSignal): Promise<string>;
  canDiscard(name: string): Promise<boolean>;
  close(): Promise<void>;
};
export type PublisherDependencies = {
  loadSigner(profile: BulletinPublisherProfile): Promise<BulletinSigner>;
  openSession(profile: BulletinPublisherProfile, signer: BulletinSigner | null, reserve: Reserve): { transport: BulletinMediaTransport; close(): void };
};
async function inventories(profile: BulletinPublisherProfile) {
  const owner = ownerSchema.parse(await load(join(profile.directory, 'owner.json')));
  assert.equal(owner.account, profile.account);
  assert.equal(owner.genesis, profile.genesis);
  assert.equal(new Set(owner.jobs).size, owner.jobs.length, 'Duplicate publication inventory');
  assert.ok(!owner.activeJob || owner.jobs.includes(owner.activeJob), 'Missing active inventory');
  const jobs = [];
  for (const name of owner.jobs) {
    const job = jobSchema.parse(await load(join(profile.directory, `${name}.json`)));
    assert.equal(job.job, name);
    assert.equal(job.account, profile.account);
    assert.equal(job.genesis, profile.genesis);
    jobs.push(job);
  }
  return { owner, jobs };
}
export async function retainedPublicationReserve(profile: BulletinPublisherProfile, current?: string): Promise<Reserve> {
  const { jobs } = await inventories(profile);
  const reserve = { ...profile.priorRenewalReserve };
  for (const job of jobs) {
    if (job.job === current || (!job.ready && !job.attemptedStores && !Object.keys(job.pending).length && !Object.keys(job.receipts).length)) continue;
    reserve.transactions += job.blocks.length;
    reserve.bytes += job.blocks.reduce((total, block) => total + block.bytes, 0);
  }
  assert.ok(Number.isSafeInteger(reserve.transactions) && Number.isSafeInteger(reserve.bytes), 'Invalid accumulated renewal reserve');
  return reserve;
}
export async function createStreamingPublicationStore(
  options: {
    provider: 'pinata' | 'bulletin';
    queue: string;
    profileFile?: string;
  },
  deps?: PublisherDependencies
): Promise<PublicationStore> {
  if (options.provider === 'pinata') {
    assert.ok(!options.profileFile, 'A Bulletin profile requires explicit Bulletin audio storage');
    await assertPublicationBinding(options.queue);
    return {
      pin: (files, name, signal) => pinFilesToPinata(files, name, { app: 'dotify', type: 'streaming-audio' }, signal),
      canDiscard: async () => true,
      close: async () => undefined
    };
  }
  assert.ok(options.profileFile, 'Explicit Bulletin publication profile required');
  const profile = await readBulletinPublisherProfile(options.profileFile);
  const sessionModule = deps ? undefined : await import('./bulletinPublicationSession.js');
  const selected: PublisherDependencies = deps ?? { loadSigner: sessionModule!.loadBulletinSigner, openSession: sessionModule!.openBulletinPublicationSession };
  await privateDirectory(profile.directory);
  await assertPublicationBinding(options.queue, profile);
  const lock = await open(join(profile.directory, 'publisher.lock'), 'wx', 0o600);
  let signer: BulletinSigner | undefined;
  let closed = false;
  let running: Promise<string> | undefined;
  let activeSession: ReturnType<PublisherDependencies['openSession']> | undefined;
  const release = async () => {
    signer?.dispose();
    await lock.close();
    await rm(join(profile.directory, 'publisher.lock'));
    await sync(profile.directory);
  };
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    await lock.sync();
    await sync(profile.directory);
    // Read-only preflight before opening the private key. Startup never signs.
    const reserve = await retainedPublicationReserve(profile);
    const preflight = selected.openSession(profile, null, reserve);
    try {
      const state = await preflight.transport.status(AbortSignal.timeout(30_000));
      assert.ok(preflight.transport.genesis === profile.genesis && preflight.transport.account === profile.account, 'Publication transport identity changed');
      assert.ok(state.authorization.expiresAt > state.head + profile.budget.minimumLifetimeBlocks, 'Bulletin authorization is expiring');
    } finally {
      preflight.close();
    }
    signer = await selected.loadSigner(profile);
    assert.equal(signer.account, profile.account, 'Publication signer identity changed');
  } catch (error) {
    await release();
    throw error;
  }
  return {
    pin(files, name, signal) {
      assert.ok(!closed && !running, 'Publisher is closed or already publishing');
      running = (async () => {
        await assertPublicationBinding(options.queue, profile);
        const { owner } = await inventories(profile);
        assert.ok(!owner.activeJob || owner.activeJob === name, 'Previous publication requires reconciliation');
        if (profile.pilotScope) {
          assert.ok(!owner.jobs.length || (owner.jobs.length === 1 && owner.jobs[0] === name), 'Bulletin pilot already owns its one publication');
          const bytes = files.find(file => file.path === 'manifest.json')?.bytes;
          assert.ok(bytes, 'Bulletin pilot manifest required');
          const { chainId, runtimeAddress, contentHash, keyVersion } = parseStreamingManifest(bytes);
          assert.deepEqual({ chainId, runtimeAddress, contentHash, keyVersion }, profile.pilotScope, 'Release is outside the Bulletin pilot scope');
        }
        const reserved = await retainedPublicationReserve(profile, name);
        const session = selected.openSession(profile, signer!, reserved);
        activeSession = session;
        try {
          return await createBulletinMediaStore({
            directory: profile.directory,
            identity: { genesis: profile.genesis, account: profile.account },
            transport: session.transport,
            budget: profile.budget,
            pipeline: profile.pipeline
          }).pin(files, name, signal);
        } finally {
          session.close();
          activeSession = undefined;
        }
      })().finally(() => {
        running = undefined;
      });
      return running;
    },
    async canDiscard(name) {
      assert.ok(!closed, 'Publisher is closed');
      const { owner, jobs } = await inventories(profile);
      const job = jobs.find(job => job.job === name);
      return (
        owner.activeJob !== name &&
        (!job ||
          (!Object.keys(job.pending).length &&
            ((job.ready && job.blocks.every(block => job.receipts[block.cid]?.cid === block.cid && job.receipts[block.cid]?.bytes === block.bytes)) ||
              (!job.attemptedStores && !Object.keys(job.receipts).length))))
      );
    },
    async close() {
      if (closed) return;
      closed = true;
      // The app stops/awaits StreamingJobs first. Closing an in-flight client
      // stops observation only; its nonce barrier remains on disk for recovery.
      activeSession?.close();
      await running?.catch(() => undefined);
      await release();
    }
  };
}
