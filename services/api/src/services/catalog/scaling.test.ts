import assert from 'node:assert/strict';
import { it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogReadModel } from './readModel.js';
import { JsonCatalogSnapshotStore, type CatalogSnapshotStore } from './snapshotStore.js';
import { catalogContent } from './content.js';
import { mapConcurrent } from './concurrency.js';
import type { CatalogChainGateway, CatalogChangeSet, CatalogRelease, CatalogSnapshot } from './types.js';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as const;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as const;
const artist = address(1),
  runtime = address(2);
const date = '2026-10-27T12:00:00.000Z';
function release(n = 1, owner = artist, space = runtime): CatalogRelease {
  return {
    id: `${space}:${hash(n)}`,
    hash: hash(n),
    runtimeAddress: space,
    artistAddress: owner,
    tokenId: String(n),
    title: `Track ${n}`,
    artist: `Artist ${owner}`,
    description: '',
    imageRef: '',
    coverVariants: [],
    audioRef: 'dotify:enc:v3:key-v2:ipfs://fixture',
    metadataRef: '',
    bulletinRef: '',
    artistContractRef: '',
    accessMode: 'free',
    priceWei: '0',
    priceDot: '0',
    personhoodLevel: 'DIM1',
    active: true,
    encrypted: true,
    royaltyBps: 10000,
    royaltySplits: [],
    registeredAtBlock: 1,
    sourceBlock: 1
  };
}
class Gateway implements CatalogChainGateway {
  identity = { chainId: 42, directoryAddress: artist };
  head = 12;
  artists = [{ artistAddress: artist, runtimeAddress: runtime }];
  ranges: [number, number][] = [];
  lists = 0;
  change: CatalogChangeSet = { directoryChanged: false, releases: [] };
  async getHeadBlock() {
    return this.head;
  }
  async getBlockHash(n: number) {
    return hash(n);
  }
  async listArtists() {
    return this.artists;
  }
  async listTrackHashes() {
    this.lists++;
    return [hash(1)];
  }
  async readRelease() {
    return release();
  }
  async getChanges(from: number, to: number) {
    this.ranges.push([from, to]);
    return this.change;
  }
}
class Store implements CatalogSnapshotStore {
  snapshot: CatalogSnapshot | null = null;
  writes = 0;
  ticks = 0;
  fail = false;
  async load() {
    return this.snapshot;
  }
  async save(snapshot: CatalogSnapshot) {
    if (this.fail) throw new Error('disk unavailable');
    this.writes++;
    this.snapshot = snapshot;
  }
  async saveProgress(snapshot: CatalogSnapshot) {
    if (this.fail) throw new Error('disk unavailable');
    this.ticks++;
    this.snapshot = snapshot;
  }
}
const model = (gateway: CatalogChainGateway, store: CatalogSnapshotStore, now = () => new Date(date)) =>
  new CatalogReadModel({
    gateway,
    store,
    pollIntervalMs: 60000,
    reconcileIntervalMs: 300000,
    staleAfterMs: 60000,
    confirmations: 2,
    now,
    logBlockRange: 100
  });

