import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBulletinDirectoryGraph, readBulletinMediaPath, readBulletinDirectoryPath } from '../../src/services/bulletinGraph.ts';
import { decryptStreamingObject, verifyStreamingManifest } from '../../src/services/streamingFormat.ts';
import { buildResearchGraph, packRenditions, readPackedObject } from './bulletinCompactLayout.mjs';
import { compactFixture } from './compactLayoutFixture.mjs';

const signal = () => new AbortController().signal;
const readFrom = graph => {
  const map = new Map(graph.blocks.map(b => [b.cid, b.bytes]));
  return async cid => {
    assert(map.has(cid), 'Unknown block');
    return map.get(cid);
  };
};
const small = () => compactFixture({ masterBytes: 20000, segments: 5, segmentBytes: [120000, 180000, 156000] });

test('research 256-KiB baseline exactly matches deployed graph encoding', async () => {
  const fixture = small();
  assert.deepEqual(await buildResearchGraph(fixture.files, 256 * 1024, signal()), await buildBulletinDirectoryGraph(fixture.files, signal()));
});

for (const chunkSize of [256 * 1024, 512 * 1024]) {
  test(`standard ${chunkSize} chunks retain current paths and ciphertext`, async () => {
    const f = small(),
      g = await buildResearchGraph(f.files, chunkSize, signal()),
      read = readFrom(g);
    for (const file of f.files) assert.deepEqual(await readBulletinDirectoryPath(read, g.root, file.path, file.bytes.length, signal()), file.bytes);
  });
  test(`packed ${chunkSize} layout preserves manifest, archive, every init and authenticated segment`, async () => {
    const f = small(),
      packed = packRenditions(f.files, chunkSize),
      g = await buildResearchGraph(packed.files, chunkSize, signal()),
      read = readFrom(g);
    assert.deepEqual(packed.files.find(b => b.path === f.manifest.master.path).bytes, f.files.find(b => b.path === f.manifest.master.path).bytes);
    assert.deepEqual(await readBulletinMediaPath(read, g.root, 'manifest.json', 256 * 1024, signal()), f.manifestBytes);
    verifyStreamingManifest(packed.manifest, f.key, f.scope);
    for (const rendition of f.manifest.renditions)
      for (const descriptor of [rendition.init, ...rendition.segments]) {
        const result = await readPackedObject(read, g.root, f.manifestBytes, descriptor.path, descriptor.encryptedLength, signal());
        assert.deepEqual(result.bytes, f.files.find(b => b.path === descriptor.path).bytes);
        assert.deepEqual(decryptStreamingObject(result.bytes, f.key, f.manifest, descriptor), f.plain.get(descriptor.path));
        assert(result.reads <= 16 && result.fetchedBytes <= descriptor.encryptedLength + 2 * chunkSize + 320 * 1024);
      }
  });
}

test('range reads cross chunk edges without downloading archive or other renditions', async () => {
  const f = small(),
    g = await buildResearchGraph(packRenditions(f.files, 256 * 1024).files, 256 * 1024, signal());
  const fetched = new Set(),
    read = readFrom(g);
  const result = await readPackedObject(
    async (cid, s) => {
      fetched.add(cid);
      return read(cid, s);
    },
    g.root,
    f.manifestBytes,
    '96/segment-002.bin',
    120016,
    signal()
  );
  assert.deepEqual(result.bytes, f.files.find(f => f.path === '96/segment-002.bin').bytes);
  const allowed = new Set();
  const trace = async (cid, s) => {
    allowed.add(cid);
    return read(cid, s);
  };
  for (const path of ['layout.json', 'manifest.json', '96/pack.bin']) await readBulletinDirectoryPath(trace, g.root, path, 1024 * 1024, signal());
  assert(
    [...fetched].every(cid => allowed.has(cid)),
    'Archive/other rendition fetched'
  );
  assert(result.fetchedBytes < 700000 && fetched.size < allowed.size, 'Whole selected pack was fetched');
});

