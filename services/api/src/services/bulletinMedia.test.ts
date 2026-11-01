import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import * as dagPB from '@ipld/dag-pb';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
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
import {
  createBulletinMediaStore,
  initializeBulletinMediaStore,
  type BulletinMediaTransport,
  type BulletinReceipt,
  type BulletinSubmissionReceipt
} from './bulletinMedia.js';
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
  nonce = 10;
  submissions = new Map<number, BulletinSubmissionReceipt>();
  async nextNonce() {
    return { nonce: this.nonce, head: this.head };
  }
  async lookupSubmission({ nonce }: { nonce: number }) {
    return this.submissions.get(nonce) ?? null;
  }
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
  async store(block: BulletinBlock, intent: { nonce: number }): Promise<BulletinSubmissionReceipt> {
    verifyBulletinBlock(block.cid, block.bytes);
    this.head++;
    const receipt: BulletinReceipt = {
      cid: block.cid,
      bytes: block.bytes.length,
      block: this.head,
      index: this.writes.length,
      expiresAt: this.head + 50000,
      finalized: true
    };
    assert.ok(!this.submissions.has(intent.nonce), 'Duplicate nonce');
    const submission = { ...receipt, account: this.account, nonce: intent.nonce };
    this.submissions.set(intent.nonce, submission);
    while (this.submissions.has(this.nonce)) this.nonce++;
    this.writes.push(block.cid);
    this.authorization.remainingTransactions--;
    this.authorization.remainingBytes -= block.bytes.length;
    this.stored.set(block.cid, { block, receipt });
    return { ...submission };
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

function mockDeadlineClock(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
}

test('custody waits past its short read deadline for one exact signed store', async t => {
  const c = await fixture(t);
  mockDeadlineClock(t);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let waiting: AbortSignal | undefined;
  const actualStore = c.transport.store.bind(c.transport);
  const transport: BulletinMediaTransport = Object.assign(Object.create(c.transport), {
    async store(block: BulletinBlock, intent: { nonce: number }, bounded: AbortSignal) {
      if (!waiting) {
        waiting = bounded;
        await gate;
        bounded.throwIfAborted();
      }
      return actualStore(block, intent);
    }
  });
  let settled = false;
  const writing = createBulletinMediaStore({ ...c.options, transport }).pin(c.files, c.job, signal());
  void writing.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  while (!waiting) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(40_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(waiting.aborted, false);
  assert.equal(settled, false);
  release();
  assert.equal(await writing, c.graph.root);
  assert.equal((await c.store.inventory(c.job)).ready, true);
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  assert.equal(new Set(c.transport.writes).size, c.graph.blocks.length);
});

test('an unresponsive store still expires at two minutes and preserves both pending nonces', async t => {
  const c = await fixture(t);
  mockDeadlineClock(t);
  const submitted: AbortSignal[] = [];
  const transport: BulletinMediaTransport = Object.assign(Object.create(c.transport), {
    store(_block: BulletinBlock, _intent: { nonce: number }, bounded: AbortSignal) {
      submitted.push(bounded);
      return new Promise(() => {});
    }
  });
  const store = createBulletinMediaStore({ ...c.options, transport });
  const writing = assert.rejects(store.pin(c.files, c.job, signal()), { name: 'TimeoutError' });
  while (submitted.length < 2) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(120_000);
  await writing;
  assert.ok(submitted.every(s => s.aborted));
  const inventory = await store.inventory(c.job);
  assert.equal(inventory.ready, false);
  assert.equal(inventory.attemptedStores, 2);
  assert.equal(Object.keys(inventory.pending).length, 2);
  assert.equal(Object.keys(inventory.receipts).length, 0);
  await assert.rejects(store.pin(c.files, c.job, signal()), /unresolved/i);
  assert.equal(submitted.length, 2, 'Unknown transactions are not resubmitted after a longer deadline');
});

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
  c.transport.store = async (block, intent) => {
    const receipt = await store(block, intent);
    if (c.transport.writes.length === 3) throw new Error('Lost acknowledgement');
    return receipt;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Lost acknowledgement/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
  assert.ok(Object.keys((await c.store.inventory(c.job)).pending).length);
  await assert.rejects(c.store.pin(c.files, `stream-${randomUUID()}`, signal()), /needs reconciliation/);
  c.transport.store = store;
  const reopened = createBulletinMediaStore(c.options);
  await reopened.pin(c.files, c.job, signal());
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  assert.equal(new Set(c.transport.writes).size, c.transport.writes.length);
  assert.deepEqual((await reopened.inventory(c.job)).pending, {});
});

test('missing uncertain writes are not replayed, even for an untrusted definitelyNotSubmitted flag', async t => {
  const c = await fixture(t);
  let calls = 0;
  c.transport.store = async () => {
    calls++;
    throw Object.assign(new Error('Unknown broadcast outcome'), { definitelyNotSubmitted: true });
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()));
  const before = await c.store.inventory(c.job);
  const attempted = calls;
  await assert.rejects(createBulletinMediaStore(c.options).pin(c.files, c.job, signal()), /Submission unresolved/);
  assert.equal(calls, attempted);
  assert.ok(before.attemptedStores >= attempted, 'Never-invoked reservations also conservatively consume attempt budget');
  assert.ok(Object.keys(before.pending).length);
});