it('indexes 1,000 artists and 10,000 releases with bounded reads; records synthetic duration and memory', async t => {
  let active = 0,
    peak = 0,
    reads = 0,
    peakRss = process.memoryUsage().rss;
  async function read<T>(value: T) {
    active++;
    peak = Math.max(peak, active);
    reads++;
    if (reads % 100 === 0) peakRss = Math.max(peakRss, process.memoryUsage().rss);
    await setImmediate();
    active--;
    return value;
  }
  const artists = Array.from({ length: 1000 }, (_, i) => ({ artistAddress: address(i + 1), runtimeAddress: address(i + 1001) }));
  const gateway: CatalogChainGateway = {
    identity: { chainId: 42, directoryAddress: artist },
    getHeadBlock: async () => 12,
    getBlockHash: async n => hash(n),
    listArtists: async () => artists,
    listTrackHashes: async (_runtime, block) => {
      assert.equal(block, 10);
      return read(Array.from({ length: 10 }, (_, i) => hash(i + 1)));
    },
    readRelease: async (owner, space, content, block) => {
      assert.equal(block, 10);
      return read(release(Number(BigInt(content)), owner, space));
    },
    getChanges: async () => ({ directoryChanged: false, releases: [] })
  };
  const started = performance.now(),
    before = process.memoryUsage(),
    store = new Store(),
    catalog = model(gateway, store);
  const snapshot = await catalog.sync();
  const duration = performance.now() - started;
  assert.equal(snapshot.artists.length, 1000);
  assert.equal(snapshot.releases.length, 10000);
  assert.equal(peak, 8);
  assert.equal(reads, 11000);
  const index = catalogContent(snapshot),
    revision = catalog.getRevision();
  for (let i = 0; i < 10000; i++) {
    assert.equal(catalog.getRevision(), revision);
    assert.strictEqual(catalogContent(snapshot), index);
  }
  assert.equal(index.byRuntime.get(address(1001))?.length, 10);
  assert.equal(index.byHash.get(hash(1))?.length, 1000);
  assert.equal(index.byId.get(`${address(1001)}:${hash(1)}`)?.tokenId, '1');
  gateway.getHeadBlock = async () => 14;
  await catalog.sync();
  assert.equal(store.writes, 1);
  assert.equal(store.ticks, 1);
  assert.strictEqual(catalog.getSnapshot()!.releases, snapshot.releases);
  t.diagnostic(
    JSON.stringify({
      artists: 1000,
      releases: 10000,
      durationMs: +duration.toFixed(1),
      peakConcurrentReads: peak,
      heapDeltaMiB: +((process.memoryUsage().heapUsed - before.heapUsed) / 1048576).toFixed(1),
      peakRssMiB: +(peakRss / 1048576).toFixed(1),
      fullWrites: store.writes,
      progressWrites: store.ticks
    })
  );
});

it('drains already-started work after failure before allowing another writer', async () => {
  let done = false,
    calls = 0;
  await assert.rejects(
    mapConcurrent([1, 2, 3], 2, async n => {
      calls++;
      if (n === 1) throw new Error('RPC failed');
      await setImmediate();
      done = true;
    }),
    /RPC failed/
  );
  assert.equal(done, true);
  assert.equal(calls, 2);
});

it('persists each chunk, resumes after an outage and keeps intermediate checkpoints non-authoritative', async () => {
  const gateway = new Gateway(),
    store = new Store();
  let clock = Date.parse(date),
    failed = false;
  const catalog = model(gateway, store, () => new Date(clock));
  await catalog.sync();
  gateway.head = 342;
  clock += 300001; // Reconciliation must not bypass resumable replay.
  gateway.getChanges = async (from, to) => {
    assert.ok(to - from < 100);
    gateway.ranges.push([from, to]);
    if (from === 211 && !failed) {
      failed = true;
      throw new Error('RPC offline');
    }
    if (from > 11) assert.equal(catalog.getMetadata().state, 'stale-cache');
    return { directoryChanged: false, releases: [] };
  };
  await assert.rejects(catalog.sync(), /RPC offline/);
  assert.equal(store.snapshot?.lastIndexedBlock, 210);
  assert.equal(store.snapshot?.catchingUp, true);
  assert.equal(catalog.getMetadata().state, 'rpc-outage');
  const restarted = model(gateway, store, () => new Date(clock));
  gateway.getChanges = async (from, to) => {
    gateway.ranges.push([from, to]);
    return { directoryChanged: false, releases: [] };
  };
  await restarted.start();
  await restarted.sync();
  restarted.stop();
  assert.deepEqual(gateway.ranges, [
    [11, 110],
    [111, 210],
    [211, 310],
    [211, 310],
    [311, 340]
  ]);
  assert.equal(restarted.getSnapshot()?.lastIndexedBlock, 340);
  assert.equal(restarted.getMetadata().state, 'fresh');
});

