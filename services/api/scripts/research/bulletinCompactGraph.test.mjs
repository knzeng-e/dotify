import test from 'node:test';
import assert from 'node:assert/strict';
import { compactFixture } from './compactLayoutFixture.mjs';
import { buildBulletinCompactMediaGraph, compactBulletinFiles, compactObjectRanges } from '../../src/services/bulletinCompactGraph.ts';
import { buildBulletinMediaGraph, readBulletinDirectoryPath, verifyBulletinBlock } from '../../src/services/bulletinGraph.ts';
import { compactLayoutMarkerSchema, compactLayoutMarker, bulletinGraphLayout, assertStandardBulletinLayout } from '../../src/services/bulletinStorageLayout.ts';
import { jobSchema, bulletinInventoryLayout } from '../../src/services/bulletinMediaState.ts';
import { verifyStreamingManifest, decryptStreamingObject } from '../../src/services/streamingFormat.ts';
import { buildResearchGraph } from './bulletinCompactLayout.mjs';
import { planBulletinWaves } from '../../src/services/bulletinPipeline.ts';

const signal = () => new AbortController().signal;

test('fixed compact contract preserves every ciphertext object, manifest authentication and archive; research roots stay distinct', async () => {
  const f = compactFixture({ masterBytes: 1000, segments: 6 });
  const compact = compactBulletinFiles(f.files);
  const files = new Map(compact.files.map(f => [f.path, f.bytes]));
  verifyStreamingManifest(compact.manifest, f.key, f.scope);
  assert.deepEqual(files.get('manifest.json'), f.manifestBytes);
  const master = f.manifest.master;
  assert.deepEqual(decryptStreamingObject(files.get(master.path), f.key, f.manifest, master), f.plain.get(master.path));
  const ranges = compactObjectRanges(f.manifest);
  for (const r of f.manifest.renditions)
    for (const object of [r.init, ...r.segments]) {
      const range = ranges.get(object.path);
      const file = files.get(range.path);
      assert.equal(file.length, range.total);
      const value = file.subarray(range.offset, range.offset + range.length);
      assert.deepEqual(value, f.files.find(f => f.path === object.path).bytes);
      assert.deepEqual(decryptStreamingObject(value, f.key, f.manifest, object), f.plain.get(object.path));
    }
  const g = await buildBulletinCompactMediaGraph(f.files, signal());
  const { layout, scope, generation, ...encoded } = g;
  assert.equal(layout, 'rendition-pack-v1');
  assert.deepEqual(scope, f.scope);
  assert.equal(generation, f.manifest.generation);
  assert.deepEqual(encoded, await buildResearchGraph(compact.files, 256 * 1024, signal()));
  for (const block of g.blocks) verifyBulletinBlock(block.cid, block.bytes);
  const byCid = new Map(g.blocks.map(b => [b.cid, b.bytes]));
  assert.deepEqual(
    await readBulletinDirectoryPath(async cid => byCid.get(cid), g.root, 'layout.json', 4096, signal()),
    Buffer.from(JSON.stringify(compactLayoutMarker()))
  );
  const repeat = await buildBulletinCompactMediaGraph([...f.files].reverse(), signal());
  assert.deepEqual(repeat, g);
  // Own copies: packing cannot mutate saved logical ciphertext or rely on its
  // caller retaining mutable buffers while a physical directory is encoded.
  const first = files.get('96/segment-000.bin');
  first[0] ^= 1;
  assert.notDeepEqual(first, f.files.find(f => f.path === '96/segment-000.bin').bytes);
});

test('the fixed 256-KiB candidate retains modeled stage reduction without dropping any rendition or master', async () => {
  const f = compactFixture({ masterBytes: 2781953, segments: 29 });
  const old = await buildBulletinMediaGraph(f.files, signal());
  const packed = await buildBulletinCompactMediaGraph(f.files, signal());
  const pipeline = { concurrency: 2, maxInFlightBytes: 524288, writeWindow: { concurrency: 16, maxInFlightBytes: 4194304 } };
  assert.equal(old.blocks.length, 108);
  assert.equal(packed.blocks.length, 60);
  assert.equal(planBulletinWaves(old, pipeline).waveCount, 9);
  assert.equal(planBulletinWaves(packed, pipeline).waveCount, 6);
});

test('fixed marker, one-segment case, complete-input validation and pre-abort refuse ambiguity', async () => {
  const f = compactFixture({ masterBytes: 1000, segments: 1 });
  assert(!compactBulletinFiles(f.files).files.some(f => f.path.endsWith('/pack.bin')));
  for (const marker of [
    { ...compactLayoutMarker(), chunkSize: 524288 },
    { ...compactLayoutMarker(), startup: 'init-only' },
    { ...compactLayoutMarker(), schema: 'dotify.research.rendition-pack.v1' },
    { ...compactLayoutMarker(), offsets: [] }
  ])
    assert(!compactLayoutMarkerSchema.safeParse(marker).success);
  for (const files of [
    f.files.slice(1),
    [...f.files, f.files[0]],
    [...f.files, { path: 'extra.bin', bytes: Buffer.of(1) }],
    f.files.map((f, i) => (i === 0 ? { ...f, bytes: f.bytes.subarray(1) } : f))
  ]) {
    assert.throws(() => compactBulletinFiles(files));
  }
  const aborted = AbortSignal.abort();
  await assert.rejects(buildBulletinCompactMediaGraph(f.files, aborted));
  for (const layout of [null, '', 'typo', false]) assert.throws(() => bulletinGraphLayout({ layout }));
  assert.equal(bulletinGraphLayout({}), 'unixfs-files-v1');
  assert.throws(() => assertStandardBulletinLayout('rendition-pack-v1'), /not enabled/);
});

test('journal versions cannot omit, guess or retrofit a compact storage layout', () => {
  const legacy = {
    schema: 'dotify.bulletin.media-job.v2',
    genesis: 'test',
    account: 'test',
    job: 'stream-11111111-1111-4111-8111-111111111111',
    root: 'root',
    scope: { chainId: 1, runtimeAddress: 'test', contentHash: 'test', keyVersion: 'test' },
    generation: 'test',
    blocks: [{ cid: 'test', bytes: 1 }],
    budget: { maxBytes: 10, maxTransactions: 10, minimumLifetimeBlocks: 100 },
    attemptedBytes: 0,
    attemptedStores: 0,
    receipts: {},
    pending: {},
    nextNonce: null,
    pipeline: { concurrency: 2, maxInFlightBytes: 524288 },
    ready: false
  };
  assert.equal(bulletinInventoryLayout(jobSchema.parse(legacy)), 'unixfs-files-v1');
  const compact = { ...legacy, schema: 'dotify.bulletin.media-job.v3', layout: 'rendition-pack-v1' };
  assert.equal(bulletinInventoryLayout(jobSchema.parse(compact)), 'rendition-pack-v1');
  for (const value of [
    { ...legacy, layout: 'rendition-pack-v1' },
    { ...legacy, schema: 'dotify.bulletin.media-job.v3' },
    { ...compact, layout: 'unixfs-files-v1' },
    { ...compact, layout: null },
    { ...compact, layout: 'unknown' },
    { ...compact, schema: 'future' }
  ])
    assert(!jobSchema.safeParse(value).success);
});