test('journal binding rejects changed ciphertext, job scope, budget, account and network without further writes', async t => {
  const c = await fixture(t);
  await c.store.pin(c.files, c.job, signal());
  const count = c.transport.writes.length;
  const changed = c.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes) }));
  changed.find(f => f.path === '96/segment-000.bin')!.bytes[0] ^= 1;
  await assert.rejects(c.store.pin(changed, c.job, signal()), /identity, budget or pipeline changed/);
  await assert.rejects(
    createBulletinMediaStore({ ...c.options, budget: { ...budget, maxTransactions: 4095 } }).pin(c.files, c.job, signal()),
    /identity, budget or pipeline changed/
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
  c.transport.store = async (block, intent) => {
    const receipt = await store(block, intent);
    if (block.cid === c.graph.root) c.transport.stored.values().next().value!.receipt.expiresAt = c.transport.head + 50;
    return receipt;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /retention/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
});

test('unfinalized receipts and corrupt raw bytes cannot produce a ready directory', async t => {
  const c = await fixture(t);
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => ({ ...(await store(block, intent)), finalized: false }) as unknown as BulletinSubmissionReceipt;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /finalized|readback differs/i);
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
  const master = c.files.find(file => file.path === 'archive/master.bin')!.bytes;
  const archiveBlock = c.graph.blocks.find(block => block.codec === 0x55 && Buffer.from(block.bytes).equals(master));
  assert.ok(archiveBlock, 'Fixture archive must resolve to a raw block');
  assert.ok(!c.transport.reads.includes(archiveBlock.cid), 'Streaming must not read the archive raw block');
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

test('two writes overlap only after fsynced nonce intents; parents verify children and root is last', { timeout: 20000 }, async t => {
  const c = await fixture(t, 4, 4096);
  const gate = deferred(),
    entered = deferred();
  t.after(() => gate.resolve());
  const store = c.transport.store.bind(c.transport);
  let active = 0,
    peak = 0,
    bytes = 0,
    peakBytes = 0;
  const nonces: number[] = [];
  c.transport.store = async (block, intent) => {
    nonces.push(intent.nonce);
    const [journal, owner] = await Promise.all([readFile(join(c.directory, `${c.job}.json`), 'utf8'), readFile(join(c.directory, 'owner.json'), 'utf8')]);
    const state = JSON.parse(journal),
      account = JSON.parse(owner);
    assert.equal(state.pending[block.cid].nonce, intent.nonce);
    assert.ok(state.nextNonce > intent.nonce && account.nextNonce > intent.nonce);
    assert.equal(account.activeJob, c.job);
    active++;
    bytes += block.bytes.length;
    peak = Math.max(peak, active);
    peakBytes = Math.max(peakBytes, bytes);
    if (active === 2) entered.resolve();
    await gate.promise;
    if (block.codec === dagPB.code) {
      for (const link of dagPB.decode(block.bytes).Links) assert.ok(await c.transport.lookup(link.Hash.toString()), 'No unconfirmed child');
    }
    if (block.cid === c.graph.root) assert.equal(c.transport.stored.size, c.graph.blocks.length - 1);
    try {
      return await store(block, intent);
    } finally {
      active--;
      bytes -= block.bytes.length;
    }
  };
  const writing = c.store.pin(c.files, c.job, signal());
  await entered.promise;
  assert.equal(Object.keys((await c.store.inventory(c.job)).pending).length, 2);
  gate.resolve();
  await writing;
  assert.equal(peak, 2);
  assert.ok(peakBytes <= 512 * 1024);
  assert.deepEqual(
    nonces,
    c.graph.blocks.map((_, index) => 10 + index)
  );
  assert.equal(c.transport.writes.at(-1), c.graph.root);
});

test('out-of-order confirmation and a lost acknowledgement drain the sibling before failure, then resume', { timeout: 20000 }, async t => {
  const c = await fixture(t);
  const entered = deferred(),
    failed = deferred(),
    release = deferred();
  t.after(() => release.resolve());
  const store = c.transport.store.bind(c.transport);
  let calls = 0,
    settled = false;
  c.transport.store = async (block, intent) => {
    const index = calls++;
    if (index === 0) {
      await entered.promise;
      const receipt = await store(block, intent);
      failed.resolve();
      throw new Error(`Lost acknowledgement for ${receipt.nonce}`);
    }
    entered.resolve();
    await release.promise;
    return store(block, intent);
  };
  const writing = c.store.pin(c.files, c.job, signal()).finally(() => {
    settled = true;
  });
  const rejected = assert.rejects(writing, /Lost acknowledgement/);
  await failed.promise;
  await new Promise(r => setImmediate(r));
  assert.equal(settled, false);
  await assert.rejects(createBulletinMediaStore(c.options).pin(c.files, c.job, signal()), /EEXIST/);
  release.resolve();
  await rejected;
  assert.equal(calls, 2);
  const state = await c.store.inventory(c.job);
  assert.equal(Object.keys(state.pending).length, 1);
  assert.equal(Object.keys(state.receipts).length, 1);
  c.transport.store = store;
  await createBulletinMediaStore(c.options).pin(c.files, c.job, signal());
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  assert.equal(new Set(c.transport.writes).size, c.graph.blocks.length);
  assert.equal(new Set(c.transport.submissions.keys()).size, c.graph.blocks.length);
});

test('a CID stored elsewhere cannot resolve our pending sender/nonce; stale or external nonce progress fails closed', async t => {
  const c = await fixture(t);
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => {
    await store(block, intent);
    throw new Error('Lost acknowledgement');
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Lost acknowledgement/);
  const state = await c.store.inventory(c.job);
  const calls = c.transport.writes.length;
  const lookup = c.transport.lookupSubmission.bind(c.transport);
  c.transport.lookupSubmission = async () => null;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Submission unresolved/);
  c.transport.lookupSubmission = async intent => ({ ...(await lookup(intent))!, account: 'other-sender' });
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /identity mismatch/);
  c.transport.lookupSubmission = lookup;
  c.transport.nonce++;
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /nonce differs/);
  assert.equal(c.transport.writes.length, calls);
  assert.ok(Object.keys(state.pending).length);
  const d = await fixture(t);
  d.transport.nextNonce = async () => ({ nonce: 10, head: d.transport.head - 1 });
  await assert.rejects(d.store.pin(d.files, d.job, signal()), /stale/);
  assert.equal(d.transport.writes.length, 0);
});

