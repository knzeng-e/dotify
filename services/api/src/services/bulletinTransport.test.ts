import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactNumber } from '@polkadot-api/substrate-bindings';
import { createBulletinRpcTransport } from './bulletinTransport.js';
import { bulletinBytes, verifyBulletinSubmission } from './bulletinReceipt.js';
import { fixture, codecs, proof, rpcFixture } from './bulletinTransport.fixture.js';
const signal = () => new AbortController().signal;

test('captured public marker binds sender/nonce/direct payload and the storage event, not the extrinsic index', () => {
  const input = proof();
  delete input.receipt.account;
  delete input.receipt.nonce;
  assert.deepEqual(verifyBulletinSubmission(input), fixture.receipt);
  assert.equal(codecs.decodeSigned(input.extrinsics[2])!.nonce, 927);
  assert.equal(fixture.receipt.index, 0, 'Storage index and extrinsic index differ in the real fixture');
  assert.equal(fixture.networkWrites, 0);
  assert.equal(fixture.signerUsed, false);
});

test('a different sender or nonce never inherits an existing CID receipt', () => {
  const input = proof();
  assert.equal(verifyBulletinSubmission({ ...input, query: { ...input.query, nonce: 928 } }), null);
  assert.equal(verifyBulletinSubmission({ ...input, account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }), null);
});

test('corrupt payload, changed storage index/hash, failed or misattributed events cannot prove publication', () => {
  const input = proof();
  const corrupt = input.extrinsics.map((bytes: Uint8Array) => Uint8Array.from(bytes));
  corrupt[2][corrupt[2].length - 1] ^= 1;
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: corrupt }));
  assert.throws(() => verifyBulletinSubmission({ ...input, receipt: { ...input.receipt, index: 2 } }), /Storage index/);
  const eventCodec = codecs.builder.buildStorage('System', 'Events').value;
  for (const change of [
    (rows: any[]) => rows.filter(row => row.event.type !== 'System' || row.event.value.type !== 'ExtrinsicSuccess'),
    (rows: any[]) =>
      rows.map(row => ({ ...row, phase: row.phase.type === 'ApplyExtrinsic' && row.phase.value === 2 ? { type: 'ApplyExtrinsic', value: 1 } : row.phase })),
    (rows: any[]) => rows.flatMap(row => (row.event.type === 'TransactionStorage' ? [row, row] : [row])),
    (rows: any[]) =>
      rows.map(row =>
        row.event.type === 'TransactionStorage'
          ? { ...row, event: { ...row.event, value: { ...row.event.value, value: { ...row.event.value.value, content_hash: `0x${'00'.repeat(32)}` } } } }
          : row
      )
  ]) {
    const rows = change(codecs.decodeEvents(input.events));
    assert.throws(() => verifyBulletinSubmission({ ...input, events: eventCodec.enc(rows) }));
  }
  assert.throws(() => verifyBulletinSubmission({ ...input, query: { ...input.query, afterBlock: fixture.receipt.block } }), /predates/);
});

test('pooled Buffer views, trailing bytes and duplicate signed nonce records are handled safely', () => {
  const input = proof();
  const pooled = Buffer.allocUnsafe(input.extrinsics[2].length + 16);
  pooled.set(input.extrinsics[2], 8);
  assert.equal(codecs.decodeSigned(pooled.subarray(8, -8))!.nonce, 927);
  assert.throws(() => codecs.decodeSigned(Uint8Array.from([...input.extrinsics[2], 0])), /length|encoding/);
  assert.throws(() => codecs.decodeEvents(Uint8Array.from([...input.events, 0])), /encoding/);
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: [...input.extrinsics, input.extrinsics[2]] }), /Duplicate/);
});

