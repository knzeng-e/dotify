import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { StoreBuilder, HashAlgorithm, AsyncBulletinClient } from '@parity/bulletin-sdk';
import { hashBytes, SHA256, BLAKE2B256, runtimeHashName } from './hashes.mjs';
import { addressingFixture, validateAddressingFixture, verifyAddressing, ADDRESSING_BUDGET } from './addressing.mjs';
import { addressingCases, readAddressingCase } from './addressing-reader.mjs';
import { verifyBlock } from './reader.mjs';
import { sdkBlockStore } from './sdk-store.mjs';
import { prepare, loadFixture } from './canary.mjs';
import { SimulatedChain } from './simulated-chain.mjs';
import { publish } from './publication.mjs';

test('fixed public marker separates hash algorithms while preserving payload and bounded graph', async () => {
  const f = await addressingFixture();
  await validateAddressingFixture(f);
  assert.equal(f.graph.blocks.length, 3);
  assert.ok(f.graph.bytes <= 2048);
  assert.notEqual(f.graph.blocks[0].cid, f.graph.blocks[1].cid);
  assert.deepEqual(f.graph.blocks[0].bytes, f.graph.blocks[1].bytes);
  const blocks = new Map(f.graph.blocks.map(b => [b.cid, b.bytes]));
  const session = { schema: 'dotify.bulletin.addressing.v1', ...f.addressingProof };
  for (const item of addressingCases(session)) await readAddressingCase(cid => blocks.get(cid), session, item);
  const t = { reads: [], readBlock: async cid => { const bytes = blocks.get(cid); t.reads.push({ bytes: bytes.length }); return bytes; } };
  assert.deepEqual((await verifyAddressing(t, f)).verifiedPaths, ['sha256.txt', 'blake2b.txt']);
  assert.throws(() => addressingCases({ ...session, blake2bRawCid: session.sha256RawCid }), /Unexpected addressing CID/);
  assert.throws(() => addressingCases({ ...session, payloadBytes: 1e9 }), /Invalid addressing session/);
  await assert.rejects(readAddressingCase(cid => blocks.get(cid), session, { name: 'unapproved' }), /Unknown addressing case/);
  await assert.rejects(readAddressingCase(cid => blocks.get(cid), { ...session, payloadSha256: '0'.repeat(64) }, addressingCases(session)[0]), /payload differs/);
});

test('both supported hashes fail closed on corrupt blocks, other algorithms and digest sizes', async () => {
  const f = await addressingFixture();
  for (const b of f.graph.blocks) {
    await verifyBlock(b.cid, b.bytes);
    const corrupt = Buffer.from(b.bytes); corrupt[0] ^= 1;
    await assert.rejects(verifyBlock(b.cid, corrupt), /does not match/);
  }
  for (const code of [0x13, 0xb240, 0]) {
    assert.throws(() => runtimeHashName(code), /Only SHA-256 and BLAKE2b-256/);
    await assert.rejects(verifyBlock(CID.createV1(0x55, create(code, new Uint8Array(32))).toString(), Buffer.from('a')));
  }
  await assert.rejects(verifyBlock(CID.createV1(0x55, create(BLAKE2B256, new Uint8Array(31))).toString(), Buffer.from('a')), /256-bit/);
  // Fixed standard BLAKE2b-256 empty-input vector (digest length is a parameter, not truncation).
  assert.equal(Buffer.from((await hashBytes(BLAKE2B256, new Uint8Array())).digest).toString('hex'), '0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8');
  await assert.rejects(validateAddressingFixture({ ...f, addressingProof: { ...f.addressingProof, kind: 'audio' } }), /proof changed/);
  await assert.rejects(validateAddressingFixture({ ...f, graph: { ...f.graph, bytes: 1 } }), /accounting mismatch/);
});

test('actual SDK builder preserves SHA and BLAKE raw/directory codec, hash and finalized coordinates', async () => {
  const f = await addressingFixture();
  for (const block of f.graph.blocks) {
    const cid = CID.parse(block.cid);
    let calls = 0;
    const store = sdkBlockStore({ store: bytes => new StoreBuilder({ storeWithOptions: async (data, opts) => {
      calls++;
      assert.deepEqual(data, bytes);
      assert.equal(opts.hashingAlgorithm, HashAlgorithm[runtimeHashName(cid.multihash.code)]);
      assert.equal(opts.cidCodec, cid.code);
      assert.equal(opts.waitFor, 'finalized');
      return { cid, size: bytes.length, blockNumber: 100, extrinsicIndex: 1 };
    } }, bytes) });
    assert.equal((await store(block)).cid, block.cid);
    assert.equal(calls, 1);
    let encoded;
    const sdk = new AsyncBulletinClient({ tx: { TransactionStorage: { store_with_cid_config: args => {
      encoded = args; return { encoded: true };
    }, store: args => {
      encoded = { data: args.data, cid: { codec: 0x55n, hashing: { type: 'Blake2b256' } } };
      return { encoded: true };
    } } } }, null, () => assert.fail('No signing or broadcast'));
    sdk.signAndSubmitWithProgress = async (tx, _progress, waitFor) => {
      assert.equal(tx.encoded, true); assert.equal(waitFor, 'finalized'); return { blockNumber: 100, txIndex: 1 };
    };
    assert.equal((await sdkBlockStore(sdk)(block)).cid, block.cid);
    assert.equal(encoded.cid.hashing.type, runtimeHashName(cid.multihash.code));
    assert.equal(encoded.cid.codec, BigInt(cid.code));
    assert.deepEqual(encoded.data, block.bytes);
  }
});

test('marker persistence never creates a key; resume reuses finalized receipts without duplicate writes', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-addressing-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const dir = join(parent, 'marker');
  assert.equal((await prepare(dir, addressingFixture)).prospectiveTransactions, 6);
  await assert.rejects(readFile(join(dir, 'key.bin')), /ENOENT/);
  const f = await loadFixture(dir);
  const chain = new SimulatedChain();
  await publish(f.graph, chain, join(dir, 'checkpoint'), ADDRESSING_BUDGET);
  assert.equal(chain.stores.length, 3);
  await publish(f.graph, chain, join(dir, 'checkpoint'), ADDRESSING_BUDGET);
  assert.equal(chain.stores.length, 3);
});
