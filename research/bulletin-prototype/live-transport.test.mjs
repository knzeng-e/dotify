import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StoreBuilder } from '@parity/bulletin-sdk';
import { GENESIS, buildDirectory } from './graph.mjs';
import { liveTransport, CANARY_ACCOUNT, authorization } from './live-transport.mjs';
import { prepare, loadFixture, withLease, verifyFiles, localSigner } from './canary.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { publish } from './publication.mjs';

const rawAuth = () => ({ expires_at: 20_000, transactions_used: 8, transactions_allowance: 100, bytes_used: 100n, bytes_allowance: 1_000_000n, bytes_permanent_used: 50n });
async function fake() {
  const graph = await buildDirectory([{ path: 'manifest.json', bytes: Buffer.from('synthetic') }]);
  const block = graph.blocks[0];
  let genesis = GENESIS, auth = rawAuth(), position = [100, 0];
  let info = { content_hash: `0x${Buffer.from((await import('multiformats/cid')).CID.parse(block.cid).multihash.digest).toString('hex')}`, hashing: { type: 'Sha2_256' }, cid_codec: BigInt(block.codec), size: block.bytes.length };
  let rpcBytes = `0x${Buffer.from(block.bytes).toString('hex')}`;
  let releases = 0;
  const calls = [], writes = [], renewals = [];
  const query = fn => ({ getValue: async (...args) => { calls.push(args); return fn(...args); } });
  const client = {
    getFinalizedBlock: async () => ({ number: 200, hash: 'finalized-test-hash' }),
    hodlBlock: () => () => releases++,
    getUnsafeApi: () => ({ apis: { BulletinTransactionStorageApi: { account_authorization: async (...args) => { calls.push(args); return auth; } } }, query: {
      System: { BlockHash: query(() => genesis) },
      TransactionStorage: {
        Authorizations: query(() => auth), TransactionByContentHash: query(() => position),
        Transactions: query(() => [info]), RetentionPeriod: query(() => 1000)
      }
    } }),
    _request: async (method, params) => { assert.equal(method, 'bitswap_v1_get'); assert.deepEqual(params, [block.cid]); return rpcBytes; }
  };
  const sdk = {
    store: bytes => new StoreBuilder({ storeWithOptions: async (_data, opts) => {
      writes.push(bytes); assert.equal(opts.waitFor, 'finalized');
      return { cid: (await import('multiformats/cid')).CID.parse(block.cid), size: bytes.length, blockNumber: 100, extrinsicIndex: 0 };
    } }, bytes),
    forceRenew: ref => ({ withWaitFor: finality => ({ send: async () => { assert.equal(finality, 'finalized'); renewals.push(ref); } }) })
  };
  return { block, client, sdk, calls, writes, renewals, get releases() { return releases; },
    set genesis(v) { genesis = v; }, set auth(v) { auth = v; }, set position(v) { position = v; },
    set info(v) { info = { ...info, ...v }; }, set rpcBytes(v) { rpcBytes = v; } };
}

test('live quota subtracts consumed counters and rejects absent/expired/unknown authorization', () => {
  assert.deepEqual(authorization(rawAuth(), 200), { expiresAt: 20_000, remainingTransactions: 92, remainingBytes: 999900n, remainingRenewBytes: 999950n });
  for (const auth of [null, { ...rawAuth(), expires_at: 250 }, { expires_at: 20_000 }]) assert.throws(() => authorization(auth, 200));
  const bad = rawAuth(); bad.bytes_used = 2_000_000n;
  assert.throws(() => authorization(bad, 200), /Invalid byte counters/);
});

test('live lookups bind hash, codec, size and retention to one pinned finalized snapshot', async () => {
  const f = await fake();
  const t = liveTransport(f.client, null, CANARY_ACCOUNT);
  const r = await t.lookup(f.block.cid);
  assert.deepEqual(r, { cid: f.block.cid, bytes: f.block.bytes.length, block: 100, index: 0, expiresAt: 1100, finalized: true });
  assert.ok(f.calls.every(args => args.at(-1).at === 'finalized-test-hash'));
  assert.equal(f.releases, 1);
  f.info = { cid_codec: 999n };
  await assert.rejects(t.lookup(f.block.cid), /different codec/);
  assert.equal(f.releases, 2);
  f.position = [201, 0]; await assert.rejects(t.lookup(f.block.cid), /not finalized/);
  f.position = null; assert.equal(await t.lookup(f.block.cid), null);
  f.genesis = 'wrong'; await assert.rejects(t.status(), /Wrong Bulletin/);
  assert.equal(f.writes.length, 0);
});

