import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
    audioRef: 'dotify:enc:v2:ipfs://audio',
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

  async load(): Promise<CatalogSnapshot | null> {
    return this.snapshot;
  }

  async save(snapshot: CatalogSnapshot): Promise<void> {
    if (this.failSave) throw new Error('disk unavailable');
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