it('skips discovered empty runtimes during reconciliation but notices their first release via events', async () => {
  const gateway = new Gateway(),
    store = new Store();
  let clock = Date.parse(date),
    published = false;
  gateway.listTrackHashes = async () => {
    gateway.lists++;
    return published ? [hash(1)] : [];
  };
  const catalog = model(gateway, store, () => new Date(clock));
  await catalog.sync();
  clock += 300001;
  gateway.head = 14;
  await catalog.sync();
  assert.equal(gateway.lists, 1);
  assert.equal(catalog.getSnapshot()?.releases.length, 0);
  published = true;
  gateway.head = 16;
  gateway.change = { directoryChanged: false, releases: [{ runtimeAddress: runtime, contentHash: hash(1), sourceBlock: 13 }] };
  await catalog.sync();
  assert.equal(catalog.getSnapshot()?.releases.length, 1);
  gateway.change = { directoryChanged: false, releases: [] };
  clock += 300001;
  gateway.head = 18;
  await catalog.sync();
  assert.equal(gateway.lists, 2);
});

it('never advances memory past a failed content write, and retries the content before progress', async () => {
  const gateway = new Gateway(),
    store = new Store(),
    catalog = model(gateway, store);
  await catalog.sync();
  gateway.head = 14;
  gateway.change = { directoryChanged: false, releases: [{ runtimeAddress: runtime, contentHash: hash(1), sourceBlock: 11 }] };
  gateway.readRelease = async () => ({ ...release(), title: 'Updated' });
  store.fail = true;
  await assert.rejects(catalog.sync(), /disk unavailable/);
  assert.equal(catalog.getSnapshot()?.lastIndexedBlock, 10);
  assert.equal(catalog.getSnapshot()?.releases[0]?.title, 'Track 1');
  store.fail = false;
  await catalog.sync();
  assert.equal(store.writes, 2);
  assert.equal(store.snapshot?.releases[0]?.title, 'Updated');
});

it('does not checkpoint a reorg occurring while reading a range', async () => {
  const gateway = new Gateway(),
    store = new Store(),
    catalog = model(gateway, store);
  await catalog.sync();
  gateway.head = 14;
  gateway.getChanges = async () => {
    gateway.getBlockHash = async n => hash(n + 1000);
    return { directoryChanged: false, releases: [] };
  };
  await assert.rejects(catalog.sync(), /checkpoint changed/);
  assert.equal(store.snapshot?.lastIndexedBlock, 10);
  await catalog.sync();
  assert.equal(store.snapshot?.lastIndexedBlock, 12);
});

it('local snapshots write only progress on unchanged polls and reload it; legacy base and mismatched sidecar remain safe', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dotify-w37-'));
  try {
    const path = join(dir, 'catalog.json'),
      store = new JsonCatalogSnapshotStore(path),
      gateway = new Gateway(),
      catalog = model(gateway, store);
    await catalog.sync();
    const full = await readFile(path, 'utf8');
    const first = catalog.getSnapshot()!;
    gateway.head = 14;
    await catalog.sync();
    assert.equal(await readFile(path, 'utf8'), full);
    const reloaded = await new JsonCatalogSnapshotStore(path).load();
    assert.equal(reloaded?.lastIndexedBlock, 12);
    // A content rename preceding a crash must not inherit the old progress file.
    const changed = { ...first, indexedAt: '2026-10-27T12:01:00.000Z', releases: [{ ...first.releases[0]!, title: 'New content' }] };
    await writeFile(path, JSON.stringify(changed));
    const replaced = await new JsonCatalogSnapshotStore(path).load();
    assert.equal(replaced?.lastIndexedBlock, 10);
    assert.equal(replaced?.releases[0]?.title, 'New content');
    await rm(`${path}.checkpoint`);
    assert.deepEqual(await new JsonCatalogSnapshotStore(path).load(), changed);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
