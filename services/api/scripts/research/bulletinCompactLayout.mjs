// Offline research only. Not imported by src or copied into the runtime image.
import assert from 'node:assert/strict';
import { blake2b } from '@noble/hashes/blake2';
import * as dagPB from '@ipld/dag-pb';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import { UnixFS } from 'ipfs-unixfs';
import { importer } from 'ipfs-unixfs-importer';
import { fixedSize } from 'ipfs-unixfs-importer/chunker';
import { verifyBulletinBlock, BULLETIN_BLOCK_MAX, BULLETIN_GRAPH_MAX, BULLETIN_BLOCK_COUNT_MAX } from '../../src/services/bulletinGraph.ts';
import { parseStreamingManifest } from '../../src/services/streamingFormat.ts';

export const PACK_SCHEMA = 'dotify.research.rendition-pack.v1';
const TOTAL_MAX = 132 * 1024 * 1024;
const OBJECT_MAX = 1024 * 1024 + 16;
const chunkAllowed = size => assert([256 * 1024, 512 * 1024].includes(size), 'Unsupported research chunk size');
const safePath = name => typeof name === 'string' && /^[a-zA-Z0-9_-]+(?:[./][a-zA-Z0-9_-]+)*$/.test(name) && !name.includes('..');
const cidFor = (codec, bytes) => CID.createV1(codec, digest(0xb220, blake2b(bytes, { dkLen: 32 })));

// Mirrors the deployed import/readdress algorithm; baseline tests require exact
// CID/byte equality at 256 KiB. Keep experimental options outside production.
export async function buildResearchGraph(files, chunkSize, signal) {
  chunkAllowed(chunkSize);
  signal.throwIfAborted();
  assert(files.length > 0 && files.length <= 773 && new Set(files.map(f => f.path)).size === files.length, 'Invalid research files');
  let total = 0;
  for (const file of files) {
    assert(safePath(file.path) && file.bytes instanceof Uint8Array && file.bytes.length > 0, 'Invalid research file');
    total += file.bytes.length;
    assert(total <= TOTAL_MAX, 'Research input too large');
  }
  const source = new Map();
  let sourceBytes = 0,
    originalRoot;
  const store = {
    async put(cid, bytes) {
      signal.throwIfAborted();
      assert(bytes.length > 0 && bytes.length <= BULLETIN_BLOCK_MAX, 'Research block too large');
      if (!source.has(cid.toString())) sourceBytes += bytes.length;
      assert(sourceBytes <= BULLETIN_GRAPH_MAX && (source.has(cid.toString()) || source.size < BULLETIN_BLOCK_COUNT_MAX), 'Research graph too large');
      source.set(cid.toString(), bytes);
      return cid;
    }
  };
  for await (const entry of importer(
    [...files].sort((a, b) => a.path.localeCompare(b.path)).map(f => ({ path: f.path, content: f.bytes })),
    store,
    { cidVersion: 1, rawLeaves: true, wrapWithDirectory: true, chunker: fixedSize({ chunkSize }) }
  ))
    originalRoot = entry.cid;
  assert(originalRoot, 'Missing research root');
  const mapped = new Map(),
    blocks = [];
  function visit(id, depth = 0) {
    signal.throwIfAborted();
    assert(depth <= 8, 'Research graph too deep');
    if (mapped.has(id.toString())) return mapped.get(id.toString());
    let bytes = source.get(id.toString()),
      childrenSize = 0;
    assert(bytes, 'Research dependency missing');
    if (id.code === dagPB.code) {
      const node = dagPB.decode(bytes);
      bytes = dagPB.encode(
        dagPB.prepare({
          Data: node.Data,
          Links: node.Links.map(link => {
            const child = visit(link.Hash, depth + 1);
            childrenSize += child.dagSize;
            return { ...link, Hash: child.cid, Tsize: child.dagSize };
          })
        })
      );
    }
    const cid = cidFor(id.code, bytes);
    verifyBulletinBlock(cid.toString(), bytes);
    const result = { cid, dagSize: bytes.length + childrenSize };
    mapped.set(id.toString(), result);
    blocks.push({ cid: cid.toString(), bytes, codec: cid.code });
    return result;
  }
  const root = visit(originalRoot).cid.toString();
  assert.equal(mapped.size, source.size, 'Unreachable research blocks');
  const bytes = blocks.reduce((n, b) => n + b.bytes.length, 0);
  assert(bytes <= BULLETIN_GRAPH_MAX);
  return { root, blocks, bytes };
}

