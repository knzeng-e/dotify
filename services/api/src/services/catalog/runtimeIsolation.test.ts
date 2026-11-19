import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createChainAccessService } from '../chainAccess.js';
import { RELEASE_BOUND_CONTENT_KEY_VERSION } from '../keyVault.js';
import { CatalogRuntimeReadError } from './runtimePolicy.js';
import { JsonCatalogSnapshotStore } from './snapshotStore.js';
import { catalogContent } from './content.js';
import { progressFor, withProgress } from './progress.js';
import { CatalogReadModel } from './readModel.js';
import type { CatalogChainGateway, CatalogChangeSet, CatalogRelease, CatalogSnapshot, DirectoryArtist } from './types.js';
import type { CatalogSnapshotStore } from './snapshotStore.js';

const ARTIST = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const HASH = `0x${'33'.repeat(32)}` as const;

function blockHash(block: number, salt = ''): `0x${string}` {
  return `0x${`${block.toString(16)}${salt}`.padStart(64, '0').slice(-64)}`;
}

function release(overrides: Partial<CatalogRelease> = {}): CatalogRelease {
  return {
    id: `${RUNTIME}:${HASH}`,
    hash: HASH,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    tokenId: '1',
    title: 'First light',
    artist: 'Dotify Artist',
    description: 'A registered release.',
    imageRef: 'ipfs://cover',
    coverVariants: ['ipfs://cover'],
    audioRef: 'dotify:enc:v3:key-v2:ipfs://Qm8ThP7gtvJxE6sZqcZ6wT3bHeqcTpzyHQZTfarocQeEUJ',
    metadataRef: 'paseo-bulletin:manifest',
    bulletinRef: 'paseo-bulletin:manifest',
    artistContractRef: 'ipfs://contract',
    accessMode: 'free',
    priceWei: '0',
    priceDot: '0',
    personhoodLevel: 'DIM1',
    active: true,
    encrypted: true,
    royaltyBps: 10_000,
    royaltySplits: [{ label: 'Primary recipient', recipient: ARTIST, bps: 10_000 }],
    registeredAtBlock: 5,
    sourceBlock: 5,
    ...overrides
  };
}

class MemoryStore implements CatalogSnapshotStore {
  snapshot: CatalogSnapshot | null = null;
  failSave = false;
  writes = 0;
  progressWrites = 0;

  async load(): Promise<CatalogSnapshot | null> {
    return this.snapshot;
  }

  async save(snapshot: CatalogSnapshot): Promise<void> {
    if (this.failSave) throw new Error('disk unavailable');
    this.writes++;
    this.snapshot = structuredClone(snapshot);
  }

  async saveProgress(snapshot: CatalogSnapshot): Promise<void> {
    if (this.failSave) throw new Error('disk unavailable');
    this.progressWrites++;
    this.snapshot = structuredClone(snapshot);
  }
}

class FakeGateway implements CatalogChainGateway {
  readonly identity = { chainId: 420420417, directoryAddress: ARTIST };
  head = 12;
  artists: DirectoryArtist[] = [{ artistAddress: ARTIST, runtimeAddress: RUNTIME }];
  currentRelease = release();
  changes: CatalogChangeSet = { directoryChanged: false, releases: [] };
  hashOverrides = new Map<number, `0x${string}`>();
  listArtistsCalls = 0;

  async getHeadBlock(): Promise<number> {
    return this.head;
  }

  async getBlockHash(blockNumber: number): Promise<`0x${string}`> {
    return this.hashOverrides.get(blockNumber) ?? blockHash(blockNumber);
  }

  async listArtists(): Promise<DirectoryArtist[]> {
    this.listArtistsCalls += 1;
    return this.artists;
  }

  async listTrackHashes(_runtime?: `0x${string}`, _block?: number, _signal?: AbortSignal): Promise<`0x${string}`[]> {
    return [HASH];
  }

  async readRelease(_artist?: `0x${string}`, _runtime?: `0x${string}`, _hash?: `0x${string}`, _block?: number, _signal?: AbortSignal): Promise<CatalogRelease> {
    return structuredClone(this.currentRelease);
  }

  async getChanges(): Promise<CatalogChangeSet> {
    return this.changes;
  }
}

function model(gateway: CatalogChainGateway, store: CatalogSnapshotStore, now = () => new Date('2026-07-23T12:00:00.000Z')) {
  return new CatalogReadModel({
    gateway,
    store,
    pollIntervalMs: 60_000,
    reconcileIntervalMs: 300_000,
    staleAfterMs: 60_000,
    confirmations: 2,
    now
  });
}

