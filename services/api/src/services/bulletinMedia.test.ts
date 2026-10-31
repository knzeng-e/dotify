import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blake2b } from '@noble/hashes/blake2';
import { randomBytes, randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { encodeStreamingRelease } from './streamingEncoder.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from './streamingNonces.js';
import { verifyStreamingManifest, parseStreamingManifest, decryptStreamingObject, type StreamingScope } from './streamingFormat.js';
import { buildBulletinMediaGraph, verifyBulletinBlock, type BulletinBlock } from './bulletinGraph.js';
import { createBulletinMediaStore, initializeBulletinMediaStore, type BulletinMediaTransport, type BulletinReceipt } from './bulletinMedia.js';
import { createBulletinMediaReader } from './bulletinReader.js';
import { createMediaRoutes } from '../routes/media.js';
import type { CatalogSnapshot } from './catalog/types.js';

const identity = { genesis: `0x${'11'.repeat(32)}`, account: 'explicit-test-storage-account' };
const budget = { maxBytes: 8 * 1024 * 1024, maxTransactions: 4096, minimumLifetimeBlocks: 100 };
const signal = () => new AbortController().signal;
class Storage implements BulletinMediaTransport {
  genesis = identity.genesis;
  account = identity.account;
  writable = true;
  head = 1000;
  authorization = { expiresAt: 100000, remainingBytes: 16 * 1024 * 1024, remainingTransactions: 8192, remainingRenewBytes: 16 * 1024 * 1024 };
  stored = new Map<string, { block: BulletinBlock; receipt: BulletinReceipt }>();
  writes: string[] = [];
  reads: string[] = [];
  async status() {
    return { head: this.head, authorization: { ...this.authorization } };
  }
  async lookup(cid: string) {
    const value = this.stored.get(cid);
    return value && value.receipt.expiresAt > this.head ? { ...value.receipt } : null;
  }
  async readBlock(cid: string) {
    this.reads.push(cid);
    const block = this.stored.get(cid);
    assert.ok(block && block.receipt.expiresAt > this.head, 'Unavailable block');
    return Buffer.from(block.block.bytes);
  }
  async store(block: BulletinBlock): Promise<BulletinReceipt> {
    verifyBulletinBlock(block.cid, block.bytes);
    const receipt: BulletinReceipt = {
      cid: block.cid,
      bytes: block.bytes.length,
      block: this.head,
      index: this.writes.length,
      expiresAt: this.head + 50000,
      finalized: true
    };
    this.writes.push(block.cid);
    this.authorization.remainingTransactions--;
    this.authorization.remainingBytes -= block.bytes.length;
    this.stored.set(block.cid, { block, receipt });
    return { ...receipt };
  }
}
async function fixture(t: TestContext, segments = 2, segmentBytes = 48) {
  const root = await mkdtemp(join(tmpdir(), 'dotify-bulletin-adapter-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ledger = join(root, 'nonces');
  await initializeStreamingNonceLedger(ledger);
  const key = randomBytes(32);
  t.after(() => key.fill(0));
  const master = Buffer.alloc(1024, 5);
  const scope: StreamingScope = {
    chainId: 420420417,
    runtimeAddress: `0x${'22'.repeat(20)}`,
    contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
    keyVersion: 'dotify-content-key-v2'
  };
  // Structural/crypto fixture, not playable AAC. The protected research suite
  // separately exercises this adapter with the real FFmpeg encoder and decoder.
  const encoded = await encodeStreamingRelease({
    master,
    key,
    scope,
    ledger: new StreamingNonceLedger(ledger),
    transcode: async () => ({
      durationSeconds: segments * 3,
      integratedLufs: -18,
      gainDb: 2,
      renditions: ([96, 160, 320] as const).map(bitrateKbps => ({
        bitrateKbps,
        init: Buffer.from('synthetic init'),
        segments: Array.from({ length: segments }, (_, i) => Buffer.alloc(segmentBytes, i + 1))
      }))
    })
  });
  const files = encoded.files.map(f => ({ path: f.name, bytes: f.bytes }));
  const graph = await buildBulletinMediaGraph(files, signal());
  const directory = join(root, 'publications');
  await initializeBulletinMediaStore(directory, identity);
  const transport = new Storage();
  const options = { directory, identity, transport, budget };
  const store = createBulletinMediaStore(options);
  return { root, key, scope, files, graph, directory, transport, options, store, job: `stream-${randomUUID()}` };
}

test('complete release exceeds canary file/block limits and retains inventory after restart', async t => {
  const c = await fixture(t, 45);
  assert.ok(c.files.length > 64 && c.graph.blocks.length > 128);
  const root = await c.store.pin(c.files, c.job, signal());
  assert.equal(root, c.graph.root);
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  const reopened = createBulletinMediaStore(c.options);
  const inventory = await reopened.inventory(c.job);
  assert.equal(inventory.ready, true);
  assert.equal(inventory.blocks.length, c.graph.blocks.length);
  assert.equal(Object.keys(inventory.receipts).length, inventory.blocks.length);
  assert.deepEqual(inventory.scope, c.scope);
  assert.equal(inventory.attemptedStores, c.graph.blocks.length);
  assert.equal(inventory.attemptedBytes, c.graph.bytes);
  const child = execFileSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '-e',
      `
    import { createBulletinMediaStore } from ${JSON.stringify(new URL('./bulletinMedia.ts', import.meta.url).href)};
    const store = createBulletinMediaStore({ directory: process.argv[1], identity: ${JSON.stringify(identity)}, budget: ${JSON.stringify(budget)}, transport: ${JSON.stringify(identity)} });
    const job = await store.inventory(process.argv[2]);
    console.log(JSON.stringify({ root: job.root, ready: job.ready, blocks: job.blocks.length }));
  `,
      c.directory,
      c.job
    ],
    { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 20_000 }
  );
  assert.deepEqual(JSON.parse(child), { root, ready: true, blocks: c.graph.blocks.length });
  const bytes = await readFile(join(c.directory, `${c.job}.json`));
  assert.ok(!bytes.includes(c.key) && !bytes.includes(Buffer.from(c.key.toString('hex'))));
  await reopened.pin([...c.files].reverse(), c.job, signal());
  assert.equal(c.transport.writes.length, c.graph.blocks.length, 'Verified existing graph must not be stored twice');
});

test('lost acknowledgement reconciles the same job; another job cannot reuse the uncertain account', async t => {
  const c = await fixture(t);
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async block => {
    const receipt = await store(block);
    if (c.transport.writes.length === 3) throw new Error('Lost acknowledgement');
    return receipt;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Lost acknowledgement/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
  assert.ok((await c.store.inventory(c.job)).pending);
  await assert.rejects(c.store.pin(c.files, `stream-${randomUUID()}`, signal()), /needs reconciliation/);
  c.transport.store = store;
  const reopened = createBulletinMediaStore(c.options);
  await reopened.pin(c.files, c.job, signal());
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  assert.equal(new Set(c.transport.writes).size, c.transport.writes.length);
  assert.equal((await reopened.inventory(c.job)).pending, null);
});

test('a missing ambiguous broadcast is never resubmitted; definitive failures consume the persisted attempt budget', async t => {
  const c = await fixture(t);
  let calls = 0;
  c.transport.store = async () => {
    calls++;
    throw new Error('Unknown broadcast outcome');
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()));
  await assert.rejects(createBulletinMediaStore(c.options).pin(c.files, c.job, signal()), /Submission unresolved/);
  assert.equal(calls, 1);
  const d = await fixture(t);
  const once = createBulletinMediaStore({ ...d.options, budget: { ...budget, maxTransactions: d.graph.blocks.length * 2, maxBytes: d.graph.bytes } });
  d.transport.store = async () => {
    throw Object.assign(new Error('Rejected before broadcast'), { definitelyNotSubmitted: true });
  };
  await assert.rejects(once.pin(d.files, d.job, signal()), /Rejected before broadcast/);
  assert.equal((await once.inventory(d.job)).attemptedStores, 1);
  await assert.rejects(once.pin(d.files, d.job, signal()), /allowance exhausted/);
  assert.equal((await once.inventory(d.job)).pending, null);
});

test('journal binding rejects changed ciphertext, job scope, budget, account and network without further writes', async t => {
  const c = await fixture(t);
  await c.store.pin(c.files, c.job, signal());
  const count = c.transport.writes.length;
  const changed = c.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes) }));
  changed.find(f => f.path === '96/segment-000.bin')!.bytes[0] ^= 1;
  await assert.rejects(c.store.pin(changed, c.job, signal()), /identity or budget changed/);
  await assert.rejects(
    createBulletinMediaStore({ ...c.options, budget: { ...budget, maxTransactions: 4095 } }).pin(c.files, c.job, signal()),
    /identity or budget changed/
  );
  assert.throws(() => createBulletinMediaStore({ ...c.options, identity: { ...identity, account: 'other' } }), /identity mismatch/);
  assert.throws(() => createBulletinMediaStore({ ...c.options, identity: { ...identity, genesis: `0x${'44'.repeat(32)}` } }), /identity mismatch/);
  await assert.rejects(c.store.pin(c.files, '../escape', signal()));
  assert.equal(c.transport.writes.length, count);
});