test('a small range straddling two full 512-KiB chunks has explicitly bounded amplification', async () => {
  const f = compactFixture({ masterBytes: 20000, segments: 25 }),
    chunk = 512 * 1024;
  const g = await buildResearchGraph(packRenditions(f.files, chunk).files, chunk, signal());
  const descriptor = f.manifest.renditions[1].segments[12];
  const result = await readPackedObject(readFrom(g), g.root, f.manifestBytes, descriptor.path, descriptor.encryptedLength, signal());
  assert.deepEqual(result.bytes, f.files.find(f => f.path === descriptor.path).bytes);
  assert(result.fetchedBytes > 2 * chunk && result.fetchedBytes <= descriptor.encryptedLength + 2 * chunk + 320 * 1024);
});

test('init remains a tiny separate object, and old readers do not support packed media paths', async () => {
  const f = small(),
    g = await buildResearchGraph(packRenditions(f.files, 256 * 1024).files, 256 * 1024, signal()),
    read = readFrom(g);
  const result = await readPackedObject(read, g.root, f.manifestBytes, '96/init.bin', 816, signal());
  assert(result.fetchedBytes < 64000);
  assert.deepEqual(await readBulletinMediaPath(read, g.root, '96/init.bin', 816, signal()), result.bytes);
  await assert.rejects(readBulletinMediaPath(read, g.root, '96/segment-000.bin', 120016, signal()), /missing/);
  const legacy = await buildResearchGraph(f.files, 256 * 1024, signal());
  await assert.rejects(readPackedObject(readFrom(legacy), legacy.root, f.manifestBytes, '96/segment-000.bin', 120016, signal()), /missing/);
});

test('tampered selected block, mismatched manifest, invalid path/bounds and cancellation fail closed', async () => {
  const f = small(),
    g = await buildResearchGraph(packRenditions(f.files, 256 * 1024).files, 256 * 1024, signal()),
    read = readFrom(g);
  await assert.rejects(
    readPackedObject(
      async (cid, s) => {
        const b = Uint8Array.from(await read(cid, s));
        b[b.length - 1] ^= 1;
        return b;
      },
      g.root,
      f.manifestBytes,
      '96/init.bin',
      816,
      signal()
    ),
    /CID/
  );
  const other = compactFixture({ masterBytes: 20001, segments: 5, segmentBytes: [120000, 180000, 156000] });
  await assert.rejects(readPackedObject(read, g.root, other.manifestBytes, '96/init.bin', 816, signal()), /manifest mismatch/);
  for (const path of ['../96/pack.bin', 'archive/master.bin', '96/pack.bin', '96/segment-255.bin'])
    await assert.rejects(readPackedObject(read, g.root, f.manifestBytes, path, 120016, signal()));
  for (const limit of [0, -1, Infinity, 0.5, 2 * 1024 * 1024, 10])
    await assert.rejects(readPackedObject(read, g.root, f.manifestBytes, '96/init.bin', limit, signal()));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readPackedObject(read, g.root, f.manifestBytes, '96/init.bin', 816, controller.signal));
  const late = new AbortController();
  await assert.rejects(
    readPackedObject(
      async (cid, s) => {
        const bytes = await read(cid, s);
        late.abort();
        return bytes;
      },
      g.root,
      f.manifestBytes,
      '96/init.bin',
      816,
      late.signal
    )
  );
  await assert.rejects(
    readPackedObject(async () => new Uint8Array(512 * 1024 + 1), g.root, f.manifestBytes, '96/init.bin', 816, signal()),
    /Invalid packed block/
  );
  await assert.rejects(
    readPackedObject(async () => [1, 2, 3], g.root, f.manifestBytes, '96/init.bin', 816, signal()),
    /Invalid packed block/
  );
});

