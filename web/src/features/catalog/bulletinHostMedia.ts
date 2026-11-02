// Ciphertext transport only. Keys and entitlement stay in the ordinary player.
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { blake2b256 } from '@polkadot-apps/utils';
import { isBulletinMediaRoot } from './streamingTransport';

type HostRead = (cid: string, options: { noReassemble: true; lookupTimeoutMs: number }) => Promise<{ ok: true; value: Uint8Array } | { ok: false }>;
type HostDeps = { insideHost: () => Promise<boolean> | boolean; queryBytes: HostRead };
const validPath = /^(manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/;

async function bounded<T>(action: (signal: AbortSignal) => Promise<T>, owner: AbortSignal, ms: number): Promise<T> {
  owner.throwIfAborted();
  const controller = new AbortController();
  const stop = () => controller.abort(owner.reason);
  owner.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Polkadot audio read timed out.')), ms);
  let abort = () => {};
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return action(controller.signal);
      }),
      new Promise<never>((_, reject) => {
        abort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', abort, { once: true });
        if (controller.signal.aborted) abort();
      })
    ]);
  } finally {
    clearTimeout(timer);
    owner.removeEventListener('abort', stop);
    controller.signal.removeEventListener('abort', abort);
    controller.abort();
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export function createBulletinHostMediaReader(deps: HostDeps, publicAssets = false) {
  // SDK lookups cannot be cancelled externally. Count their actual lifetime,
  // including after an aborted caller, so retries cannot accumulate subscriptions.
  let activeLookups = 0;
  const cache = new Map<string, { bytes: Uint8Array; until: number }>();
  let cacheBytes = 0;
  async function block(id: CID, signal: AbortSignal): Promise<Uint8Array> {
    signal.throwIfAborted();
    check(
      id.version === 1 && [0x55, 0x70].includes(id.code) && id.multihash.code === 0xb220 && id.multihash.digest.length === 32,
      'Unsupported Bulletin block.'
    );
    const cid = id.toString();
    const cached = cache.get(cid);
    if (cached && cached.until > Date.now()) return cached.bytes;
    check(activeLookups < 2, 'Polkadot audio delivery is busy.');
    activeLookups++;
    const lookup = Promise.resolve()
      .then(() => deps.queryBytes(cid, { noReassemble: true, lookupTimeoutMs: 10_000 }))
      .finally(() => {
        activeLookups--;
      });
    const result = await bounded(() => lookup, signal, 10_000);
    signal.throwIfAborted();
    check(result.ok && result.value instanceof Uint8Array && result.value.length > 0 && result.value.length <= 512 * 1024, 'Invalid Bulletin block response.');
    const bytes = Uint8Array.from(result.value);
    const digest = blake2b256(bytes);
    check(
      id.multihash.digest.every((byte: number, i: number) => digest[i] === byte),
      'Bulletin block authentication failed.'
    );
    const previous = cache.get(cid);
    if (previous) cacheBytes -= previous.bytes.length;
    cache.delete(cid);
    cache.set(cid, { bytes, until: Date.now() + 30_000 });
    cacheBytes += bytes.length;
    while (cache.size > 32 || cacheBytes > 2 * 1024 * 1024) {
      const first = cache.keys().next().value!;
      cacheBytes -= cache.get(first)!.bytes.length;
      cache.delete(first);
    }
    return bytes;
  }
  return async (root: string, path: string, maxBytes: number, owner: AbortSignal): Promise<Uint8Array | null> => {
    const publicPath = /^(?:release\.json|cover\/(?:placeholder|64|160|320|640)\.webp|cover\/original\.(?:jpg|png|webp|gif))$/;
    check(isBulletinMediaRoot(root) && (publicAssets ? publicPath : validPath).test(path), 'Unsupported Bulletin media path.');
    check(Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= (publicAssets ? 5 * 1024 * 1024 : 1024 * 1024 + 16), 'Invalid Bulletin object bound.');
    return bounded(
      async signal => {
        if (!(await bounded(async () => deps.insideHost(), signal, 1500))) return null;
        let reads = 0,
          fetched = 0;
        const get = async (cid: CID) => {
          check(++reads <= (publicAssets ? 64 : 16), 'Bulletin block-read bound exceeded.');
          const bytes = await block(cid, signal);
          fetched += bytes.length;
          check(fetched <= maxBytes + 64 * 1024, 'Bulletin read exceeds byte bound.');
          return bytes;
        };
        let cid = CID.parse(root);
        for (const name of path.split('/')) {
          check(cid.code === 0x70, 'Bulletin path crosses raw data.');
          const node = dagPB.decode(await get(cid));
          check(node.Data && UnixFS.unmarshal(node.Data).type === 'directory', 'Bulletin path crosses a file.');
          const link = node.Links.find(link => link.Name === name);
          check(link, 'Bulletin media path is missing.');
          cid = link.Hash;
        }
        const file = async (id: CID, depth = 0): Promise<Uint8Array> => {
          check(depth <= 8, 'Bulletin file depth exceeded.');
          const bytes = await get(id);
          if (id.code === 0x55) return bytes;
          const node = dagPB.decode(bytes);
          check(node.Data, 'Bulletin file metadata missing.');
          const unix = UnixFS.unmarshal(node.Data);
          check(unix.type === 'file', 'Bulletin object is not a file.');
          const parts: Uint8Array[] = [unix.data ?? new Uint8Array()];
          for (const link of node.Links) parts.push(await file(link.Hash, depth + 1));
          const size = parts.reduce((sum, part) => sum + part.length, 0);
          check(size > 0 && size <= maxBytes && BigInt(size) === unix.fileSize(), 'Invalid Bulletin file length.');
          const out = new Uint8Array(size);
          let offset = 0;
          for (const part of parts) {
            out.set(part, offset);
            offset += part.length;
          }
          return out;
        };
        const bytes = await file(cid);
        check(bytes.length > 0 && bytes.length <= maxBytes, 'Bulletin media exceeds object bound.');
        signal.throwIfAborted();
        return bytes;
      },
      owner,
      12_000
    );
  };
}

const hostDeps: HostDeps = {
  async insideHost() {
    const { isInsideContainer } = await import('@parity/product-sdk/host');
    return isInsideContainer();
  },
  async queryBytes(cid, options) {
    const { queryBytes } = await import('@parity/product-sdk/cloud-storage');
    return queryBytes(cid, options);
  }
};
export const readHostBulletinMedia = createBulletinHostMediaReader(hostDeps);
export const readHostBulletinAsset = createBulletinHostMediaReader(hostDeps, true);