test('missing ownership/journals, unsafe state permissions and stale writer locks fail closed', async t => {
  const c = await fixture(t);
  await c.store.pin(c.files, c.job, signal());
  await assert.rejects(initializeBulletinMediaStore(c.directory, identity), /EEXIST/);
  await writeFile(join(c.directory, 'writer.lock'), 'operator must reconcile crashed writer', { mode: 0o600 });
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /EEXIST/);
  await rm(join(c.directory, 'writer.lock')); // Controlled test operator, never automatic recovery.
  await rm(join(c.directory, `${c.job}.json`));
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /journal is missing/);
  await chmod(join(c.directory, 'owner.json'), 0o644);
  await assert.rejects(c.store.inventory(c.job), /state file/);
  await rm(join(c.directory, 'owner.json'));
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /ENOENT/);
});

test('quota/authorization and all-children retention are checked before readiness', async t => {
  const c = await fixture(t);
  c.transport.authorization.remainingTransactions = c.graph.blocks.length * 2 - 1;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /quota/);
  assert.equal(c.transport.writes.length, 0);
  c.transport.authorization.remainingTransactions = 8192;
  c.transport.authorization.expiresAt = c.transport.head + 50;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /expiring/);
  c.transport.authorization.expiresAt = 100000;
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async block => {
    const receipt = await store(block);
    if (block.cid === c.graph.root) c.transport.stored.values().next().value!.receipt.expiresAt = c.transport.head + 50;
    return receipt;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /retention/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
});

