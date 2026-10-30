// Explicit research transport, never an automatic preimage/gateway fallback.
import { verifyBlock } from './reader.mjs';
export const NATIVE_GENESIS = '0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59';

export async function bounded(promise, signal, ms = 10_000) {
  signal.throwIfAborted();
  let timer, abort;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Native chain RPC exceeded its read deadline')), ms);
      abort = () => reject(signal.reason ?? new Error('Read cancelled'));
      signal.addEventListener('abort', abort, { once: true });
    })]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export async function nativeRpcReader(client, signal) {
  const actual = await bounded(client._request('chainSpec_v1_genesisHash', []), signal);
  if (actual !== NATIVE_GENESIS) throw new Error('Native chain RPC is not the approved Bulletin DevNet');
  return async cid => {
    const hex = await bounded(client._request('bitswap_v1_get', [cid]), signal);
    if (typeof hex !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(hex) || hex.length > 2 + 512 * 1024 * 2)
      throw new Error('Native chain RPC returned an invalid raw block');
    const bytes = Uint8Array.from(hex.slice(2).match(/../g), pair => Number.parseInt(pair, 16));
    await verifyBlock(cid, bytes);
    return bytes;
  };
}
