import assert from 'node:assert/strict';
import test from 'node:test';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { fixture, codecs, rpcFixture } from './bulletinTransport.fixture.js';
import { bulletinHex } from './bulletinReceipt.js';
import { readBulletinConservation } from './bulletinConservationRpc.js';
import { assessBulletinConservation, type ConservationPlan } from './bulletinConservation.js';
import type { BulletinRpc } from './bulletinTransport.js';

const signal = () => new AbortController().signal;
function plan(): ConservationPlan {
  return {
    schema: 'dotify.bulletin.conservation-plan.v1',
    identity: fixture.identity,
    retainedReserve: { transactions: 10, bytes: '2000' },
    warningBlocks: 500,
    criticalBlocks: 100,
    sources: [{ id: 'audio:marker', kind: 'audio', root: fixture.query.cid, blocks: [{ cid: fixture.query.cid, bytes: 117 }] }]
  };
}
test('captured runtime reads one finalized head, with no signing, nonce, payload or write RPC', async () => {
  const f = rpcFixture(),
    input = plan();
  input.sources.push({ ...input.sources[0], id: 'diagnostic:shared' });
  const state = await readBulletinConservation(input, f.request, signal());
  assert.equal(state.observations[fixture.query.cid].state, 'present');
  assert.equal(assessBulletinConservation(input, state).severity, 'ok');
  assert.equal(f.calls.filter(c => c.method === 'chain_getFinalizedHead').length, 1);
  assert.equal(f.calls.filter(c => c.method === 'state_getStorage').length, 3, 'Shared dependencies are read once');
  for (const c of f.calls) {
    assert.ok(['chain_getBlockHash', 'chain_getFinalizedHead', 'chain_getHeader', 'state_call', 'state_getStorage'].includes(c.method));
    if (c.method === 'state_getStorage' || c.method === 'state_call') assert.equal(c.params.at(-1), state.blockHash);
    if (c.method === 'state_call')
      assert.ok(['Metadata_metadata_at_version', 'BulletinTransactionStorageApi_account_authorization'].includes(String(c.params[0])));
  }
});
test('Product SHA-256 metadata and media BLAKE2b use explicit matching codec and hashing', async () => {
  const f = rpcFixture(),
    input = plan();
  const original = CID.parse(fixture.query.cid),
    cid = CID.createV1(0x70, create(0x12, original.multihash.digest)).toString();
  input.sources = [{ id: 'app:control', kind: 'application', root: cid, blocks: [{ cid, bytes: 700000 }] }];
  const entry = codecs.builder.buildStorage('TransactionStorage', 'Transactions');
  const key = entry.keys.enc(fixture.receipt.block),
    infos = entry.value.dec(Uint8Array.from(Buffer.from(f.state.values.get(key)!.slice(2), 'hex')));
  infos[0].hashing = { type: 'Sha2_256', value: undefined };
  infos[0].size = 700000;
  f.state.values.set(key, bulletinHex(entry.value.enc(infos)));
  const snapshot = await readBulletinConservation(input, f.request, signal());
  assert.equal(snapshot.observations[cid].state, 'present');
  assert.equal(assessBulletinConservation(input, snapshot).blocks[0].state, 'retained');
  infos[0].hashing = { type: 'Blake2b256', value: undefined };
  f.state.values.set(key, bulletinHex(entry.value.enc(infos)));
  assert.equal((await readBulletinConservation(input, f.request, signal())).observations[cid].state, 'unavailable');
  infos[0].hashing = { type: 'Sha2_256', value: undefined };
  infos[0].cid_codec = 0x55n;
  f.state.values.set(key, bulletinHex(entry.value.enc(infos)));
  assert.equal((await readBulletinConservation(input, f.request, signal())).observations[cid].state, 'unavailable');
});
test('expired authorization is reported rather than hidden behind an active-session preflight', async () => {
  const f = rpcFixture(),
    input = plan();
  const request: BulletinRpc = async (method, params, s) => {
    if (method === 'state_call' && params[0] === 'BulletinTransactionStorageApi_account_authorization') {
      const entry = codecs.builder.buildRuntimeCall('BulletinTransactionStorageApi', 'account_authorization');
      return bulletinHex(
        entry.value.enc({
          expires_at: f.state.head,
          transactions_allowance: 300,
          transactions_used: 10,
          bytes_allowance: 20000000n,
          bytes_used: 1000n,
          bytes_permanent_used: 2000n
        })
      );
    }
    return f.request(method, params, s);
  };
  const report = assessBulletinConservation(input, await readBulletinConservation(input, request, signal()));
  assert.equal(report.accountExpiry, f.state.head);
  assert.equal(report.accountSeverity, 'critical');
  assert.equal(report.blocks[0].state, 'retained');
});
test('missing and failed reads stay distinguishable, and corrupt permission is critical', async () => {
  const f = rpcFixture(),
    input = plan();
  const position = codecs.builder
    .buildStorage('TransactionStorage', 'TransactionByContentHash')
    .keys.enc(bulletinHex(CID.parse(fixture.query.cid).multihash.digest));
  f.state.values.delete(position);
  assert.equal((await readBulletinConservation(input, f.request, signal())).observations[fixture.query.cid].state, 'missing');
  const failed: BulletinRpc = (method, params, s) => {
    if (
      (method === 'state_getStorage' && params[0] === position) ||
      (method === 'state_call' && params[0] === 'BulletinTransactionStorageApi_account_authorization')
    )
      throw new Error('private provider detail');
    return f.request(method, params, s);
  };
  const state = await readBulletinConservation(input, failed, signal());
  assert.equal(state.authorization, null);
  assert.equal(state.observations[fixture.query.cid].state, 'unavailable');
  assert.equal(assessBulletinConservation(input, state).severity, 'critical');
  assert.ok(!JSON.stringify(state).includes('private provider detail'));
});
test('wrong genesis and missing runtime metadata abort before a misleading partial report', async () => {
  const f = rpcFixture();
  f.state.genesis = '0x' + 'ff'.repeat(32);
  await assert.rejects(readBulletinConservation(plan(), f.request, signal()), /genesis/);
  assert.equal(f.calls.length, 1);
  const missing = rpcFixture();
  await assert.rejects(
    readBulletinConservation(plan(), (m, p, s) => (m === 'state_call' ? Promise.resolve('0x00') : missing.request(m, p, s)), signal()),
    /metadata/
  );
});
test('caller cancellation settles a non-cooperative RPC without a healthy report', async () => {
  const controller = new AbortController();
  const result = assert.rejects(
    readBulletinConservation(plan(), () => new Promise(() => {}), controller.signal),
    { name: 'AbortError' }
  );
  controller.abort();
  await result;
});