test('unfinalized receipts and corrupt raw bytes cannot produce a ready directory', async t => {
  const c = await fixture(t);
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async block => ({ ...(await store(block)), finalized: false }) as unknown as BulletinReceipt;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /readback differs/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
  const d = await fixture(t);
  const read = d.transport.readBlock.bind(d.transport);
  d.transport.readBlock = async cid => {
    const bytes = await read(cid);
    bytes[0] ^= 1;
    return bytes;
  };
  await assert.rejects(d.store.pin(d.files, d.job, signal()), /CID does not match/);
  assert.equal((await d.store.inventory(d.job)).ready, false);
});

test('exclusive writer and cancellation do not turn an in-flight broadcast into a retry', async t => {
  const c = await fixture(t);
  let started!: () => void;
  const entered = new Promise<void>(resolve => (started = resolve));
  c.transport.store = async () => {
    started();
    return new Promise(() => undefined);
  };
  const abort = new AbortController();
  const first = c.store.pin(c.files, c.job, abort.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await entered;
  await assert.rejects(createBulletinMediaStore(c.options).pin(c.files, c.job, signal()), /EEXIST/);
  abort.abort();
  await rejected;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Submission unresolved/);
});

test('Web route delivers verified ciphertext selectively, denies arbitrary paths and rechecks the active catalog', async t => {
  const c = await fixture(t, 2, 256 * 1024 + 17);
  await c.store.pin(c.files, c.job, signal());
  c.transport.reads.length = 0;
  const reader = createBulletinMediaReader(cid => c.transport.readBlock(cid));
  const app = Fastify();
  t.after(() => app.close());
  let active = true;
  const catalog = {
    getSnapshot: () => ({ releases: [{ active, encrypted: true, audioRef: `dotify:enc:v3:key-v2:ipfs://${c.graph.root}` }] }) as CatalogSnapshot
  };
  await app.register(createMediaRoutes({ catalog, reader }));
  const prefix = `/api/media/${c.graph.root}/stream/`;
  const manifestResponse = await app.inject(prefix + 'manifest.json');
  assert.equal(manifestResponse.statusCode, 200);
  const manifest = parseStreamingManifest(manifestResponse.rawPayload);
  verifyStreamingManifest(manifest, c.key, c.scope);
  const object = manifest.renditions[0].segments[0];
  const response = await app.inject(prefix + object.path);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.rawPayload, c.files.find(f => f.path === object.path)!.bytes);
  assert.equal(decryptStreamingObject(response.rawPayload, c.key, manifest, object).length, 256 * 1024 + 17);
  const reads = c.transport.reads.length;
  for (const path of ['archive/master.bin', '96/segment-256.bin', 'manifest.json?key=secret', '../manifest.json'])
    assert.equal((await app.inject(prefix + path)).statusCode, 404);
  assert.equal((await app.inject({ url: prefix + object.path, headers: { range: 'bytes=0-1' } })).statusCode, 404);
  active = false;
  assert.equal((await app.inject(prefix + object.path)).statusCode, 404);
  assert.equal(c.transport.reads.length, reads, 'Denied route must not read any block');
  assert.ok(!c.transport.reads.includes(c.graph.blocks[0].cid), 'Streaming must not read the archive raw block');
});

