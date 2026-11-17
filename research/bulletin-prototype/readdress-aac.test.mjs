import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as dagPB from '@ipld/dag-pb';
import { CID } from 'multiformats/cid';
import { buildDirectory, readPath } from './graph.mjs';
import { blakeGraph, prepareReaddressedAac } from './readdress-aac.mjs';
import { encryptedAacFixture } from './aac-fixture.mjs';
import { prepare, loadFixture } from './canary.mjs';

test('readdressing rewrites every CID/link and cumulative DAG size while preserving exact file bytes', async () => {
  const files = [{ path: 'a/multiple.bin', bytes: Buffer.alloc(600000, 3) }, { path: 'b.txt', bytes: Buffer.from('public marker') }];
  const source = await buildDirectory(files);
  const graph = await blakeGraph(source);
  const blocks = new Map(graph.blocks.map(b => [b.cid, b]));
  const size = cid => {
    const b = blocks.get(cid);
    assert.equal(CID.parse(cid).multihash.code, 0xb220);
    let total = b.bytes.length;
    if (b.codec === dagPB.code) for (const link of dagPB.decode(b.bytes).Links) {
      const childSize = size(link.Hash.toString()); assert.equal(link.Tsize, childSize); total += childSize;
    }
    return total;
  };
  size(graph.root);
  for (const file of files) assert.deepEqual(Buffer.from((await readPath(cid => blocks.get(cid).bytes, graph.root, file.path)).bytes), file.bytes);
  assert.deepEqual(await blakeGraph(source), graph);
  await assert.rejects(blakeGraph(graph), /original SHA-256/);
});

test('generated AAC readdressing authenticates unchanged ciphertext and never copies/resets a nonce ledger', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-blake-aac-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const source = join(parent, 'source'), target = join(parent, 'target');
  await prepare(source, encryptedAacFixture);
  const before = await readFile(join(source, 'fixture.json'));
  const result = await prepareReaddressedAac(source, target);
  assert.ok(result.verified.verifiedObjects >= 9);
  const f = await loadFixture(target), original = await loadFixture(source);
  assert.equal(f.readdressedFrom.root, original.graph.root);
  assert.equal(f.readdressedFrom.newEncryptionPerformed, false);
  assert.deepEqual(f.audioProof, original.audioProof);
  assert.deepEqual(f.originals, original.originals);
  assert.deepEqual(f.graph.blocks.filter(b => b.codec === 0x55).map(b => Buffer.from(b.bytes)), original.graph.blocks.filter(b => b.codec === 0x55).map(b => Buffer.from(b.bytes)));
  assert.deepEqual(await readFile(join(source, 'fixture.json')), before);
  await assert.rejects(readFile(join(target, 'nonces')), /ENOENT/);
  const key = await readFile(join(target, 'key.bin')), oldKey = await readFile(join(source, 'key.bin'));
  try { assert.deepEqual(key, oldKey); } finally { key.fill(0); oldKey.fill(0); }
  await assert.rejects(prepareReaddressedAac(source, target), /EEXIST/);
});
