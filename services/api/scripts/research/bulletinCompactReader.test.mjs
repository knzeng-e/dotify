// Offline candidate acceptance; deterministic synthetic ciphertext only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compactFixture } from './compactLayoutFixture.mjs';
import { buildBulletinCompactMediaGraph, compactBulletinFiles } from '../../src/services/bulletinCompactGraph.ts';
import { buildBulletinDirectoryGraph, readBulletinDirectoryPath } from '../../src/services/bulletinGraph.ts';
import { readAuthenticatedCompactObject } from '../../src/services/bulletinCompactReader.ts';
import { decryptStreamingObject } from '../../src/services/streamingFormat.ts';
import { compactLayoutMarker } from '../../src/services/bulletinStorageLayout.ts';
const signal = () => new AbortController().signal;
async function fixture(options = { masterBytes: 20000, segments: 8, segmentBytes: [120000, 180000, 156000] }) {
  const f = compactFixture(options),
    graph = await buildBulletinCompactMediaGraph(f.files, signal());
  const blocks = new Map(graph.blocks.map(b => [b.cid, b.bytes])),
    calls = [];
  const readBlock = async cid => {
    calls.push(cid);
    return blocks.get(cid);
  };
  const input = { readBlock, root: graph.root, key: f.key, scope: f.scope, manifestBytes: f.manifestBytes, signal: signal() };
  const read = (objectPath, maxBytes, extra = {}) => readAuthenticatedCompactObject({ ...input, objectPath, maxBytes, ...extra });
  return { ...f, graph, blocks, calls, input, read };
}
test('shared API/Host vector matches the fixed constructor and every ordinary GCM object', async () => {
  const f = await fixture({ masterBytes: 64, segments: 3, segmentBytes: [32, 64, 96] });
  const v = JSON.parse(readFileSync(new URL('../../../../web/src/features/catalog/fixtures/compactMedia.json', import.meta.url)));
  assert.equal(f.graph.root, v.root);
  assert.deepEqual(f.scope, v.scope);
  assert.equal(f.key.toString('hex'), v.keyHex);
  assert.equal(f.manifestBytes.toString('hex'), v.manifestHex);
  for (const r of f.manifest.renditions)
    for (const object of [r.init, ...r.segments]) {
      const bytes = Buffer.from(await f.read(object.path, object.encryptedLength));
      assert.deepEqual(bytes, f.files.find(file => file.path === object.path).bytes);
      assert.deepEqual(decryptStreamingObject(bytes, f.key, f.manifest, object), f.plain.get(object.path));
    }
});
test('cross-leaf range skips whole pack, archive and other renditions within fixed read/byte bounds', async () => {
  const f = await fixture(),
    object = f.manifest.renditions[0].segments[3];
  assert.deepEqual(Buffer.from(await f.read(object.path, object.encryptedLength)), f.files.find(file => file.path === object.path).bytes);
  const used = new Set(f.calls),
    allowed = new Set();
  const trace = async cid => {
    allowed.add(cid);
    return f.blocks.get(cid);
  };
  for (const path of ['layout.json', 'manifest.json', '96/pack.bin']) await readBulletinDirectoryPath(trace, f.graph.root, path, 2 * 1024 * 1024, signal());
  assert([...used].every(cid => allowed.has(cid)));
  assert(used.size < allowed.size);
  assert(used.size <= 16);
  assert([...used].reduce((sum, cid) => sum + f.blocks.get(cid).length, 0) <= object.encryptedLength + 2 * 262144 + 320 * 1024);
});
test('standalone startup survives a one-segment rendition without a pack', async () => {
  const f = await fixture({ masterBytes: 64, segments: 1, segmentBytes: [32, 64, 96] });
  for (const object of [f.manifest.renditions[0].init, f.manifest.renditions[0].segments[0]])
    assert.deepEqual(Buffer.from(await f.read(object.path, object.encryptedLength)), f.files.find(file => file.path === object.path).bytes);
  assert(!compactBulletinFiles(f.files).files.some(file => file.path.endsWith('/pack.bin')));
});
test('authentication, scope, paths and byte bounds fail before block reads', async () => {
  const f = await fixture();
  for (const extra of [
    { key: Buffer.alloc(32) },
    { scope: { ...f.scope, runtimeAddress: '0x' + '33'.repeat(20) } },
    { manifestBytes: new Uint8Array(256 * 1024 + 1) }
  ])
    await assert.rejects(f.read('96/init.bin', 816, extra));
  for (const path of ['archive/master.bin', '96/pack.bin', 'layout.json', '../96/init.bin', '96/segment-256.bin', '96/init.bin?offset=1'])
    await assert.rejects(f.read(path, 816));
  for (const max of [0, -1, 0.5, Infinity, 2 * 1024 * 1024, 10]) await assert.rejects(f.read('96/init.bin', max));
  assert.equal(f.calls.length, 0);
});
test('fixed marker and exact authenticated manifest must belong to the root', async () => {
  const f = await fixture(),
    packed = compactBulletinFiles(f.files);
  for (const marker of [
    { ...compactLayoutMarker(), chunkSize: 524288 },
    { ...compactLayoutMarker(), startup: 'other' },
    { ...compactLayoutMarker(), extra: true }
  ]) {
    const files = packed.files.map(file => (file.path === 'layout.json' ? { ...file, bytes: Buffer.from(JSON.stringify(marker)) } : file));
    const g = await buildBulletinDirectoryGraph(files, signal()),
      blocks = new Map(g.blocks.map(b => [b.cid, b.bytes]));
    await assert.rejects(f.read('96/init.bin', 816, { root: g.root, readBlock: async cid => blocks.get(cid) }), /Unsupported compact layout/);
  }
  const other = compactFixture({ masterBytes: 65, segments: 3, segmentBytes: [32, 64, 96] });
  await assert.rejects(f.read('96/init.bin', 816, { manifestBytes: other.manifestBytes, key: other.key, scope: other.scope }), /manifest mismatch/);
});
test('CID corruption refuses extraction; readdressed altered ciphertext still fails ordinary GCM', async () => {
  const f = await fixture();
  await assert.rejects(
    f.read('96/init.bin', 816, {
      readBlock: async cid => {
        const bytes = Uint8Array.from(f.blocks.get(cid));
        bytes[0] ^= 1;
        return bytes;
      }
    }),
    /block authentication/
  );
  const packed = compactBulletinFiles(f.files);
  packed.files.find(file => file.path === '96/pack.bin').bytes[0] ^= 1;
  const g = await buildBulletinDirectoryGraph(packed.files, signal()),
    blocks = new Map(g.blocks.map(b => [b.cid, b.bytes]));
  const object = f.manifest.renditions[0].segments[1];
  const bytes = await f.read(object.path, object.encryptedLength, { root: g.root, readBlock: async cid => blocks.get(cid) });
  assert.throws(() => decryptStreamingObject(Buffer.from(bytes), f.key, f.manifest, object));
});
test('cancellation settles promptly while an uncancellable source is still outstanding', async () => {
  const f = await fixture(),
    owner = new AbortController();
  let finish, announce;
  const started = new Promise(resolve => {
    announce = resolve;
  });
  const reading = f.read('96/init.bin', 816, {
    signal: owner.signal,
    readBlock: () => {
      announce();
      return new Promise(resolve => {
        finish = resolve;
      });
    }
  });
  const rejected = assert.rejects(reading, { name: 'AbortError' });
  await started;
  owner.abort();
  await rejected;
  finish(f.blocks.get(f.graph.root));
  const pre = new AbortController();
  pre.abort();
  await assert.rejects(f.read('96/init.bin', 816, { signal: pre.signal }), { name: 'AbortError' });
  assert.equal(f.calls.length, 0);
});

