// Research-only readdressing of the generated canary. No new encryption or nonce reservation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { hashBytes, SHA256, BLAKE2B256 } from './hashes.mjs';
import { verifyGraph } from './graph.mjs';
import { loadFixture, verifyFiles } from './canary.mjs';
import { generatedWav } from './aac-fixture.mjs';
import { CANARY_BUDGET } from './live-transport.mjs';

/** Children first; raw ciphertext and UnixFS file lengths are unchanged. */
export async function blakeGraph(graph) {
  await verifyGraph(graph);
  const mapped = new Map(), blocks = [];
  for (const source of graph.blocks) {
    assert.equal(CID.parse(source.cid).multihash.code, SHA256, 'Expected the original SHA-256 graph');
    let bytes = source.bytes;
    let childrenSize = 0;
    if (source.codec === dagPB.code) {
      const node = dagPB.decode(bytes);
      const links = node.Links.map(link => {
        const child = mapped.get(link.Hash.toString());
        assert.ok(child, 'Child must be readdressed first');
        childrenSize += child.dagSize;
        return { ...link, Hash: child.cid, Tsize: child.dagSize };
      });
      bytes = dagPB.encode(dagPB.prepare({ Data: node.Data, Links: links }));
    }
    const cid = CID.createV1(source.codec, await hashBytes(BLAKE2B256, bytes));
    mapped.set(source.cid, { cid, dagSize: bytes.length + childrenSize });
    blocks.push({ cid: cid.toString(), bytes, codec: source.codec });
  }
  const result = { root: mapped.get(graph.root).cid.toString(), blocks, bytes: blocks.reduce((sum, b) => sum + b.bytes.length, 0) };
  await verifyGraph(result);
  return result;
}

export async function prepareReaddressedAac(sourceDirectory, targetDirectory) {
  const source = await loadFixture(sourceDirectory);
  assert.equal(source.audioProof?.kind, 'generated-chord-aac-v1', 'Only the generated AAC fixture is allowed');
  assert.equal(source.audioProof.durationSeconds, 8);
  assert.equal(source.audioProof.sourceSha256, createHash('sha256').update(generatedWav()).digest('hex'), 'Only the reproducible public chord is allowed');
  const keyPath = join(sourceDirectory, 'key.bin');
  const stat = await lstat(keyPath);
  assert.ok(stat.isFile() && !(stat.mode & 0o077) && stat.size === 32, 'Generated key must be private');
  const key = await readFile(keyPath);
  try {
    const graph = await blakeGraph(source.graph);
    assert.ok(graph.bytes <= CANARY_BUDGET.maxBytes && graph.blocks.length * 2 <= CANARY_BUDGET.maxTransactions);
    const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
    const transport = { reads: [], readBlock: async cid => { const bytes = blocks.get(cid); transport.reads.push({ cid, bytes: bytes.length }); return bytes; } };
    const verified = await verifyFiles(transport, { ...source, graph }, key);
    await mkdir(targetDirectory, { mode: 0o700 }); // Never overwrite an existing fixture or ledger.
    await writeFile(join(targetDirectory, 'key.bin'), key, { flag: 'wx', mode: 0o600 });
    await writeFile(join(targetDirectory, 'fixture.json'), JSON.stringify({
      ...source,
      readdressedFrom: { root: source.graph.root, hash: 'SHA-256', targetHash: 'BLAKE2b-256', ciphertextUnchanged: true, newEncryptionPerformed: false },
      graph: { ...graph, blocks: graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes).toString('base64') })) }
    }, null, 2), { flag: 'wx', mode: 0o600 });
    return { root: graph.root, blocks: graph.blocks.length, bytes: graph.bytes, prospectiveTransactions: graph.blocks.length * 2, verified };
  } finally { key.fill(0); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 4, 'Usage: node --import tsx readdress-aac.mjs PRIVATE_SOURCE NEW_PRIVATE_TARGET');
    console.log(JSON.stringify(await prepareReaddressedAac(resolve(process.argv[2]), resolve(process.argv[3])), null, 2));
  } catch (error) { console.error(String(error.message).slice(0, 500)); process.exitCode = 1; }
}
