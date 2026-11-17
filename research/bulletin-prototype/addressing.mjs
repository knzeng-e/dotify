// A public marker, not audio or an entitlement. Exactly three blocks, no content key.
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { hashBytes, SHA256, BLAKE2B256 } from './hashes.mjs';
import { verifyGraph, readPath } from './graph.mjs';
export const ADDRESSING_BUDGET = Object.freeze({ maxBytes: 2048, maxTransactions: 6 });

export async function addressingFixture() {
  const payload = Buffer.from('Dotify public Bulletin addressing probe v1. Identical bytes; SHA-256 and BLAKE2b-256. No artist recording, account identity or secret.\n');
  const sha = CID.createV1(0x55, await hashBytes(SHA256, payload));
  const blake = CID.createV1(0x55, await hashBytes(BLAKE2B256, payload));
  const bytes = dagPB.encode(dagPB.prepare({
    Data: new UnixFS({ type: 'directory' }).marshal(),
    Links: [ { Name: 'sha256.txt', Hash: sha, Tsize: payload.length }, { Name: 'blake2b.txt', Hash: blake, Tsize: payload.length } ]
  }));
  const root = CID.createV1(dagPB.code, await hashBytes(BLAKE2B256, bytes));
  const blocks = [
    { cid: sha.toString(), bytes: payload, codec: 0x55 },
    { cid: blake.toString(), bytes: payload, codec: 0x55 },
    { cid: root.toString(), bytes, codec: dagPB.code }
  ];
  const graph = { root: root.toString(), blocks, bytes: blocks.reduce((sum, block) => sum + block.bytes.length, 0) };
  const addressingProof = {
    kind: 'public-addressing-marker-v1', payloadBytes: payload.length,
    payloadSha256: Buffer.from(sha.multihash.digest).toString('hex'),
    sha256RawCid: sha.toString(), blake2bRawCid: blake.toString(), directoryCid: root.toString()
  };
  return { graph, addressingProof, originals: new Map() };
}

/** Binding the exact public fixture prevents this tiny command becoming a media uploader. */
export async function validateAddressingFixture(fixture) {
  const expected = await addressingFixture();
  await verifyGraph(fixture.graph);
  assert.deepEqual(fixture.addressingProof, expected.addressingProof, 'Addressing proof changed');
  assert.equal(fixture.graph.root, expected.graph.root, 'Addressing directory changed');
  assert.equal(fixture.graph.bytes, expected.graph.bytes, 'Addressing byte count changed');
  assert.deepEqual(fixture.graph.blocks.map(b => [b.cid, b.codec]), expected.graph.blocks.map(b => [b.cid, b.codec]), 'Addressing graph changed');
  assert.ok(fixture.graph.bytes <= ADDRESSING_BUDGET.maxBytes && fixture.graph.blocks.length * 2 <= ADDRESSING_BUDGET.maxTransactions);
}

export async function verifyAddressing(transport, fixture) {
  await validateAddressingFixture(fixture);
  const { graph, addressingProof: proof } = fixture;
  const expected = graph.blocks[0].bytes;
  transport.reads.length = 0;
  const paths = [];
  for (const path of ['sha256.txt', 'blake2b.txt']) {
    const result = await readPath(transport.readBlock, graph.root, path, { maxBytes: 2048, maxReads: 4 });
    assert.deepEqual(Buffer.from(result.bytes), Buffer.from(expected), 'Addressed marker bytes differ');
    paths.push(path);
  }
  return { kind: proof.kind, verifiedPaths: paths, rawReads: transport.reads.length, readBytes: transport.reads.reduce((sum, r) => sum + r.bytes, 0), physicalHostTested: false };
}