test('raw RPC errors and corrupt bytes cannot become valid reads or trigger a fallback write', async () => {
  const f = await fake(); const t = liveTransport(f.client, null, CANARY_ACCOUNT);
  assert.deepEqual(await t.readBlock(f.block.cid), Buffer.from(f.block.bytes));
  for (const encoded of ['0x00', 'not-hex', null, `0x${'ab'.repeat(512 * 1024 + 1)}`]) {
    f.rpcBytes = encoded; await assert.rejects(t.readBlock(f.block.cid));
  }
  assert.equal(t.reads.length, 1); assert.equal(f.writes.length, 0);
});

test('writes require matching owner and live quota; renewal is explicit immediate finalized renewal', async () => {
  const f = await fake();
  assert.throws(() => liveTransport(f.client, f.sdk, 'another-account'), /owner-selected/);
  const readOnly = liveTransport(f.client, null, CANARY_ACCOUNT);
  await assert.rejects(readOnly.store(f.block), /local signer/);
  const t = liveTransport(f.client, f.sdk, CANARY_ACCOUNT);
  await t.store(f.block);
  const r = await t.lookup(f.block.cid);
  await t.requestRenewal(r);
  assert.deepEqual(f.renewals, [{ block: 100, index: 0 }]);
  f.auth = { ...rawAuth(), transactions_used: 100 };
  await assert.rejects(t.store(f.block), /quota exhausted/);
  assert.equal(f.writes.length, 1); assert.equal(t.attemptedTransactions, 2);
});

test('read timeouts release the pinned snapshot and never submit', async () => {
  const f = await fake(); f.client.getFinalizedBlock = () => new Promise(() => {});
  const t = liveTransport(f.client, f.sdk, CANARY_ACCOUNT, { timeoutMs: 5 });
  await assert.rejects(t.status(), /timed out/); assert.equal(f.writes.length, 0);
});

test('canary persists ciphertext once, excludes the master from reads, and refuses concurrent operators', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-live-canary-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const directory = join(parent, 'run');
  const result = await prepare(directory);
  assert.equal(result.blocks, 19); assert.equal(result.prospectiveTransactions, 38);
  await assert.rejects(prepare(directory), /EEXIST/);
  const fixture = await loadFixture(directory);
  const chain = new SimulatedChain();
  const readBlock = chain.readBlock.bind(chain);
  chain.readBlock = async cid => { const bytes = await readBlock(cid); return bytes; };
  await publish(fixture.graph, chain, join(directory, 'checkpoint'), { maxBytes: 1024 * 1024, maxTransactions: 40 });
  // Adapt the read observation format only; transport data still comes from the fake remote.
  const observed = { reads: [], readBlock: async cid => { const bytes = await chain.readBlock(cid); observed.reads.push({ cid, bytes: bytes.length }); return bytes; } };
  const key = await readFile(join(directory, 'key.bin'));
  try {
    const verified = await verifyFiles(observed, fixture, key);
    assert.equal(verified.verifiedObjects, 9); assert.equal(verified.startupBytes, 28767);
    assert.equal(verified.masterFetched, false); assert.equal(verified.audibleStartupMeasured, false);
  } finally { key.fill(0); }
  await withLease(directory, async () => {
    await assert.rejects(withLease(directory, async () => assert.fail('Must not run')), /EEXIST/);
  });
  await withLease(directory, async () => {});
});

test('local signing requires a private descriptor, refuses invalid input and never substitutes a dev signer', async t => {
  for (const fd of [undefined, NaN, 0, 1, 2]) assert.throws(() => localSigner(fd), /signer-fd/);
  const parent = await mkdtemp(join(tmpdir(), 'dotify-signer-refusal-')); t.after(() => rm(parent, { recursive: true, force: true }));
  const path = join(parent, 'invalid-input'); writeFileSync(path, 'invalid-input', { mode: 0o600 });
  const fd = openSync(path, 'r');
  try { assert.throws(() => localSigner(fd), /Invalid local signer input/); }
  finally { closeSync(fd); }
});

test('direct Node invocation receives the explicit signer pipe across a real shell process', () => {
  const program = "import {localSigner} from './canary.mjs'; try {localSigner(3);process.exitCode=2} catch(e) {console.log(e.message);process.exitCode=1}";
  // Public invalid input exercises the exact descriptor handoff without a key
  // or network connection. Do not wrap this in npm, which drops extra FDs.
  const result = spawnSync('/bin/bash', ['-c', 'exec "$1" --import tsx --input-type=module -e "$2" 3< <(printf %s invalid-input)', 'canary-test', process.execPath, program], {
    cwd: fileURLToPath(new URL('.', import.meta.url)), encoding: 'utf8', timeout: 20_000
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout.trim(), 'Invalid local signer input');
  assert.equal(result.stderr, '');
});
