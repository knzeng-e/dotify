// Portable ciphertext-only reader: compiled by the API and imported by Host.
// No Node APIs, environment/config, signer, key or transport implementation.
// Platform codecs are injected so browser builds need no API dependencies.
export type CompactCid = { version: number; code: number; multihash: { code: number; digest: Uint8Array }; toString(): string };
export type CompactCodecs = {
  parseCid: (value: string) => CompactCid;
  decodeNode: (bytes: Uint8Array) => { Data?: Uint8Array; Links: Array<{ Name?: string; Hash: CompactCid }> };
  decodeUnix: (bytes: Uint8Array) => { type: string; data?: Uint8Array; blockSizes: bigint[]; fileSize(): bigint };
  hash: (bytes: Uint8Array) => Uint8Array;
};

export const COMPACT_MARKER = Object.freeze({ schema: 'dotify.bulletin.rendition-pack.v1', chunkSize: 262144, startup: 'init-and-first' });
export type CompactObjectRange = Readonly<{ path: string; offset: number; length: number; total: number }>;
type ObjectInfo = { path: string; encryptedLength: number };
type ManifestLayout = { renditions: Array<{ bitrateKbps: number; init: ObjectInfo; segments: ObjectInfo[] }> };
const OBJECT_MAX = 1024 * 1024 + 16;
const PACK_MAX = 132 * 1024 * 1024;
const logicalPath = /^(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin$/;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

/** Call only with a parsed, authenticated manifest. The map is not authority. */
export function compactObjectRanges(manifest: ManifestLayout): ReadonlyMap<string, CompactObjectRange> {
  const ranges = new Map<string, CompactObjectRange>();
  for (const rendition of manifest.renditions) {
    check(rendition.segments.length > 0, 'Missing compact startup object');
    for (const object of [rendition.init, rendition.segments[0]])
      ranges.set(object.path, Object.freeze({ path: object.path, offset: 0, length: object.encryptedLength, total: object.encryptedLength }));
    const later = rendition.segments.slice(1);
    const total = later.reduce((sum, object) => sum + object.encryptedLength, 0);
    check(Number.isSafeInteger(total) && total <= PACK_MAX, 'Invalid compact rendition length');
    let offset = 0;
    for (const object of later) {
      ranges.set(object.path, Object.freeze({ path: `${rendition.bitrateKbps}/pack.bin`, offset, length: object.encryptedLength, total }));
      offset += object.encryptedLength;
    }
  }
  return ranges;
}

/** Internal seam, never a public range/offset endpoint. Adapters authenticate
 * the manifest and create the range locally before calling. Every visited CID,
 * the fixed marker and the root's exact manifest bytes are checked here too. */
export async function readCompactBulletinRange(input: {
  readBlock: (cid: string, signal: AbortSignal) => Promise<Uint8Array>;
  codecs: CompactCodecs;
  root: string;
  manifestBytes: Uint8Array;
  objectPath: string;
  range: CompactObjectRange;
  maxBytes: number;
  signal: AbortSignal;
}): Promise<Uint8Array> {
  input.signal.throwIfAborted();
  const { parseCid, decodeNode, decodeUnix, hash } = input.codecs;
  check(Number.isSafeInteger(input.maxBytes) && input.maxBytes > 0 && input.maxBytes <= OBJECT_MAX, 'Invalid compact object bound');
  check(logicalPath.test(input.objectPath), 'Unsupported compact object path');
  check(
    input.manifestBytes instanceof Uint8Array && input.manifestBytes.length > 0 && input.manifestBytes.length <= 256 * 1024,
    'Invalid compact manifest bound'
  );
  const range = { ...input.range };
  const quality = input.objectPath.split('/')[0];
  const startup = input.objectPath.endsWith('/init.bin') || input.objectPath.endsWith('/segment-000.bin');
  check(range.path === (startup ? input.objectPath : `${quality}/pack.bin`), 'Invalid compact object mapping');
  check(
    [range.offset, range.length, range.total].every(Number.isSafeInteger) &&
      range.offset >= 0 &&
      range.length > 0 &&
      range.length <= input.maxBytes &&
      range.total <= PACK_MAX &&
      range.offset + range.length <= range.total,
    'Invalid compact range'
  );
  if (range.path === input.objectPath) check(range.offset === 0 && range.length === range.total, 'Invalid compact startup range');
  const expectedManifest = Uint8Array.from(input.manifestBytes);
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(new Error('Compact audio read timed out.')), 12_000);
  let stop = () => {};
  const work = async () => {
    let reads = 0,
      fetched = 0;
    // Two partial 256-KiB leaves, authenticated descriptors and DAG overhead.
    const byteLimit = input.maxBytes + 2 * COMPACT_MARKER.chunkSize + 320 * 1024;
    const cache = new Map<string, Uint8Array>();
    const get = async (id: CompactCid) => {
      signal.throwIfAborted();
      check(id.version === 1 && [0x55, 0x70].includes(id.code) && id.multihash.code === 0xb220 && id.multihash.digest.length === 32, 'Unsupported compact CID');
      const cid = id.toString();
      const cached = cache.get(cid);
      if (cached) return cached;
      check(++reads <= 16, 'Compact block-read bound exceeded');
      const payload = await input.readBlock(cid, signal);
      signal.throwIfAborted();
      check(payload instanceof Uint8Array && payload.length > 0 && payload.length <= 512 * 1024, 'Invalid compact block size');
      const bytes = Uint8Array.from(payload);
      const digest = hash(bytes);
      check(
        id.multihash.digest.every((byte, i) => byte === digest[i]),
        'Compact block authentication failed'
      );
      fetched += bytes.length;
      check(fetched <= byteLimit, 'Compact fetched-byte bound exceeded');
      cache.set(cid, bytes);
      return bytes;
    };
    const root = parseCid(input.root);
    check(root.version === 1 && root.code === 0x70, 'Invalid compact root');
    const resolve = async (path: string) => {
      let id = root;
      for (const name of path.split('/')) {
        check(id.code === 0x70, 'Compact path crosses raw data');
        const node = decodeNode(await get(id));
        check(node.Data && decodeUnix(node.Data).type === 'directory', 'Compact path crosses a file');
        const links = node.Links.filter(link => link.Name === name);
        check(links.length === 1, 'Compact path missing or ambiguous');
        id = links[0].Hash;
      }
      return id;
    };
    const descriptor = async (path: string, max: number) => {
      const id = await resolve(path);
      const bytes = await get(id);
      if (id.code === 0x55) {
        check(bytes.length <= max, 'Compact descriptor too large');
        return bytes;
      }
      const node = decodeNode(bytes);
      check(node.Data && node.Links.length === 0, 'Compact descriptor must be a leaf');
      const unix = decodeUnix(node.Data);
      check(
        unix.type === 'file' && unix.data && unix.data.length > 0 && unix.data.length <= max && unix.fileSize() === BigInt(unix.data.length),
        'Invalid compact descriptor'
      );
      return unix.data;
    };
    const marker = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await descriptor('layout.json', 4096)));
    check(
      marker &&
        typeof marker === 'object' &&
        Object.keys(marker).sort().join(',') === 'chunkSize,schema,startup' &&
        marker.schema === COMPACT_MARKER.schema &&
        marker.chunkSize === COMPACT_MARKER.chunkSize &&
        marker.startup === COMPACT_MARKER.startup,
      'Unsupported compact layout'
    );
    const storedManifest = await descriptor('manifest.json', 256 * 1024);
    check(
      storedManifest.length === expectedManifest.length && storedManifest.every((byte, i) => byte === expectedManifest[i]),
      'Compact root/manifest mismatch'
    );
    const slice = async (id: CompactCid, expected: number, begin: number, end: number, depth = 0): Promise<Uint8Array> => {
      check(depth <= 8, 'Compact file depth exceeded');
      const bytes = await get(id);
      if (id.code === 0x55) {
        check(bytes.length === expected && bytes.length <= COMPACT_MARKER.chunkSize, 'Compact raw length mismatch');
        return bytes.slice(begin, end);
      }
      const node = decodeNode(bytes);
      check(node.Data, 'Compact UnixFS metadata missing');
      const unix = decodeUnix(node.Data);
      check(unix.type === 'file' && unix.fileSize() === BigInt(expected) && node.Links.length === unix.blockSizes.length, 'Compact file size mismatch');
      const inline = unix.data ?? new Uint8Array();
      const sizes = unix.blockSizes.map(size => {
        check(size > 0n && size <= BigInt(PACK_MAX), 'Invalid compact child size');
        return Number(size);
      });
      check(
        inline.length <= COMPACT_MARKER.chunkSize && inline.length + sizes.reduce((sum, size) => sum + size, 0) === expected,
        'Compact child sizes mismatch'
      );
      const out = new Uint8Array(end - begin);
      let copied = 0,
        offset = inline.length;
      if (begin < inline.length) {
        const part = inline.subarray(begin, Math.min(end, inline.length));
        out.set(part);
        copied += part.length;
      }
      for (const [i, link] of node.Links.entries()) {
        const size = sizes[i];
        if (offset < end && offset + size > begin) {
          const part = await slice(link.Hash, size, Math.max(0, begin - offset), Math.min(size, end - offset), depth + 1);
          out.set(part, copied);
          copied += part.length;
        }
        offset += size;
      }
      check(copied === out.length, 'Incomplete compact range');
      return out;
    };
    const bytes = await slice(await resolve(range.path), range.total, range.offset, range.offset + range.length);
    signal.throwIfAborted();
    return bytes;
  };
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        stop = () => reject(signal.reason);
        signal.addEventListener('abort', stop, { once: true });
        if (signal.aborted) stop();
      })
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
    controller.abort();
  }
}