test('account cursor rejects reuse but accepts finalized DotNS progress between fully settled jobs', async t => {
  const c = await fixture(t);
  await c.store.pin(c.files, c.job, signal());
  const count = c.transport.writes.length;
  const changed = c.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes) }));
  changed.find(f => f.path === '96/segment-000.bin')!.bytes[0] ^= 1;
  c.transport.nonce--;
  const nextJob = `stream-${randomUUID()}`;
  await assert.rejects(c.store.pin(changed, nextJob, signal()), /nonce differs/);
  assert.equal(c.transport.writes.length, count);
  c.transport.nonce++;
  await c.store.pin(changed, nextJob, signal());
  assert.equal(c.transport.nonce, 10 + c.transport.writes.length);
  c.transport.nonce += 2; // Two finalized DotNS operations while no job is active.
  changed.find(f => f.path === '96/segment-001.bin')!.bytes[0] ^= 1;
  await c.store.pin(changed, `stream-${randomUUID()}`, signal());
  assert.equal(c.transport.nonce, 12 + c.transport.writes.length);
});

test('pipeline byte limits, immutable settings and nonce exhaustion reject before additional stores', async t => {
  const c = await fixture(t, 2, 4096);
  for (const pipeline of [{ concurrency: 0 }, { concurrency: 5 }, { maxInFlightBytes: 2 * 1024 * 1024 }]) {
    assert.throws(() => createBulletinMediaStore({ ...c.options, pipeline }));
  }
  await assert.rejects(createBulletinMediaStore({ ...c.options, pipeline: { maxInFlightBytes: 100 } }).pin(c.files, c.job, signal()), /in-flight/);
  assert.equal(c.transport.writes.length, 0);
  let active = 0,
    peak = 0;
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => {
    peak = Math.max(peak, ++active);
    await new Promise(r => setTimeout(r, 5));
    try {
      return await store(block, intent);
    } finally {
      active--;
    }
  };
  const cap = Math.max(...c.graph.blocks.map(b => b.bytes.length));
  await createBulletinMediaStore({ ...c.options, pipeline: { concurrency: 4, maxInFlightBytes: cap } }).pin(c.files, c.job, signal());
  assert.ok(peak < 4, 'Byte cap prevents four full-sized siblings');
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /pipeline changed/);
  const d = await fixture(t);
  d.transport.nonce = 0xffffffff;
  await assert.rejects(d.store.pin(d.files, d.job, signal()), /range exhausted/);
  assert.equal(d.transport.writes.length, 0);
});