test('RPC transport verifies the captured receipt using one canonical candidate block and parent metadata', async () => {
  const f = rpcFixture();
  assert.deepEqual(await f.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(f.calls.filter(c => c.method === 'chain_getBlock').length, 1);
  assert.ok(f.calls.some(c => c.method === 'state_call' && c.params[0] === 'Metadata_metadata_at_version' && c.params[2] === fixture.header.parentHash));
  assert.equal(f.transport.writable, false);
  await assert.rejects(
    f.transport.store({ cid: fixture.query.cid, bytes: bulletinBytes(fixture.raw, 512), codec: 0x70 }, fixture.query, signal()),
    /read-only/
  );
  const status = await f.transport.status(signal());
  assert.equal(status.authorization.remainingTransactions, 290);
  assert.equal(status.authorization.remainingBytes, 19999000n);
  assert.deepEqual(await f.transport.nextNonce(signal()), { head: f.state.head, nonce: 928 });
  assert.deepEqual(await f.transport.readBlock(fixture.query.cid, signal()), bulletinBytes(fixture.raw, 512));
});

test('wrong genesis, candidate header/body disagreement and stale or missing CID metadata fail closed', async () => {
  const a = rpcFixture();
  a.state.genesis = `0x${'ff'.repeat(32)}`;
  await assert.rejects(a.transport.status(signal()), /genesis/);
  assert.ok(!a.calls.some(c => c.method === 'state_call'));
  const b = rpcFixture();
  b.state.body.block.header.number = '0x1';
  await assert.rejects(b.transport.lookupSubmission(fixture.query, signal()), /number mismatch/);
  const c = rpcFixture();
  c.state.header.parentHash = `0x${'77'.repeat(32)}`;
  await assert.rejects(c.transport.lookupSubmission(fixture.query, signal()), /parent mismatch/);
  const d = rpcFixture();
  d.state.values.clear();
  assert.equal(await d.transport.lookupSubmission(fixture.query, signal()), null);
  const e = rpcFixture();
  assert.equal(await e.transport.lookupSubmission({ ...fixture.query, afterBlock: fixture.receipt.block }, signal()), null);
  assert.ok(!e.calls.some(c => c.method === 'chain_getBlock'));
});

test('RPC reads bound raw bytes, block size, cancellation and unrecognized encodings', async () => {
  const f = rpcFixture();
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(f.transport.status(abort.signal), { name: 'AbortError' });
  assert.equal(f.calls.length, 0);
  const hung = createBulletinRpcTransport({ identity: fixture.identity, request: () => new Promise(() => {}) });
  const controller = new AbortController();
  const result = assert.rejects(hung.status(controller.signal), { name: 'AbortError' });
  controller.abort();
  await result;
  const large = rpcFixture();
  large.state.body.block.extrinsics = ['0x' + '00'.repeat(8 * 1024 * 1024 + 1)];
  await assert.rejects(large.transport.lookupSubmission(fixture.query, signal()), /bound/);
  const corrupt = createBulletinRpcTransport({
    identity: fixture.identity,
    request: (method, params, s) => (method === 'bitswap_v1_get' ? Promise.resolve('0x00') : f.request(method, params, s))
  });
  await assert.rejects(corrupt.readBlock(fixture.query.cid, signal()), /CID does not match/);
});

test('wrapped stores and nonce-reused unrelated calls cannot masquerade as a direct store', () => {
  const input = proof();
  const decoded = codecs.decodeSigned(input.extrinsics[2])!;
  const direct = codecs.builder.buildCall('TransactionStorage', 'store_with_cid_config');
  const args = (decoded.call as { value: { value: unknown } }).value.value;
  const callBytes = Uint8Array.from([...direct.location, ...direct.codec.enc(args)]);
  const encoded = input.extrinsics[2];
  assert.deepEqual(encoded.slice(-callBytes.length), callBytes);
  const batch = codecs.builder.buildCall('Utility', 'batch');
  const wrapped = Uint8Array.from([...batch.location, ...batch.codec.enc({ calls: [decoded.call] })]);
  const prefixBytes = compactNumber.enc(compactNumber.dec(encoded)).length;
  const payload = Uint8Array.from([...encoded.slice(prefixBytes, -callBytes.length), ...wrapped]);
  const replacement = Uint8Array.from([...compactNumber.enc(payload.length), ...payload]);
  assert.throws(() => verifyBulletinSubmission({ ...input, extrinsics: [...input.extrinsics.slice(0, 2), replacement] }));
});

test('event count and missing metadata are refused before unbounded decoding', async () => {
  assert.throws(() => codecs.decodeEvents(compactNumber.enc(8193)), /Too many/);
  const f = rpcFixture();
  const missing = createBulletinRpcTransport({
    identity: fixture.identity,
    request: (method, params, s) =>
      method === 'state_call' && params[0] === 'Metadata_metadata_at_version' ? Promise.resolve('0x00') : f.request(method, params, s)
  });
  await assert.rejects(missing.nextNonce(signal()), /no metadata/);
});

test('a stale proxy body with the same height/parent but different roots is not a canonical receipt', async () => {
  for (const field of ['stateRoot', 'extrinsicsRoot']) {
    const f = rpcFixture();
    f.state.body.block.header[field] = `0x${'77'.repeat(32)}`;
    await assert.rejects(f.transport.lookupSubmission(fixture.query, signal()), /header differs/);
  }
});
