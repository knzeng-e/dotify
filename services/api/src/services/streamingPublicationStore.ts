// The application's storage choice. There is no retry across providers.
import assert from 'node:assert/strict';
import {
  preservePublicMetadata,
  readPublicAssetPolicy,
  assertPublicAssetOwner,
  buildPublicAssetGraph,
  publicAssetJob,
  publicAssetGeneration,
  isPublicAssetGeneration,
  type PublicAssetKind,
  type PublicAssetOwner
} from './bulletinPublicAssets.js';
import { join } from 'node:path';
import { readMetadataRepair, repairedMetadataFiles, assertRepairInventories } from './bulletinMetadataRepair.js';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
export { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { createBulletinMediaStore, type BulletinMediaTransport } from './bulletinMedia.js';
import { jobSchema, load, ownerSchema, privateDirectory } from './bulletinMediaState.js';
import { assertPublicationBinding, readBulletinPublisherProfile, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { pinFilesToPinata, type PinataFile } from './pinata.js';
import { parseStreamingManifest } from './streamingFormat.js';
import type { StreamingScope } from './streamingFormat.js';
import { PublicationAdmissionError } from './publicationAdmission.js';
import { createReleasePublication, verifyReleaseDependencies } from './bulletinReleasePublication.js';
import { buildBulletinMediaGraph } from './bulletinGraph.js';
import type { BulletinSigner } from './bulletinPapiTransport.js';
type Reserve = { transactions: number; bytes: number };
export type PublicationStore = {
  /** Read-only preflight; the authoritative check still runs immediately before storage. */
  assertCanPrepare?: (scope: StreamingScope, name?: string, owner?: string) => Promise<void>;
  admitPreparation?: (scope: StreamingScope, owner: string) => Promise<string>;
  pin(files: PinataFile[], name: string, signal: AbortSignal): Promise<string>;
  pinAsset?: (files: PinataFile[], kind: PublicAssetKind, owner: PublicAssetOwner, signal: AbortSignal) => Promise<string>;
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
    assetPolicyFile?: string;
    releaseAssets?: boolean;
    assetAuthority?: (owner: PublicAssetOwner) => Promise<boolean>;
    metadataRepairAuthority?: (owner: PublicAssetOwner, contentHash: string) => Promise<boolean>;
    /** Trusted operator composition: authenticate a saved recovery plan while
     * holding the publisher lease, before the private signer is loaded. */
    validateBeforeSigner?: () => Promise<void>;
  },
  deps?: PublisherDependencies
): Promise<PublicationStore> {
  if (options.provider === 'pinata') {
    assert.ok(!options.assetPolicyFile, 'Public Bulletin assets require the Bulletin publisher');
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
  assert.ok(
    !profile.releasePolicy || (options.releaseAssets === true && !options.assetPolicyFile),
    'Multi-release admission requires explicit Bulletin public assets without a pilot asset policy'
  );
  const assetPolicy = options.assetPolicyFile ? await readPublicAssetPolicy(options.assetPolicyFile, profile) : undefined;
  assert.ok(!options.releaseAssets || profile.releasePolicy || assetPolicy, 'Explicit public asset policy required');
  assert.ok(!(assetPolicy || profile.releasePolicy) || options.assetAuthority, 'Canonical artist authority check required for public assets');
  const sessionModule = deps ? undefined : await import('./bulletinPublicationSession.js');
  const selected: PublisherDependencies = deps ?? { loadSigner: sessionModule!.loadBulletinSigner, openSession: sessionModule!.openBulletinPublicationSession };
  await privateDirectory(profile.directory);
  await assertPublicationBinding(options.queue, profile);
  const releases = profile.releasePolicy ? createReleasePublication(profile, async () => (await inventories(profile)).jobs) : undefined;
  const unlock = await acquireBulletinPublisherLock(profile);
  let signer: BulletinSigner | undefined;
  let admittedRepair: Awaited<ReturnType<typeof readMetadataRepair>> = null;
  let closed = false;
  let activeSession: ReturnType<PublisherDependencies['openSession']> | undefined;
  const release = async () => {
    signer?.dispose();
    await unlock();
  };
  try {
    await releases?.validate();
    if (assetPolicy) {
      admittedRepair = await readMetadataRepair(profile, assetPolicy, AbortSignal.timeout(30_000));
      const { jobs } = await inventories(profile);
      if (admittedRepair) {
        assert.ok(options.metadataRepairAuthority, 'Canonical unregistered-release check required for metadata repair');
        assertRepairInventories(admittedRepair, jobs);
      } else {
        assert.ok(jobs.filter(job => job.generation === publicAssetGeneration('metadata')).length <= 1, 'Metadata repair permit missing');
      }
    }
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
    await options.validateBeforeSigner?.();
    signer = await selected.loadSigner(profile);
    assert.equal(signer.account, profile.account, 'Publication signer identity changed');
  } catch (error) {
    await release();
    throw error;
  }
  // All admitted work uses one publisher and account cursor. The upload service
  // permits two requests, so a cover may wait behind the single audio job.
  let waiting = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const assertAudioAdmission = (scope: StreamingScope, jobs: Awaited<ReturnType<typeof inventories>>['jobs'], name?: string) => {
    if (!profile.pilotScope) return;
    const audioJobs = jobs.filter(job => !isPublicAssetGeneration(job.generation));
    if (
      (audioJobs.length > 0 && !(audioJobs.length === 1 && audioJobs[0].job === name)) ||
      (['chainId', 'runtimeAddress', 'contentHash', 'keyVersion'] as const).some(field => scope[field] !== profile.pilotScope![field])
    )
      throw new PublicationAdmissionError();
  };
  const publish = (files: PinataFile[], name: string, signal: AbortSignal, asset?: { kind: PublicAssetKind; owner: PublicAssetOwner }): Promise<string> => {
    assert.ok(!closed && waiting < 3, 'Publisher is closed or busy');
    waiting++;
    const task = tail.then(async () => {
      assert.ok(!closed, 'Publisher is closed');
      signal.throwIfAborted();
      await assertPublicationBinding(options.queue, profile);
      const { owner, jobs } = await inventories(profile);
      if (releases) {
        assert.ok(!owner.activeJob || owner.activeJob === name || asset, 'Previous publication requires reconciliation');
        let graph: Awaited<ReturnType<typeof buildPublicAssetGraph>> | undefined;
        let dependencies: Awaited<ReturnType<typeof inventories>>['jobs'] = [];
        let budget = profile.budget;
        if (asset) {
          assert.ok(await options.assetAuthority!(asset.owner), 'Artist authority changed before public asset storage');
          const prepared = await releases.asset(files, asset.kind, asset.owner, signal, owner.activeJob);
          ({ files, name, graph, budget, dependencies } = prepared);
        } else {
          const manifest = files.find(f => f.path === 'manifest.json');
          assert.ok(manifest, 'Release manifest required');
          const { chainId, runtimeAddress, contentHash, keyVersion } = parseStreamingManifest(manifest.bytes);
          await releases.audio({ chainId, runtimeAddress, contentHash, keyVersion }, name);
          graph = await buildBulletinMediaGraph(files, signal);
          if (graph.bytes > budget.maxBytes || graph.blocks.length > budget.maxTransactions) throw new PublicationAdmissionError();
        }
        assert.ok(!owner.activeJob || owner.activeJob === name, 'Previous publication requires reconciliation');
        const reserve = await retainedPublicationReserve(profile, name);
        const session = selected.openSession({ ...profile, budget }, signer!, reserve);
        activeSession = session;
        try {
          await verifyReleaseDependencies(session.transport, dependencies, signal);
          return await createBulletinMediaStore({
            directory: profile.directory,
            identity: { genesis: profile.genesis, account: profile.account },
            transport: session.transport,
            budget,
            pipeline: profile.pipeline,
            ...(graph ? { buildGraph: async () => graph! } : {})
          }).pin(files, name, signal);
        } finally {
          session.close();
          activeSession = undefined;
        }
      }
      let effectiveAssetPolicy = assetPolicy;
      if (asset) {
        assert.ok(assetPolicy, 'Public assets are not activated');
        await readPublicAssetPolicy(options.assetPolicyFile!, profile);
        assert.deepEqual(
          await readMetadataRepair(profile, assetPolicy, signal),
          admittedRepair,
          'Metadata repair permit changed; restart after reviewed maintenance'
        );
        assertPublicAssetOwner(assetPolicy, asset.owner);
        assert.ok(await options.assetAuthority!(asset.owner), 'Artist authority changed before public asset storage');
        assert.ok(
          !owner.activeJob || jobs.some(job => job.job === owner.activeJob && job.generation === publicAssetGeneration(asset.kind)),
          'Previous publication requires reconciliation'
        );
        if (asset.kind === 'metadata') {
          if (admittedRepair) {
            assertRepairInventories(admittedRepair, jobs);
            assert.ok(await options.metadataRepairAuthority!(asset.owner, assetPolicy.scope.contentHash), 'Metadata repair requires an unregistered release');
            files = repairedMetadataFiles(admittedRepair, files);
            effectiveAssetPolicy = { ...assetPolicy, metadata: admittedRepair.budget };
          } else {
            await buildPublicAssetGraph(files, asset.kind, assetPolicy, signal);
            files = await preservePublicMetadata(profile.directory, files);
          }
        }
        const graph = await buildPublicAssetGraph(files, asset.kind, effectiveAssetPolicy!, signal);
        name = publicAssetJob(asset.kind, graph.root);
        const sameKind = jobs.filter(job => job.generation === publicAssetGeneration(asset.kind));
        if (asset.kind === 'metadata' && admittedRepair) {
          assert.equal(graph.root, admittedRepair.newRoot, 'Repaired metadata root changed');
        } else {
          assert.ok(!sameKind.length || (sameKind.length === 1 && sameKind[0].job === name), 'Public asset pilot already owns this asset');
        }
      }
      assert.ok(!owner.activeJob || owner.activeJob === name, 'Previous publication requires reconciliation');
      if (!asset && profile.pilotScope) {
        const bytes = files.find(file => file.path === 'manifest.json')?.bytes;
        assert.ok(bytes, 'Bulletin pilot manifest required');
        const { chainId, runtimeAddress, contentHash, keyVersion } = parseStreamingManifest(bytes);
        assertAudioAdmission({ chainId, runtimeAddress, contentHash, keyVersion }, jobs, name);
      }
      const selectedProfile = asset ? { ...profile, budget: effectiveAssetPolicy![asset.kind] } : profile;
      const reserved = await retainedPublicationReserve(profile, name);
      const session = selected.openSession(selectedProfile, signer!, reserved);
      activeSession = session;
      try {
        return await createBulletinMediaStore({
          directory: profile.directory,
          identity: { genesis: profile.genesis, account: profile.account },
          transport: session.transport,
          budget: selectedProfile.budget,
          pipeline: profile.pipeline,
          ...(asset
            ? { buildGraph: (input: PinataFile[], bounded: AbortSignal) => buildPublicAssetGraph(input, asset.kind, effectiveAssetPolicy!, bounded) }
            : {})
        }).pin(files, name, signal);
      } finally {
        session.close();
        activeSession = undefined;
      }
    });
    tail = task.catch(() => undefined);
    return task.finally(() => {
      waiting--;
    });
  };
  return {
    async assertCanPrepare(scope, name, owner) {
      assert.ok(!closed, 'Publisher is closed');
      await assertPublicationBinding(options.queue, profile);
      if (releases) {
        const state = await inventories(profile);
        if (state.owner.activeJob && state.owner.activeJob !== name) throw new PublicationAdmissionError();
        return releases.check(scope, name, owner);
      }
      assertAudioAdmission(scope, (await inventories(profile)).jobs, name);
    },
    ...(releases
      ? {
          async admitPreparation(scope: StreamingScope, owner: string) {
            assert.ok(!closed, 'Publisher is closed');
            await assertPublicationBinding(options.queue, profile);
            if ((await inventories(profile)).owner.activeJob) throw new PublicationAdmissionError();
            return releases.admit(scope, owner);
          }
        }
      : {}),
    pin: (files, name, signal) => publish(files, name, signal),
    ...(assetPolicy || releases
      ? {
          pinAsset: async (files: PinataFile[], kind: PublicAssetKind, owner: PublicAssetOwner, signal: AbortSignal) => {
            if (assetPolicy) assertPublicAssetOwner(assetPolicy, owner);
            return publish(files, '', signal, { kind, owner });
          }
        }
      : {}),
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
      await tail;
      await release();
    }
  };
}