test('cancellation with two in-flight stores keeps both nonces and blocks another job even after a late commit', { timeout: 20000 }, async t => {
  const c = await fixture(t);
  const entered = deferred(),
    release = deferred(),
    late = deferred();
  t.after(() => release.resolve());
  const store = c.transport.store.bind(c.transport);
  let calls = 0,
    done = 0;
  c.transport.store = async (block, intent) => {
    if (++calls === 2) entered.resolve();
    await release.promise; // Model an uncooperative, already-broadcast transport.
    const result = await store(block, intent);
    if (++done === 2) late.resolve();
    return result;
  };
  const abort = new AbortController();
  const rejected = assert.rejects(c.store.pin(c.files, c.job, abort.signal), { name: 'AbortError' });
  await entered.promise;
  abort.abort();
  await rejected;
  const inventory = await c.store.inventory(c.job);
  assert.equal(Object.keys(inventory.pending).length, 2);
  await assert.rejects(c.store.pin(c.files, `stream-${randomUUID()}`, signal()), /needs reconciliation/);
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Submission unresolved/);
  release.resolve();
  await late.promise;
  assert.deepEqual((await c.store.inventory(c.job)).pending, inventory.pending, 'Late tasks do not mutate the journal');
  c.transport.store = store;
  await c.store.pin(c.files, c.job, signal());
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
});

