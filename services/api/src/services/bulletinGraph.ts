// Bounded server-side directory encoding. No signer, keys, HTTP or configuration.
import assert from 'node:assert/strict';
import { blake2b } from '@noble/hashes/blake2';
import * as dagPB from '@ipld/dag-pb';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import { UnixFS } from 'ipfs-unixfs';
import { importer } from 'ipfs-unixfs-importer';
import { fixedSize } from 'ipfs-unixfs-importer/chunker';
import { parseStreamingManifest, type StreamingScope } from './streamingFormat.js';
import type { PinataFile } from './pinata.js';

export const BULLETIN_BLOCK_MAX = 512 * 1024;
export const BULLETIN_GRAPH_MAX = 134 * 1024 * 1024;
export const BULLETIN_BLOCK_COUNT_MAX = 2048;
const BLAKE2B256 = 0xb220;
export type BulletinBlock = { cid: string; bytes: Uint8Array; codec: number };
export type BulletinGraph = { root: string; blocks: BulletinBlock[]; bytes: number; scope: StreamingScope; generation: string };
const blakeCid = (codec: number, bytes: Uint8Array) => CID.createV1(codec, digest(BLAKE2B256, blake2b(bytes, { dkLen: 32 })));

export function verifyBulletinBlock(id: string, bytes: Uint8Array): CID {
  const cid = CID.parse(id);
  assert.ok(
    cid.version === 1 && [0x55, dagPB.code].includes(cid.code) && cid.multihash.code === BLAKE2B256 && cid.multihash.digest.length === 32,
    'Unsupported Bulletin media CID'
  );
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= BULLETIN_BLOCK_MAX, 'Invalid Bulletin block size');
  assert.ok(cid.equals(blakeCid(cid.code, bytes)), 'Bulletin CID does not match block bytes');
  return cid;
}

/** Only the current complete encrypted streaming layout is admitted. The custody
 * job authenticates ciphertext first; this module never obtains a content key. */
export async function buildBulletinMediaGraph(files: PinataFile[], signal: AbortSignal): Promise<BulletinGraph> {
  signal.throwIfAborted();
  assert.ok(files.length >= 8 && files.length <= 773, 'Invalid streaming file count');
  const byPath = new Map<string, Uint8Array>();
  let fileBytes = 0;
  for (const file of files) {
    assert.ok(typeof file.path === 'string' && !byPath.has(file.path), 'Duplicate streaming path');
    assert.ok(file.bytes instanceof Uint8Array && file.bytes.length > 0, 'Empty streaming file');
    fileBytes += file.bytes.length;
    assert.ok(fileBytes <= 132 * 1024 * 1024, 'Streaming directory exceeds byte bound');
    byPath.set(file.path, file.bytes);
  }
  const manifestBytes = byPath.get('manifest.json');
  assert.ok(manifestBytes, 'Streaming manifest missing');
  const manifest = parseStreamingManifest(manifestBytes);
  const objects = [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])];
  assert.equal(files.length, objects.length + 1, 'Unexpected streaming files');
  for (const object of objects) assert.equal(byPath.get(object.path)?.length, object.encryptedLength, 'Streaming object missing or incomplete');
  // Import exactly as the proven prototype, then readdress children first. This
  // preserves ciphertext, frame layout and all authenticated manifest fields.
  const source = new Map<string, Uint8Array>();
  let sourceBytes = 0;
  const store = {
    async put(cid: CID, bytes: Uint8Array) {
      signal.throwIfAborted();
      assert.ok(bytes.length > 0 && bytes.length <= BULLETIN_BLOCK_MAX, 'Directory block exceeds byte bound');
      if (!source.has(cid.toString())) sourceBytes += bytes.length;
      assert.ok((source.has(cid.toString()) || source.size < BULLETIN_BLOCK_COUNT_MAX) && sourceBytes <= BULLETIN_GRAPH_MAX, 'Directory exceeds graph bound');
      source.set(cid.toString(), bytes);
      return cid;
    }
  };
  let originalRoot: CID | undefined;
  for await (const entry of importer(
    [...files].sort((a, b) => a.path.localeCompare(b.path)).map(f => ({ path: f.path, content: f.bytes })),
    store,
    {
      cidVersion: 1,
      rawLeaves: true,
      wrapWithDirectory: true,
      chunker: fixedSize({ chunkSize: 256 * 1024 })
    }
  ))
    originalRoot = entry.cid;
  assert.ok(originalRoot, 'Directory root missing');
  const mapped = new Map<string, { cid: CID; dagSize: number }>();
  const blocks: BulletinBlock[] = [];
  const visit = (id: CID, depth = 0): { cid: CID; dagSize: number } => {
    signal.throwIfAborted();
    assert.ok(depth <= 8, 'Directory depth exceeded');
    const known = mapped.get(id.toString());
    if (known) return known;
    let bytes = source.get(id.toString());
    assert.ok(bytes, 'Directory dependency missing');
    let childrenSize = 0;
    if (id.code === dagPB.code) {
      const node = dagPB.decode(bytes);
      const encoded: unknown = dagPB.encode(
        dagPB.prepare({
          Data: node.Data,
          Links: node.Links.map(link => {
            const child = visit(link.Hash, depth + 1);
            childrenSize += child.dagSize;
            return { ...link, Hash: child.cid, Tsize: child.dagSize };
          })
        })
      );
      assert.ok(encoded instanceof Uint8Array, 'Invalid DAG-PB encoding');
      bytes = encoded;
    }
    const cid = blakeCid(id.code, bytes);
    verifyBulletinBlock(cid.toString(), bytes);
    const result = { cid, dagSize: bytes.length + childrenSize };
    mapped.set(id.toString(), result);
    blocks.push({ cid: cid.toString(), bytes, codec: cid.code });
    return result;
  };
  const root = visit(originalRoot).cid.toString();
  assert.equal(mapped.size, source.size, 'Unreachable directory blocks');
  const bytes = blocks.reduce((sum, b) => sum + b.bytes.length, 0);
  assert.ok(bytes <= BULLETIN_GRAPH_MAX, 'Readdressed graph exceeds byte bound');
  return {
    root,
    blocks,
    bytes,
    scope: { chainId: manifest.chainId, runtimeAddress: manifest.runtimeAddress, contentHash: manifest.contentHash, keyVersion: manifest.keyVersion },
    generation: manifest.generation
  };
}

