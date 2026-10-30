import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generatedWav, encryptedAacFixture } from './aac-fixture.mjs';
import { buildDirectory, readPath } from './graph.mjs';
import { CANARY_BUDGET } from './live-transport.mjs';
import { verifyFiles, loadFixture, prepare } from './canary.mjs';

test('real encoder -> encrypted UnixFS -> browser-safe reader -> decodable AAC at every bitrate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dotify-real-aac-'));
  let fixture;
  try {
    fixture = await encryptedAacFixture(dir);
    const graph = await buildDirectory(fixture.files);
    assert.ok(graph.bytes < CANARY_BUDGET.maxBytes);
    assert.ok(graph.blocks.length * 2 <= CANARY_BUDGET.maxTransactions);
    const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
    const transport = {
      reads: [],
      async readBlock(cid) {
        const bytes = blocks.get(cid);
        this.reads.push({ cid, bytes: bytes.length });
        return bytes;
      }
    };
    // readBlock is deliberately detached in the real port.
    transport.readBlock = transport.readBlock.bind(transport);
    const hashes = Object.fromEntries([...fixture.originals].map(([p, b]) => [p, hash(b)]));
    const verified = await verifyFiles(transport, { graph, scope: fixture.scope, originals: hashes }, fixture.key);
    assert.ok(verified.verifiedObjects >= 9);
    assert.equal(verified.masterFetched, false);
    for (const rendition of fixture.manifest.renditions) {
      assert.ok(rendition.segments.length >= 2, 'Must cross a segment boundary');
      const parts = [rendition.init, ...rendition.segments].map(object => fixture.originals.get(object.path));
      const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', '16000', 'pipe:1'], {
        input: Buffer.concat(parts),
        maxBuffer: 2 * 1024 * 1024
      });
      assert.equal(decoded.status, 0, decoded.stderr.toString());
      assert.ok(decoded.stdout.length / 32000 >= 7.8, 'Must decode the whole eight-second clip');
      let sum = 0;
      for (let i = 0; i < decoded.stdout.length; i += 2) sum += (decoded.stdout.readInt16LE(i) / 32768) ** 2;
      assert.ok(Math.sqrt(sum / (decoded.stdout.length / 2)) > 0.01, 'Decoded audio must be non-silent');
    }
    const bytes = await readPath(transport.readBlock, graph.root, 'manifest.json');
    assert.ok(bytes.bytes instanceof Uint8Array);
    assert.ok(generatedWav().equals(generatedWav()), 'Public tone source is reproducible');
  } finally {
    fixture?.key.fill(0);
    for (const bytes of fixture?.originals.values() ?? []) bytes.fill(0);
    await rm(dir, { recursive: true, force: true });
  }
});
import { createHash } from 'node:crypto';
function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('AAC preparation persists one private graph and refuses to overwrite it', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-aac-prepare-'));
  const dir = join(parent, 'fixture');
  try {
    const prepared = await prepare(dir, encryptedAacFixture);
    const loaded = await loadFixture(dir);
    assert.equal(loaded.audioProof.kind, 'generated-chord-aac-v1');
    assert.equal(loaded.graph.root, prepared.root);
    const key = await readFile(join(dir, 'key.bin'));
    assert.equal(key.length, 32);
    key.fill(0);
    await assert.rejects(prepare(dir, encryptedAacFixture), /EEXIST/);
    assert.equal((await loadFixture(dir)).graph.root, prepared.root);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