test('Web reader rejects corruption and bounds concurrent/aborted reads even for an unresponsive transport', async t => {
  const c = await fixture(t);
  await c.store.pin(c.files, c.job, signal());
  const corrupt = createBulletinMediaReader(async cid => {
    const bytes = await c.transport.readBlock(cid);
    bytes[0] ^= 1;
    return bytes;
  });
  await assert.rejects(corrupt.read(`${c.graph.root}/manifest.json`), /could not/);
  const abort = new AbortController();
  const reader = createBulletinMediaReader(() => new Promise(() => undefined));
  const a = reader.read(`${c.graph.root}/manifest.json`, abort.signal),
    b = reader.read(`${c.graph.root}/96/init.bin`, abort.signal);
  const cancelled = [assert.rejects(a, { name: 'AbortError' }), assert.rejects(b, { name: 'AbortError' })];
  await assert.rejects(reader.read(`${c.graph.root}/160/init.bin`), /busy/);
  abort.abort();
  await Promise.all(cancelled);
  await assert.rejects(reader.read(`${c.graph.root}/archive/master.bin`), /could not/);
});

test('manifest layout validation rejects plaintext extras, missing objects and cancelled graph creation', async t => {
  const c = await fixture(t);
  await assert.rejects(buildBulletinMediaGraph([...c.files, { path: 'key.bin', bytes: c.key }], signal()), /Unexpected/);
  await assert.rejects(
    buildBulletinMediaGraph(
      c.files.filter(f => f.path !== 'archive/master.bin'),
      signal()
    ),
    /files|missing/
  );
  await assert.rejects(buildBulletinMediaGraph([...c.files.slice(0, -1), c.files[0]], signal()), /Duplicate/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(buildBulletinMediaGraph(c.files, abort.signal), { name: 'AbortError' });
});
