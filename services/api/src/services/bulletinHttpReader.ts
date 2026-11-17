// Read-only HTTPS bridge for ordinary browsers. There is deliberately no
// arbitrary RPC method, signer, credential, renewal or transaction interface.
import { CID } from 'multiformats/cid';
import { verifyBulletinBlock } from './bulletinGraph.js';

export const BULLETIN_MEDIA_GENESIS = '0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59';
const JSON_MAX = 512 * 1024 * 2 + 8192;

export function validBulletinMediaRpc(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/' &&
      url.hostname !== 'localhost' &&
      !url.hostname.endsWith('.localhost') &&
      !url.hostname.endsWith('.local') &&
      !/^[\d.]+$/.test(url.hostname) &&
      !url.hostname.includes(':')
    );
  } catch {
    return false;
  }
}

export function createBulletinHttpBlockReader(endpoint: string, fetchImpl: typeof fetch = fetch) {
  if (!validBulletinMediaRpc(endpoint)) throw new Error('Invalid Bulletin media RPC configuration');
  let verifiedUntil = 0;
  let generation = 0;
  let cacheBytes = 0;
  const cache = new Map<string, { bytes: Uint8Array; until: number }>();
  async function rpc(method: 'chain_getBlockHash' | 'bitswap_v1_get', params: unknown[], owner: AbortSignal): Promise<unknown> {
    const signal = AbortSignal.any([owner, AbortSignal.timeout(10_000)]);
    signal.throwIfAborted();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const declared = Number(response.headers.get('content-length'));
    if (response.status !== 200 || declared > JSON_MAX || !response.body) {
      await response.body?.cancel();
      throw new Error('Bulletin media RPC is unavailable');
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        signal.throwIfAborted();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > JSON_MAX) throw new Error('Bulletin media RPC response exceeds byte bound');
        chunks.push(Buffer.from(part.value));
      }
    } finally {
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    const payload = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload.jsonrpc !== '2.0' ||
      payload.id !== 1 ||
      'error' in payload ||
      !Object.hasOwn(payload, 'result')
    )
      throw new Error('Invalid Bulletin media RPC response');
    return payload.result;
  }
  const read = async (cid: string, signal: AbortSignal): Promise<Uint8Array> => {
    signal.throwIfAborted();
    const parsed = CID.parse(cid);
    if (parsed.version !== 1 || ![0x55, 0x70].includes(parsed.code) || parsed.multihash.code !== 0xb220 || parsed.multihash.digest.length !== 32)
      throw new Error('Unsupported Bulletin media CID');
    const cached = cache.get(cid);
    if (cached && cached.until > Date.now()) return cached.bytes;
    const startedGeneration = generation;
    if (Date.now() >= verifiedUntil) {
      if ((await rpc('chain_getBlockHash', [0], signal)) !== BULLETIN_MEDIA_GENESIS) throw new Error('Wrong Bulletin media network');
      verifiedUntil = Date.now() + 30_000;
    }
    const result = await rpc('bitswap_v1_get', [cid], signal);
    if (typeof result !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(result) || result.length > 2 + 512 * 1024 * 2)
      throw new Error('Invalid Bulletin media block response');
    const bytes = Buffer.from(result.slice(2), 'hex');
    verifyBulletinBlock(cid, bytes);
    signal.throwIfAborted();
    if (generation === startedGeneration) {
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
    }
    return bytes;
  };
  return Object.assign(read, {
    clear() {
      generation++;
      verifiedUntil = 0;
      cache.clear();
      cacheBytes = 0;
    }
  });
}
