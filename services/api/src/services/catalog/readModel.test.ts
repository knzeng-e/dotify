import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMediaPrewarmer } from '../mediaPrewarm.js';
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

  async listTrackHashes(): Promise<`0x${string}`[]> {
    return [HASH];
  }

  async readRelease(): Promise<CatalogRelease> {
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

describe('CatalogReadModel', () => {
  it('notifies acceleration only after persistence and isolates observer failure from catalog health', async () => {
    const gateway = new FakeGateway(),
      store = new MemoryStore();
    let calls = 0;
    const catalog = new CatalogReadModel({
      gateway,
      store,
      pollIntervalMs: 60000,
      reconcileIntervalMs: 300000,
      staleAfterMs: 60000,
      confirmations: 2,
      onSnapshot: snapshot => {
        calls++;
        assert.deepEqual(snapshot, store.snapshot);
        throw new Error('cache unavailable');
      }
    });
    await catalog.sync();
    assert.equal(calls, 1);
    assert.equal(catalog.getMetadata().state, 'fresh');
    gateway.head = 14;
    store.failSave = true;
    await assert.rejects(catalog.sync(), /disk unavailable/);
    assert.equal(calls, 1);
  });
  it('continues bounded warming and propagation retries on unchanged polls after restart', async () => {
    const hashes = Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}` as const);
    const cids = [...'abcdefghj'].map(letter => `Qm${letter.repeat(44)}`);
    const gateway: CatalogChainGateway = {
      identity: { chainId: 420420417, directoryAddress: ARTIST },
      getHeadBlock: async () => 12,
      getBlockHash: async block => blockHash(block),
      listArtists: async () => [{ artistAddress: ARTIST, runtimeAddress: RUNTIME }],
      listTrackHashes: async () => hashes,
      readRelease: async (_artist, _runtime, hash) =>
        release({ id: `${RUNTIME}:${hash}`, hash, audioRef: `dotify:enc:v3:key-v2:ipfs://${cids[hashes.indexOf(hash)]}` }),
      getChanges: async () => ({ directoryChanged: false, releases: [] })
    };
    const store = new MemoryStore();
    await model(gateway, store).sync(); // Persisted catalog from the previous process.
    let clock = 0,
      observations = 0;
    const manifests = new Map<string, number>();
    const prewarmer = createMediaPrewarmer(
      'https://media.example',
      async url => {
        const [, cid, object] = new URL(String(url)).pathname.split('/').slice(1);
        if (object === 'manifest.json') {
          const attempt = (manifests.get(cid!) ?? 0) + 1;
          manifests.set(cid!, attempt);
          if (cid === cids[0] && attempt === 1) throw new Error('Content still propagating');
        }
        return new Response(new Uint8Array([1]));
      },
      () => clock
    );
    const catalog = new CatalogReadModel({
      gateway,
      store,
      pollIntervalMs: 60000,
      reconcileIntervalMs: 300000,
      staleAfterMs: 60000,
      confirmations: 2,
      now: () => new Date(Date.parse('2026-07-23T12:00:00.000Z') + clock),
      onSnapshot: snapshot => {
        observations++;
        prewarmer.observe(snapshot);
      }
    });
    const settle = () => new Promise<void>(resolve => setImmediate(resolve));
    try {
      await catalog.start();
      await catalog.sync();
      await settle();
      assert.equal(observations, 1);
      assert.equal(manifests.size, 8); // Ninth release waits for the next admission window.
      assert.equal(manifests.get(cids[0]!), 1);
      clock = 10000;
      await catalog.sync();
      await settle();
      assert.equal(manifests.size, 8);
      assert.equal(manifests.get(cids[0]!), 1); // No premature retry/admission.
      clock = 60000;
      await catalog.sync();
      await settle();
      assert.equal(manifests.get(cids[0]!), 2);
      assert.equal(manifests.get(cids[8]!), 1);
      assert.equal(manifests.size, 9);
      assert.equal(store.writes, 1); // Observing did not rewrite unchanged content.
      assert.equal(store.progressWrites, 3);
      assert.equal(observations, 3);
      store.failSave = true;
      await assert.rejects(catalog.sync(), /disk unavailable/);
      assert.equal(observations, 3); // A failed checkpoint cannot trigger warming.
    } finally {
      catalog.stop();
      prewarmer.close();
    }
  });
  it('builds and persists a deterministic chain snapshot', async () => {
    const gateway = new FakeGateway();
    const store = new MemoryStore();
    const catalog = model(gateway, store);

    const snapshot = await catalog.sync({ forceReindex: true });

    assert.equal(snapshot.lastIndexedBlock, 10);
    assert.equal(snapshot.chainHeadBlock, 12);
    assert.equal(snapshot.artists[0]?.activeReleaseCount, 1);
    assert.equal(snapshot.releases[0]?.title, 'First light');
    assert.deepEqual(store.snapshot, snapshot);
    assert.equal(catalog.getMetadata().state, 'fresh');
  });

  it('replays runtime events without re-enumerating every runtime', async () => {
    const gateway = new FakeGateway();
    const catalog = model(gateway, new MemoryStore());
    await catalog.sync({ forceReindex: true });

    gateway.head = 14;
    gateway.currentRelease = release({ active: false });
    gateway.changes = {
      directoryChanged: false,
      releases: [{ runtimeAddress: RUNTIME, contentHash: HASH, sourceBlock: 11 }]
    };
    const snapshot = await catalog.sync();

    assert.equal(gateway.listArtistsCalls, 1);
    assert.equal(snapshot.releases[0]?.active, false);
    assert.equal(snapshot.releases[0]?.sourceBlock, 11);
    assert.equal(snapshot.artists[0]?.activeReleaseCount, 0);
    assert.equal(snapshot.lastIndexedBlock, 12);
  });

  it('detects a checkpoint reorg and deterministically reindexes canonical state', async () => {
    const gateway = new FakeGateway();
    const catalog = model(gateway, new MemoryStore());
    await catalog.sync({ forceReindex: true });

    gateway.head = 14;
    gateway.currentRelease = release({ title: 'Canonical title' });
    gateway.hashOverrides.set(10, blockHash(10, 'ff'));
    const snapshot = await catalog.sync();

    assert.equal(gateway.listArtistsCalls, 2);
    assert.equal(snapshot.releases[0]?.title, 'Canonical title');
    assert.equal(snapshot.lastIndexedBlock, 12);
  });

  it('reindexes instead of advancing past an event from an unknown runtime', async () => {
    const gateway = new FakeGateway();
    const catalog = model(gateway, new MemoryStore());
    await catalog.sync({ forceReindex: true });

    gateway.head = 14;
    gateway.changes = {
      directoryChanged: false,
      releases: [
        {
          runtimeAddress: '0x9999999999999999999999999999999999999999',
          contentHash: HASH,
          sourceBlock: 11
        }
      ]
    };
    await catalog.sync();

    assert.equal(gateway.listArtistsCalls, 2);
  });

  it('serves the in-memory snapshot while exposing persistence failure', async () => {
    const gateway = new FakeGateway();
    const store = new MemoryStore();
    const catalog = model(gateway, store);
    await catalog.sync({ forceReindex: true });

    gateway.head = 14;
    store.failSave = true;
    await assert.rejects(() => catalog.sync(), /disk unavailable/);

    const metadata = catalog.getMetadata();
    assert.equal(metadata.state, 'indexer-outage');
    assert.equal(metadata.cacheAvailable, true);
    assert.equal(metadata.lastErrorCode, 'CATALOG_INDEXER_UNAVAILABLE');
  });
});