test('failure while persisting a sibling intent stops admission and preserves conservative attempt accounting', { timeout: 20000 }, async t => {
  const c = await fixture(t);
  const paused = deferred(),
    release = deferred(),
    fail = deferred();
  t.after(() => {
    release.resolve();
    fail.resolve();
  });
  const original = fsPromises.open;
  let pausedOnce = false,
    calls = 0;
  const mock = t.mock.method(fsPromises, 'open', async (...args: Parameters<typeof fsPromises.open>) => {
    const handle = await original(...args);
    if (String(args[0]).startsWith(c.directory) && String(args[0]).endsWith('.tmp')) {
      const write = handle.writeFile.bind(handle);
      handle.writeFile = async (...values: Parameters<typeof handle.writeFile>) => {
        await write(...values);
        const data = JSON.parse(String(values[0]));
        if (!pausedOnce && data.pending && Object.values(data.pending).some(p => (p as { nonce: number }).nonce === 11)) {
          pausedOnce = true;
          paused.resolve();
          await release.promise;
        }
      };
    }
    return handle;
  });
  syncBuiltinESMExports();
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => {
    calls++;
    await fail.promise;
    await store(block, intent);
    throw new Error('First submission interrupted');
  };
  try {
    const rejected = assert.rejects(c.store.pin(c.files, c.job, signal()), /First submission interrupted/);
    await paused.promise;
    fail.resolve();
    await new Promise(r => setImmediate(r));
    release.resolve();
    await rejected;
    assert.equal(calls, 1, 'Never submit the reserved sibling after a known failure');
    const state = await c.store.inventory(c.job);
    assert.deepEqual(
      Object.values(state.pending).map(p => p.nonce),
      [10]
    );
    assert.equal(state.nextNonce, 11);
    assert.equal(state.attemptedStores, 2, 'The never-invoked reservation still consumes allowance');
    c.transport.store = store;
    await c.store.pin(c.files, c.job, signal());
    assert.equal(c.transport.writes.length, c.graph.blocks.length);
  } finally {
    mock.mock.restore();
    syncBuiltinESMExports();
  }
});