function rangesFor(manifest, separateFirstSegment) {
  const ranges = new Map();
  for (const rendition of manifest.renditions) {
    let offset = 0;
    const init = rendition.init;
    ranges.set(init.path, { path: init.path, offset: 0, length: init.encryptedLength, total: init.encryptedLength });
    if (separateFirstSegment) {
      const first = rendition.segments[0];
      ranges.set(first.path, { path: first.path, offset: 0, length: first.encryptedLength, total: first.encryptedLength });
    }
    const objects = rendition.segments.slice(separateFirstSegment ? 1 : 0);
    const total = objects.reduce((n, o) => n + o.encryptedLength, 0);
    assert(Number.isSafeInteger(total) && total <= TOTAL_MAX);
    for (const object of objects) {
      ranges.set(object.path, { path: `${rendition.bitrateKbps}/pack.bin`, offset, length: object.encryptedLength, total });
      offset += object.encryptedLength;
    }
  }
  return ranges;
}

export function packRenditions(files, chunkSize, separateFirstSegment = false) {
  chunkAllowed(chunkSize);
  assert.equal(typeof separateFirstSegment, 'boolean', 'Invalid startup policy');
  assert(files.length >= 8 && files.length <= 773 && new Set(files.map(f => f.path)).size === files.length, 'Invalid streaming files');
  let total = 0;
  for (const file of files) {
    assert(safePath(file.path) && file.bytes instanceof Uint8Array && file.bytes.length > 0, 'Invalid streaming file');
    total += file.bytes.length;
    assert(total <= TOTAL_MAX, 'Streaming input too large');
  }
  const byPath = new Map(files.map(f => [f.path, f.bytes]));
  const manifest = parseStreamingManifest(byPath.get('manifest.json') ?? new Uint8Array());
  const objects = [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])];
  assert.equal(objects.length + 1, files.length, 'Unexpected streaming files');
  for (const object of objects) assert.equal(byPath.get(object.path)?.length, object.encryptedLength, 'Missing encrypted object');
  // The unmodified authenticated manifest determines every offset. No arbitrary
  // user-supplied range/index is trusted, and the original archive is retained.
  return {
    manifest,
    files: [
      { path: 'layout.json', bytes: Buffer.from(JSON.stringify({ schema: PACK_SCHEMA, chunkSize, separateFirstSegment })) },
      { path: 'manifest.json', bytes: Buffer.from(byPath.get('manifest.json')) },
      { path: manifest.master.path, bytes: Buffer.from(byPath.get(manifest.master.path)) },
      // Keep init independently addressable: an 800-byte decoder bootstrap must
      // not force a whole packed data chunk to arrive before media can append.
      ...manifest.renditions.map(r => ({ path: r.init.path, bytes: Buffer.from(byPath.get(r.init.path)) })),
      ...(separateFirstSegment ? manifest.renditions.map(r => ({ path: r.segments[0].path, bytes: Buffer.from(byPath.get(r.segments[0].path)) })) : []),
      ...manifest.renditions.flatMap(r => {
        const objects = r.segments.slice(separateFirstSegment ? 1 : 0);
        return objects.length ? [{ path: `${r.bitrateKbps}/pack.bin`, bytes: Buffer.concat(objects.map(o => byPath.get(o.path))) }] : [];
      })
    ]
  };
}