test('readdressed malformed UnixFS sizes and excessive depth refuse despite valid block hashes', async () => {
  const { CID } = await import('multiformats/cid');
  const { create: digest } = await import('multiformats/hashes/digest');
  const { blake2b } = await import('@noble/hashes/blake2');
  const dagPB = await import('@ipld/dag-pb');
  const { UnixFS } = await import('ipfs-unixfs');
  const f = await fixture(),
    originalRoot = dagPB.decode(f.blocks.get(f.graph.root));
  const quality = originalRoot.Links.find(link => link.Name === '96'),
    node = dagPB.decode(f.blocks.get(quality.Hash.toString()));
  const init = node.Links.find(link => link.Name === 'init.bin');
  for (const mode of ['wrong-size', 'depth', 'child-count']) {
    const blocks = new Map(f.blocks);
    const add = bytes => {
      const cid = CID.createV1(0x70, digest(0xb220, blake2b(bytes, { dkLen: 32 })));
      blocks.set(cid.toString(), bytes);
      return cid;
    };
    let id = init.Hash;
    const depth = mode === 'depth' ? 10 : 1;
    for (let i = 0; i < depth; i++) {
      const unix = new UnixFS({ type: 'file', blockSizes: mode === 'child-count' ? [] : [BigInt(mode === 'wrong-size' ? 817 : 816)] });
      id = add(dagPB.encode({ Data: unix.marshal(), Links: [{ Name: '', Hash: id }] }));
    }
    const qualityId = add(dagPB.encode({ ...node, Links: node.Links.map(link => (link.Name === 'init.bin' ? { ...link, Hash: id } : link)) }));
    const root = add(
      dagPB.encode({ ...originalRoot, Links: originalRoot.Links.map(link => (link.Name === '96' ? { ...link, Hash: qualityId } : link)) })
    ).toString();
    await assert.rejects(f.read('96/init.bin', 816, { root, readBlock: async cid => blocks.get(cid) }), /size mismatch|depth exceeded/);
  }
});