test('a fresh process resolves multiple pending nonces and continues without duplicate remote stores', { timeout: 30000 }, async t => {
  const c = await fixture(t);
  const store = c.transport.store.bind(c.transport),
    entered = deferred();
  let calls = 0;
  c.transport.store = async (block, intent) => {
    if (++calls === 1) await entered.promise;
    else entered.resolve();
    await store(block, intent);
    throw new Error('Lost acknowledgement');
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Lost acknowledgement/);
  assert.equal(Object.keys((await c.store.inventory(c.job)).pending).length, 2);
  const snapshot = join(c.root, 'remote-model.json');
  await writeFile(
    snapshot,
    JSON.stringify({
      head: c.transport.head,
      nonce: c.transport.nonce,
      authorization: c.transport.authorization,
      submissions: [...c.transport.submissions],
      writes: c.transport.writes,
      stored: [...c.transport.stored].map(([cid, entry]) => [cid, { receipt: entry.receipt, bytes: Buffer.from(entry.block.bytes).toString('base64') }]),
      files: c.files.map(file => ({ path: file.path, bytes: Buffer.from(file.bytes).toString('base64') }))
    })
  );
  const result = execFileSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { createBulletinMediaStore } from ${JSON.stringify(new URL('./bulletinMedia.ts', import.meta.url).href)};
    globalThis.fetch = () => { throw new Error('Network forbidden in offline model'); };
    const model = JSON.parse(await readFile(process.argv[1], 'utf8'));
    const blocks = new Map(model.stored), submissions = new Map(model.submissions);
    const transport = {
      ...${JSON.stringify(identity)},
      async status() { return { head: model.head, authorization: model.authorization }; },
      async nextNonce() { return { nonce: model.nonce, head: model.head }; },
      async lookupSubmission({ nonce }) { return submissions.get(nonce) ?? null; },
      async lookup(cid) { return blocks.get(cid)?.receipt ?? null; },
      async readBlock(cid) { return Buffer.from(blocks.get(cid).bytes, 'base64'); },
      async store(block, { nonce }) {
        assert.ok(!submissions.has(nonce) && !blocks.has(block.cid), 'No repeated nonce or CID');
        model.head++;
        const receipt = { cid: block.cid, bytes: block.bytes.length, block: model.head, index: model.writes.length, expiresAt: model.head + 50000, finalized: true };
        model.writes.push(block.cid);
        blocks.set(block.cid, { receipt, bytes: Buffer.from(block.bytes).toString('base64') });
        const result = { ...receipt, nonce, account: this.account };
        submissions.set(nonce, result);
        while (submissions.has(model.nonce)) model.nonce++;
        model.authorization.remainingTransactions--;
        model.authorization.remainingBytes -= block.bytes.length;
        return result;
      }
    };
    const store = createBulletinMediaStore({ directory: process.argv[2], identity: ${JSON.stringify(identity)}, transport, budget: ${JSON.stringify(budget)} });
    const root = await store.pin(model.files.map(f => ({ ...f, bytes: Buffer.from(f.bytes, 'base64') })), process.argv[3], new AbortController().signal);
    const inventory = await store.inventory(process.argv[3]);
    console.log(JSON.stringify({ root, ready: inventory.ready, writes: model.writes.length, unique: new Set(model.writes).size, nonce: model.nonce }));
  `,
      snapshot,
      c.directory,
      c.job
    ],
    { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 20000 }
  );
  assert.deepEqual(JSON.parse(result), {
    root: c.graph.root,
    ready: true,
    writes: c.graph.blocks.length,
    unique: c.graph.blocks.length,
    nonce: 10 + c.graph.blocks.length
  });
});

test('a failed journal rename drains started writes and keeps the unsent nonce conservative', { timeout: 20000 }, async t => {
  const c = await fixture(t),
    entered = deferred(),
    release = deferred(),
    failedSave = deferred();
  t.after(() => release.resolve());
  const originalRename = fsPromises.rename;
  let injected = false,
    calls = 0,
    settled = false;
  const mock = t.mock.method(fsPromises, 'rename', async (...args: Parameters<typeof fsPromises.rename>) => {
    const [from, to] = args;
    if (!injected && String(to) === join(c.directory, `${c.job}.json`)) {
      const state = JSON.parse(await readFile(from, 'utf8'));
      if (Object.values(state.pending).some(p => (p as { nonce: number }).nonce === 11)) {
        injected = true;
        failedSave.resolve();
        throw new Error('Disk rename failed');
      }
    }
    return originalRename(from, to);
  });
  syncBuiltinESMExports();
  const store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => {
    calls++;
    entered.resolve();
    await release.promise;
    return store(block, intent);
  };
  try {
    const writing = c.store.pin(c.files, c.job, signal()).finally(() => {
      settled = true;
    });
    const rejected = assert.rejects(writing, /Disk rename failed/);
    await entered.promise;
    await failedSave.promise;
    assert.equal(settled, false);
    await assert.rejects(c.store.pin(c.files, c.job, signal()), /EEXIST/);
    release.resolve();
    await rejected;
    assert.equal(calls, 1);
    assert.equal((await c.store.inventory(c.job)).nextNonce, 12);
    await assert.rejects(c.store.pin(c.files, c.job, signal()), /Submission unresolved/);
    assert.ok(!c.transport.stored.has(c.graph.root));
  } finally {
    mock.mock.restore();
    syncBuiltinESMExports();
  }
});

test('null failures and duplicate or malformed nonce journals never authorize a retry', async t => {
  const c = await fixture(t);
  c.transport.store = async () => {
    throw null;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Unknown Bulletin publication failure/);
  const file = join(c.directory, `${c.job}.json`);
  const state = JSON.parse(await readFile(file, 'utf8'));
  const nonce = Object.values(state.pending)[0] as { nonce: number };
  const another = c.graph.blocks.find(block => !state.pending[block.cid])!;
  state.pending[another.cid] = { ...nonce };
  await writeFile(file, JSON.stringify(state));
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Duplicate pending nonce/);
});

test('v1 inventories are preserved and rejected rather than silently reset or upgraded', async t => {
  const c = await fixture(t);
  const file = join(c.directory, 'owner.json');
  const old = JSON.parse(await readFile(file, 'utf8'));
  old.schema = 'dotify.bulletin.media-owner.v1';
  delete old.nextNonce;
  const bytes = JSON.stringify(old);
  await writeFile(file, bytes);
  await assert.rejects(c.store.pin(c.files, c.job, signal()));
  await assert.rejects(initializeBulletinMediaStore(c.directory, identity), /EEXIST/);
  assert.equal(await readFile(file, 'utf8'), bytes);
  assert.equal(c.transport.writes.length, 0);
});

test('later nonce confirmation may finish first without admitting a parent or reusing its sequence number', { timeout: 20000 }, async t => {
  const c = await fixture(t),
    second = deferred();
  const store = c.transport.store.bind(c.transport);
  let calls = 0;
  c.transport.store = async (block, intent) => {
    const index = calls++;
    if (index === 0) await second.promise;
    const result = await store(block, intent);
    if (index === 1) {
      assert.equal(c.transport.nonce, 10, 'A later nonce cannot consume the missing earlier nonce');
      assert.equal(calls, 2, 'No next wave before both results are verified');
      assert.ok(!c.transport.stored.has(c.graph.root));
      second.resolve();
    }
    return result;
  };
  await c.store.pin(c.files, c.job, signal());
  assert.equal(c.transport.nonce, 10 + c.graph.blocks.length);
  assert.equal(c.transport.writes.at(-1), c.graph.root);
});

test('read-only recovery can finish a fully committed graph but cannot publish missing blocks', async t => {
  const c = await fixture(t),
    store = c.transport.store.bind(c.transport);
  c.transport.store = async (block, intent) => {
    const result = await store(block, intent);
    if (block.cid === c.graph.root) throw new Error('Root acknowledgement lost');
    return result;
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /Root acknowledgement lost/);
  c.transport.writable = false;
  c.transport.store = async () => {
    throw new Error('No signing in read-only mode');
  };
  await c.store.pin(c.files, c.job, signal());
  assert.equal((await c.store.inventory(c.job)).ready, true);
  assert.equal(c.transport.writes.length, c.graph.blocks.length);
  const d = await fixture(t);
  d.transport.writable = false;
  await assert.rejects(d.store.pin(d.files, d.job, signal()), /read-only/);
  assert.equal(d.transport.writes.length, 0);
});

test('exact allowance covers a bounded pipeline; changing quota halts before another wave', async t => {
  const c = await fixture(t);
  c.transport.authorization.remainingTransactions = 2 * c.graph.blocks.length;
  c.transport.authorization.remainingBytes = c.graph.bytes;
  c.transport.authorization.remainingRenewBytes = c.graph.bytes;
  await c.store.pin(c.files, c.job, signal());
  assert.equal(c.transport.authorization.remainingTransactions, c.graph.blocks.length);
  assert.equal(c.transport.authorization.remainingBytes, 0);
  const d = await fixture(t),
    store = d.transport.store.bind(d.transport);
  d.transport.store = async (block, intent) => {
    const result = await store(block, intent);
    d.transport.authorization.remainingTransactions = d.graph.blocks.length;
    return result;
  };
  await assert.rejects(d.store.pin(d.files, d.job, signal()), /quota/);
  assert.ok(d.transport.writes.length <= 2);
  assert.ok(!d.transport.stored.has(d.graph.root));
});

test('the last nonce observation cannot advance readiness past child retention expiry', async t => {
  const c = await fixture(t),
    nonce = c.transport.nextNonce.bind(c.transport);
  c.transport.nextNonce = async () => {
    if (c.transport.stored.size === c.graph.blocks.length) c.transport.head += 60000;
    return nonce();
  };
  await assert.rejects(c.store.pin(c.files, c.job, signal()), /retention/);
  assert.equal((await c.store.inventory(c.job)).ready, false);
});