it('isolates deterministic oversized releases, persists reasons, restores corrections and never swallows RPC errors', async () => {
  const { CatalogBoundsError } = await import('./bounds.js');
  const gateway = new FakeGateway(),
    store = new MemoryStore();
  const badHash = `0x${'44'.repeat(32)}` as const;
  let bad = true,
    unavailable = false;
  gateway.listTrackHashes = async () => [HASH, badHash];
  gateway.readRelease = (async (_artist: string, _runtime: string, contentHash: string) => {
    if (unavailable) throw new Error('RPC timeout');
    if (contentHash === badHash && bad) throw new CatalogBoundsError('title byte limit');
    return release({ id: `${RUNTIME}:${contentHash}`, hash: contentHash });
  }) as typeof gateway.readRelease;
  const catalog = model(gateway, store);
  await catalog.sync();
  assert.equal(catalog.getSnapshot()?.releases.length, 1);
  assert.equal(store.snapshot?.excludedReleases?.[0]?.reason, 'title byte limit');
  assert.equal(catalog.getMetadata().excludedReleaseCount, 1);
  const revision = catalog.getRevision();
  bad = false;
  gateway.head++;
  gateway.changes = { directoryChanged: false, releases: [{ runtimeAddress: RUNTIME, contentHash: badHash, sourceBlock: 11 }] };
  await catalog.sync();
  assert.equal(catalog.getSnapshot()?.releases.length, 2);
  assert.equal(catalog.getSnapshot()?.excludedReleases?.length, 0);
  assert.notEqual(catalog.getRevision(), revision);
  bad = true;
  gateway.head++;
  await catalog.sync();
  assert.equal(catalog.getSnapshot()?.releases.length, 1);
  assert.equal(store.snapshot?.excludedReleases?.length, 1);
  const checkpoint = catalog.getSnapshot()?.lastIndexedBlock;
  unavailable = true;
  gateway.head++;
  await assert.rejects(catalog.sync(), /RPC timeout/);
  assert.equal(catalog.getSnapshot()?.lastIndexedBlock, checkpoint);
});