test('a newly addressed but altered pack still fails ordinary object GCM authentication', async () => {
  const f = small(),
    packed = packRenditions(f.files, 256 * 1024);
  const file = packed.files.find(f => f.path === '96/pack.bin');
  file.bytes[0] ^= 1;
  const g = await buildResearchGraph(packed.files, 256 * 1024, signal());
  const descriptor = f.manifest.renditions[0].segments[0];
  const result = await readPackedObject(readFrom(g), g.root, f.manifestBytes, descriptor.path, descriptor.encryptedLength, signal());
  assert.throws(() => decryptStreamingObject(result.bytes, f.key, f.manifest, descriptor));
});

test('an immutable but unsupported layout marker fails before media extraction', async () => {
  const f = small();
  for (const marker of [
    { schema: 'unknown', chunkSize: 262144, separateFirstSegment: false },
    { schema: 'dotify.research.rendition-pack.v1', chunkSize: 1048576, separateFirstSegment: false },
    { schema: 'dotify.research.rendition-pack.v1', chunkSize: 262144, separateFirstSegment: false, extra: true },
    { schema: 'dotify.research.rendition-pack.v1', chunkSize: 262144, separateFirstSegment: 'true' }
  ]) {
    const packed = packRenditions(f.files, 256 * 1024);
    packed.files.find(f => f.path === 'layout.json').bytes = Buffer.from(JSON.stringify(marker));
    const g = await buildResearchGraph(packed.files, 256 * 1024, signal());
    await assert.rejects(readPackedObject(readFrom(g), g.root, f.manifestBytes, '96/init.bin', 816, signal()));
  }
});

test('packing rejects missing, duplicate, wrong-length and extraneous files', () => {
  const f = small();
  assert.throws(() => packRenditions(f.files.slice(1), 256 * 1024));
  assert.throws(() => packRenditions([...f.files, f.files[0]], 256 * 1024));
  assert.throws(() => packRenditions([...f.files, { path: 'extra.bin', bytes: Buffer.of(1) }], 256 * 1024));
  assert.throws(() =>
    packRenditions(
      f.files.map((file, i) => (i === 0 ? { ...file, bytes: file.bytes.subarray(1) } : file)),
      256 * 1024
    )
  );
  assert.throws(() => packRenditions(f.files, 1024 * 1024));
});

test('retaining first segments avoids a packed startup fetch and still authenticates later ranges', async () => {
  const f = small(),
    packed = packRenditions(f.files, 256 * 1024, true),
    g = await buildResearchGraph(packed.files, 256 * 1024, signal()),
    read = readFrom(g);
  const first = f.manifest.renditions[0].segments[0];
  const startup = await readPackedObject(read, g.root, f.manifestBytes, first.path, first.encryptedLength, signal());
  assert(startup.fetchedBytes < first.encryptedLength + 64000);
  assert.deepEqual(await readBulletinMediaPath(read, g.root, first.path, first.encryptedLength, signal()), startup.bytes);
  for (const r of f.manifest.renditions)
    for (const object of r.segments.slice(1)) {
      const value = await readPackedObject(read, g.root, f.manifestBytes, object.path, object.encryptedLength, signal());
      assert.deepEqual(decryptStreamingObject(value.bytes, f.key, f.manifest, object), f.plain.get(object.path));
    }
});

test('a one-segment rendition retains no empty pack, and packing policy is explicit', async () => {
  const f = compactFixture({ masterBytes: 1000, segments: 1, segmentBytes: [1000, 2000, 3000] }),
    packed = packRenditions(f.files, 256 * 1024, true);
  assert(!packed.files.some(f => f.path.endsWith('/pack.bin')));
  const g = await buildResearchGraph(packed.files, 256 * 1024, signal());
  for (const r of f.manifest.renditions) {
    const d = r.segments[0],
      v = await readPackedObject(readFrom(g), g.root, f.manifestBytes, d.path, d.encryptedLength, signal());
    assert.deepEqual(v.bytes, f.files.find(f => f.path === d.path).bytes);
  }
  assert.throws(() => packRenditions(f.files, 256 * 1024, 'true'));
});
