import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mobilePayload } from './mobile-package.mjs';
import { prepare } from './canary.mjs';
import { encryptedAacFixture, generatedWav } from './aac-fixture.mjs';
import { prepareReaddressedAac, blakeGraph } from './readdress-aac.mjs';
import { readPath, verifyBlock } from './reader.mjs';
import { createHash } from 'node:crypto';
const options = { acknowledgePublicTestKey: true };
test(
  'mobile payload authenticates generated BLAKE audio, includes only playback dependencies and needs explicit acknowledgement',
  { timeout: 30000 },
  async t => {
    const parent = await mkdtemp(join(tmpdir(), 'dotify-mobile-package-'));
    t.after(() => rm(parent, { recursive: true, force: true }));
    const source = join(parent, 'source'),
      blake = join(parent, 'blake');
    await prepare(source, encryptedAacFixture);
    await prepareReaddressedAac(source, blake);
    await assert.rejects(mobilePayload(blake), /allow-public-generated-key/);
    await assert.rejects(mobilePayload(source, options), /BLAKE2b/);
    const payload = await mobilePayload(blake, options);
    const read = async cid => {
      assert.ok(!payload.session.archiveRawCids.includes(cid));
      const bytes = Buffer.from(payload.controlBlocks[cid], 'base64');
      await verifyBlock(cid, bytes);
      return bytes;
    };
    const manifest = JSON.parse(new TextDecoder().decode((await readPath(read, payload.session.root, 'manifest.json')).bytes));
    for (const r of manifest.renditions)
      for (const object of [r.init, ...r.segments])
        assert.equal((await readPath(read, payload.session.root, object.path)).bytes.length, object.encryptedLength);
    assert.equal(payload.session.key.length, 32);
    assert.ok(payload.session.archiveRawCids.every(cid => !payload.controlBlocks[cid]));
    assert.equal(payload.publicGeneratedKey, true);
    assert.ok(!JSON.stringify(payload).includes(parent));
    const path = join(blake, 'fixture.json'),
      saved = JSON.parse(await readFile(path, 'utf8'));
    saved.audioProof.sourceSha256 = 'changed';
    await writeFile(path, JSON.stringify(saved));
    await assert.rejects(mobilePayload(blake, options), /source identity/);
  }
);
test('a forged generated label cannot export a different encrypted master', { timeout: 30000 }, async t => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-mobile-refusal-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  // Earlier synthetic byte fixture has a valid AEAD manifest but is not the generated chord.
  const source = join(parent, 'other');
  await prepare(source);
  const path = join(source, 'fixture.json'),
    fixture = JSON.parse(await readFile(path, 'utf8'));
  const graph = await blakeGraph({ ...fixture.graph, blocks: fixture.graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes, 'base64') })) });
  fixture.graph = { ...graph, blocks: graph.blocks.map(b => ({ ...b, bytes: Buffer.from(b.bytes).toString('base64') })) };
  fixture.audioProof = { kind: 'generated-chord-aac-v1', durationSeconds: 8, sourceSha256: createHash('sha256').update(generatedWav()).digest('hex') };
  await writeFile(path, JSON.stringify(fixture));
  await assert.rejects(mobilePayload(source, options), /Refusing to distribute/);
});