const BAD = `0x${'44'.repeat(20)}` as const;
const BAD_ARTIST = `0x${'55'.repeat(20)}` as const;
const HASH2 = `0x${'66'.repeat(32)}` as const;
class TwoRuntimes extends FakeGateway {
  broken = true;
  failure: unknown = new CatalogRuntimeReadError(BAD, 'execution-failed');
  failAt: 'inventory' | 'release' = 'inventory';
  inventories = new Map<string, number>();
  readHashes: string[] = [];
  constructor() {
    super();
    this.artists.push({ artistAddress: BAD_ARTIST, runtimeAddress: BAD });
  }
  override async listTrackHashes(runtime = RUNTIME as `0x${string}`, _block?: number, _signal?: AbortSignal) {
    this.inventories.set(runtime, (this.inventories.get(runtime) ?? 0) + 1);
    if (runtime === BAD && this.broken && this.failAt === 'inventory') throw this.failure;
    return runtime === BAD ? [HASH, HASH2] : [HASH];
  }
  override async readRelease(artist = ARTIST as `0x${string}`, runtime = RUNTIME as `0x${string}`, hash = HASH as `0x${string}`) {
    this.readHashes.push(`${runtime}:${hash}`);
    if (runtime === BAD && this.broken && this.failAt === 'release') throw this.failure;
    return release({ id: `${runtime}:${hash}`, artistAddress: artist, runtimeAddress: runtime, hash });
  }
}

it('cold reindex isolates a runtime and preserves healthy independently verified key access; the excluded runtime cannot get keys', async () => {
  const gateway = new TwoRuntimes(),
    catalog = model(gateway, new MemoryStore());
  const snapshot = await catalog.sync();
  assert.equal(snapshot.releases.length, 1);
  assert.equal(snapshot.artists.find(item => item.runtimeAddress === BAD)?.releaseCount, 0);
  assert.equal(catalog.getMetadata().state, 'fresh');
  assert.equal(catalog.getMetadata().excludedRuntimeCount, 1);
  const calls: string[] = [];
  const access = createChainAccessService({
    catalog,
    getDirectoryAddress: () => ARTIST,
    getChainId: () => gateway.identity.chainId,
    getClient: () =>
      ({
        getBlock: async () => ({ number: 12n, hash: blockHash(12) }),
        readContract: async ({ functionName }: { functionName: string }) => {
          calls.push(functionName);
          if (functionName === 'runtimeOf') return RUNTIME;
          if (functionName === 'runtimeArtist') return ARTIST;
          if (functionName === 'musicRegGetTrack') return [{ artist: ARTIST, audioRef: release().audioRef, active: true }];
          if (functionName === 'musicAccCanAccess') return true;
          assert.fail(functionName);
        }
      }) as never
  });
  const allowed = await access.checkTrackAccess({
    contentHash: HASH,
    requester: ARTIST,
    purpose: 'individual',
    release: {
      releaseId: `${RUNTIME}:${HASH}`,
      runtimeAddress: RUNTIME,
      artistAddress: ARTIST,
      audioRef: release().audioRef,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION
    }
  });
  assert.equal(allowed.allowed, true, JSON.stringify(allowed));
  assert.deepEqual(calls, ['runtimeOf', 'musicRegGetTrack', 'musicAccCanAccess', 'runtimeArtist']);
  const bad = await access.checkTrackAccess({
    contentHash: HASH,
    requester: ARTIST,
    purpose: 'individual',
    release: {
      releaseId: `${BAD}:${HASH}`,
      runtimeAddress: BAD,
      artistAddress: BAD_ARTIST,
      audioRef: release().audioRef,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION
    }
  });
  assert.equal(bad.allowed, false);
  if (!bad.allowed) assert.equal(bad.code, 'TRACK_NOT_FOUND');
  assert.equal(calls.length, 4);
});

it('incremental failure removes the entire runtime atomically and event repair rereads its whole inventory', async () => {
  const gateway = new TwoRuntimes(),
    store = new MemoryStore(),
    catalog = model(gateway, store);
  gateway.broken = false;
  await catalog.sync();
  const before = catalog.getRevision();
  gateway.broken = true;
  gateway.failAt = 'release';
  gateway.head++;
  gateway.changes = { directoryChanged: false, releases: [{ runtimeAddress: BAD, contentHash: HASH, sourceBlock: 11 }] };
  await catalog.sync();
  assert.equal(catalog.getSnapshot()?.releases.length, 1);
  assert.notEqual(catalog.getRevision(), before);
  assert.equal(store.snapshot?.excludedRuntimes?.length, 1);
  gateway.broken = false;
  gateway.head++;
  gateway.readHashes = [];
  store.failSave = true;
  await assert.rejects(catalog.sync(), /disk unavailable/);
  assert.equal(catalog.getSnapshot()?.excludedRuntimes?.length, 1);
  assert.equal(catalog.getSnapshot()?.lastIndexedBlock, 11);
  store.failSave = false;
  await catalog.sync();
  assert.deepEqual(gateway.readHashes.slice(-2).sort(), [`${BAD}:${HASH}`, `${BAD}:${HASH2}`].sort());
  assert.equal(catalog.getSnapshot()?.releases.length, 3);
  assert.deepEqual(catalog.getSnapshot()?.excludedRuntimes, []);
});