/** Bounded path resolution usable by the API with an injected raw-block source.
 * Every DAG edge and raw block is checked against its CID before reconstruction. */
export async function readBulletinMediaPath(
  read: (cid: string, signal: AbortSignal) => Promise<Uint8Array>,
  root: string,
  path: string,
  maxBytes: number,
  signal: AbortSignal
): Promise<Buffer> {
  assert.ok(Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 1024 * 1024 + 16, 'Invalid media object bound');
  assert.ok(/^(manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/.test(path), 'Unsupported media path');
  let reads = 0,
    fetched = 0;
  const get = async (cid: CID) => {
    signal.throwIfAborted();
    assert.ok(++reads <= 16, 'Media block-read bound exceeded');
    const bytes = await read(cid.toString(), signal);
    signal.throwIfAborted();
    verifyBulletinBlock(cid.toString(), bytes);
    fetched += bytes.length;
    assert.ok(fetched <= maxBytes + 64 * 1024, 'Media read exceeds byte bound');
    return bytes;
  };
  let cid = CID.parse(root);
  for (const part of path.split('/')) {
    assert.equal(cid.code, dagPB.code, 'Media path crosses raw data');
    const node = dagPB.decode(await get(cid));
    assert.ok(node.Data && UnixFS.unmarshal(node.Data).type === 'directory', 'Media path crosses a file');
    const link = node.Links.find(link => link.Name === part);
    assert.ok(link, 'Media path missing');
    cid = link.Hash;
  }
  const file = async (id: CID, depth = 0): Promise<Buffer> => {
    assert.ok(depth <= 8, 'Media file depth exceeded');
    const bytes = await get(id);
    if (id.code === 0x55) return Buffer.from(bytes);
    const node = dagPB.decode(bytes);
    assert.ok(node.Data, 'UnixFS data missing');
    const unix = UnixFS.unmarshal(node.Data);
    assert.equal(unix.type, 'file', 'Media object is not a file');
    const parts = [Buffer.from(unix.data ?? [])];
    for (const link of node.Links) parts.push(await file(link.Hash, depth + 1));
    const result = Buffer.concat(parts);
    assert.equal(BigInt(result.length), unix.fileSize(), 'Media file size mismatch');
    return result;
  };
  const result = await file(cid);
  assert.ok(result.length > 0 && result.length <= maxBytes, 'Media object exceeds byte bound');
  return result;
}