// This reader is deliberately opt-in research. Current Web/API/Host readers
// cannot read packed segments; do not publish these roots under existing refs.
// The caller must verify the ordinary manifest HMAC/scope with its authorized
// key first, and authenticate/decrypt the returned object afterwards. This
// transport never supplies a key, entitlement or plaintext-authentication claim.
// Its injected block source must provide bounded/cooperative reads; native SDK
// uncancellable-call lifetime and whole-query deadlines are integration gates.
export async function readPackedObject(read, root, authenticatedManifestBytes, objectPath, maxBytes, signal) {
  assert(Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= OBJECT_MAX, 'Invalid object bound');
  assert(/^(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin$/.test(objectPath), 'Unsupported packed object');
  const manifest = parseStreamingManifest(authenticatedManifestBytes);
  const cache = new Map();
  let calls = 0,
    fetched = 0;
  // Both ends may occupy partial chunks. The remaining allowance explicitly
  // covers authenticated manifest and DAG metadata; this is a research limit,
  // not a change to the deployed reader's maxBytes + 64-KiB contract.
  let byteBound = maxBytes + 2 * BULLETIN_BLOCK_MAX + 320 * 1024;
  async function get(id) {
    signal.throwIfAborted();
    const key = id.toString();
    if (cache.has(key)) return cache.get(key);
    assert(++calls <= 16, 'Packed read-count bound exceeded');
    const payload = await read(key, signal);
    signal.throwIfAborted();
    assert(payload instanceof Uint8Array && payload.length > 0 && payload.length <= BULLETIN_BLOCK_MAX, 'Invalid packed block response');
    const bytes = Uint8Array.from(payload);
    verifyBulletinBlock(key, bytes);
    fetched += bytes.length;
    assert(fetched <= byteBound, 'Packed byte bound exceeded');
    cache.set(key, bytes);
    return bytes;
  }
  async function resolve(path) {
    let id = CID.parse(root);
    for (const name of path.split('/')) {
      assert(id.code === dagPB.code, 'Packed path crosses raw data');
      const node = dagPB.decode(await get(id));
      assert(node.Data && UnixFS.unmarshal(node.Data).type === 'directory', 'Packed path crosses a file');
      const links = node.Links.filter(l => l.Name === name);
      assert.equal(links.length, 1, 'Packed path missing or ambiguous');
      id = links[0].Hash;
    }
    return id;
  }
  async function smallFile(path, maximum) {
    const id = await resolve(path),
      bytes = await get(id);
    assert(bytes.length <= maximum, 'Packed descriptor too large');
    if (id.code === 0x55) return bytes;
    const node = dagPB.decode(bytes);
    assert(node.Data && node.Links.length === 0, 'Packed descriptor must be a small leaf');
    const unix = UnixFS.unmarshal(node.Data);
    assert(unix.type === 'file' && unix.data?.length && unix.fileSize() === BigInt(unix.data.length), 'Invalid packed descriptor');
    return unix.data;
  }
  const marker = JSON.parse(Buffer.from(await smallFile('layout.json', 4096)).toString('utf8'));
  assert(
    marker &&
      Object.keys(marker).sort().join(',') === 'chunkSize,schema,separateFirstSegment' &&
      marker.schema === PACK_SCHEMA &&
      typeof marker.separateFirstSegment === 'boolean',
    'Unsupported packed layout'
  );
  chunkAllowed(marker.chunkSize);
  const range = rangesFor(manifest, marker.separateFirstSegment).get(objectPath);
  assert(range && range.length <= maxBytes, 'Packed object missing or too large');
  byteBound = maxBytes + 2 * marker.chunkSize + 320 * 1024;
  assert(fetched <= byteBound, 'Packed byte bound exceeded');
  const storedManifest = await smallFile('manifest.json', 256 * 1024);
  assert.deepEqual(Buffer.from(storedManifest), Buffer.from(authenticatedManifestBytes), 'Packed root/manifest mismatch');
  async function slice(id, expected, begin, end, depth = 0) {
    assert(depth <= 8, 'Packed file depth exceeded');
    const bytes = await get(id);
    if (id.code === 0x55) {
      assert.equal(bytes.length, expected, 'Packed raw size mismatch');
      return Buffer.from(bytes.subarray(begin, end));
    }
    const node = dagPB.decode(bytes);
    assert(node.Data, 'Packed UnixFS metadata missing');
    const unix = UnixFS.unmarshal(node.Data);
    assert(unix.type === 'file' && unix.fileSize() === BigInt(expected), 'Packed file size mismatch');
    assert.equal(node.Links.length, unix.blockSizes.length, 'Packed child-size count mismatch');
    const inline = Buffer.from(unix.data ?? []),
      sizes = unix.blockSizes.map(n => {
        assert(n > 0n && n <= BigInt(TOTAL_MAX), 'Invalid packed child size');
        return Number(n);
      });
    assert.equal(inline.length + sizes.reduce((n, s) => n + s, 0), expected, 'Packed child sizes mismatch');
    const parts = [];
    if (begin < inline.length) parts.push(inline.subarray(begin, Math.min(end, inline.length)));
    let offset = inline.length;
    for (const [i, link] of node.Links.entries()) {
      const size = sizes[i];
      if (offset < end && offset + size > begin) parts.push(await slice(link.Hash, size, Math.max(0, begin - offset), Math.min(size, end - offset), depth + 1));
      offset += size;
    }
    const result = Buffer.concat(parts);
    assert.equal(result.length, end - begin, 'Packed range incomplete');
    return result;
  }
  const bytes = await slice(await resolve(range.path), range.total, range.offset, range.offset + range.length);
  signal.throwIfAborted();
  return { bytes, reads: calls, fetchedBytes: fetched, chunkSize: marker.chunkSize };
}