it('periodic reconciliation retries an excluded zero-release runtime after restart and recovers without events', async () => {
  const gateway = new TwoRuntimes(),
    store = new MemoryStore();
  let clock = Date.parse('2026-07-23T12:00:00.000Z');
  await model(gateway, store, () => new Date(clock)).sync();
  const catalog = model(gateway, store, () => new Date(clock));
  await catalog.start();
  await catalog.sync();
  catalog.stop();
  assert.equal(catalog.getMetadata().excludedRuntimeCount, 1);
  gateway.broken = false;
  clock += 300001;
  gateway.head++;
  await catalog.sync();
  assert.equal(gateway.inventories.get(BAD), 2);
  assert.equal(catalog.getSnapshot()?.releases.length, 3);
  assert.equal(catalog.getMetadata().state, 'fresh');
});

it('unknown/provider errors and wrongly attributed runtime failures remain global and never advance a checkpoint', async () => {
  for (const error of [new Error('provider unavailable'), new CatalogRuntimeReadError(RUNTIME, 'execution-failed')]) {
    const gateway = new TwoRuntimes(),
      catalog = model(gateway, new MemoryStore());
    await catalog.sync();
    const before = catalog.getSnapshot();
    gateway.failure = error;
    gateway.head++;
    gateway.changes = { directoryChanged: true, releases: [] };
    await assert.rejects(catalog.sync());
    assert.equal(catalog.getSnapshot(), before);
    assert.equal(catalog.getMetadata().state, 'rpc-outage');
  }
});

it('does not persist an exclusion across a canonicality failure', async () => {
  const gateway = new TwoRuntimes(),
    store = new MemoryStore(),
    catalog = model(gateway, store);
  const original = gateway.listTrackHashes.bind(gateway);
  gateway.listTrackHashes = async (...args) => {
    gateway.hashOverrides.set(10, blockHash(10, 'ff'));
    return original(args[0]);
  };
  await assert.rejects(catalog.sync(), /checkpoint changed/);
  assert.equal(store.snapshot, null);
  assert.equal(catalog.getSnapshot(), null);
});

it('drains aborted runtime work before the elected writer returns and keeps healthy data', async () => {
  const gateway = new TwoRuntimes(),
    store = new MemoryStore();
  let active = 0,
    writer = false;
  const original = gateway.listTrackHashes.bind(gateway);
  gateway.listTrackHashes = async (runtime, _block, signal) => {
    if (runtime !== BAD) return original(runtime);
    active++;
    assert.equal(writer, true);
    await new Promise<void>(resolve => signal!.addEventListener('abort', () => resolve(), { once: true }));
    await new Promise(resolve => setImmediate(resolve));
    active--;
    throw new CatalogRuntimeReadError(BAD, 'scan-deadline');
  };
  const shared: CatalogSnapshotStore = {
    load: () => store.load(),
    save: s => store.save(s),
    asWriter: async work => {
      writer = true;
      try {
        return { elected: true, value: await work() };
      } finally {
        assert.equal(active, 0);
        writer = false;
      }
    }
  };
  const catalog = new CatalogReadModel({
    gateway,
    store: shared,
    runtimeScanTimeoutMs: 30,
    pollIntervalMs: 60000,
    reconcileIntervalMs: 300000,
    staleAfterMs: 60000,
    confirmations: 2
  });
  // Deadline timers are deliberately unref'd; keep this synthetic test alive.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const snapshot = await catalog.sync();
    assert.equal(snapshot.releases.length, 1);
    assert.equal(snapshot.excludedRuntimes?.[0]?.code, 'scan-deadline');
    assert.equal(catalog.getMetadata().state, 'fresh');
  } finally {
    clearInterval(keepAlive);
  }
});

it('persists exclusion diagnostics through local base/progress reload and binds them to the content revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-runtime-isolation-'));
  try {
    const path = join(directory, 'catalog.json'),
      store = new JsonCatalogSnapshotStore(path),
      gateway = new TwoRuntimes(),
      catalog = model(gateway, store);
    const snapshot = await catalog.sync();
    gateway.head++;
    await catalog.sync();
    const loaded = await new JsonCatalogSnapshotStore(path).load();
    assert.equal(loaded?.lastIndexedBlock, 11);
    assert.deepEqual(loaded?.excludedRuntimes, snapshot.excludedRuntimes);
    const changed = { ...snapshot, excludedRuntimes: [] };
    assert.notEqual(catalogContent(changed).revision, catalogContent(snapshot).revision);
    assert.throws(() => progressFor(snapshot, changed), /cannot replace/);
    const progress = progressFor(snapshot, { ...snapshot, lastIndexedBlock: 11 });
    assert.equal('excludedRuntimes' in progress.checkpoint, false);
    assert.equal(withProgress(snapshot, progress).excludedRuntimes, snapshot.excludedRuntimes);
    assert.equal(withProgress(changed, progress), changed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
