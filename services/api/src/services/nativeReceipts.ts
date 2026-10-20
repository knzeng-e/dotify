import { createHash } from 'node:crypto';
import { getDynamicBuilder, getLookupFn } from '@polkadot-api/metadata-builders';
import { Blake2256, decAnyMetadata, unifyMetadata } from '@polkadot-api/substrate-bindings';
import { toHex, type Hash } from 'viem';
import {
  FinalizedNativeContributionFailedError,
  readNativeContributionLogs,
  type EventRecord,
  type NativeContributionBlock,
  type NativeContributionLog
} from './nativeContributionProof.js';

export const PASEO_ASSET_HUB_GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
export type NativeReceiptRequest = { hash: Hash; block: NativeContributionBlock };
export type NativeReceiptResponse = NativeReceiptRequest & { genesisHash: string; status: 'success' | 'failed'; logs: NativeContributionLog[] };
export class NativeReceiptUnavailableError extends Error {}

export function createNativeReceiptService(options: { rpcUrl?: string; chainId: number; fetchImpl?: typeof fetch }) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map<string, { expires: number; receipt: NativeReceiptResponse }>();
  const codecs = new Map<string, (bytes: Uint8Array) => EventRecord[]>();
  let active = 0;
  let requestId = 0;
  return {
    async read(input: NativeReceiptRequest): Promise<NativeReceiptResponse> {
      if (!options.rpcUrl || options.chainId !== 420420417)
        throw new NativeReceiptUnavailableError('Native receipt verification is not configured for this network.');
      const key = `${input.hash.toLowerCase()}:${input.block.number}:${input.block.hash ?? ''}:${input.block.index ?? ''}`;
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.receipt;
      if (active >= 4) throw new NativeReceiptUnavailableError('The native receipt archive is busy. Check this saved contribution again.');
      active += 1;
      const signal = AbortSignal.timeout(20_000);
      const request = async <T>(method: string, params: unknown[]): Promise<T> => {
        try {
          const id = ++requestId;
          const response = await fetchImpl(options.rpcUrl!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
          });
          if (!response.ok || !response.body) throw new Error('RPC response unavailable');
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              total += chunk.value.byteLength;
              if (total > 8 * 1024 * 1024) {
                await reader.cancel();
                throw new Error('RPC response too large');
              }
              chunks.push(chunk.value);
            }
          } finally {
            reader.releaseLock();
          }
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id: number; result?: T; error?: unknown };
          if (result.id !== id || result.error || !('result' in result)) throw new Error('RPC result unavailable');
          return result.result as T;
        } catch {
          throw new NativeReceiptUnavailableError('The native receipt archive did not respond. Check this saved contribution again.');
        }
      };
      try {
        const genesis = await request<Hash>('chain_getBlockHash', [0]);
        if (genesis !== PASEO_ASSET_HUB_GENESIS) throw new NativeReceiptUnavailableError('The native receipt archive is on the wrong network.');
        const blockHash = await request<Hash | null>('chain_getBlockHash', [input.block.number]);
        if (!blockHash) throw new NativeReceiptUnavailableError('The receipt block is unavailable from the native archive.');
        const metadata = await request<Hash>('state_getMetadata', [blockHash]);
        const digest = createHash('sha256').update(metadata).digest('hex');
        let decode = codecs.get(digest);
        if (!decode) {
          const events = getDynamicBuilder(getLookupFn(unifyMetadata(decAnyMetadata(metadata)))).buildStorage('System', 'Events');
          decode = bytes => events.value.dec(bytes) as EventRecord[];
          if (codecs.size >= 2) codecs.delete(codecs.keys().next().value!);
          codecs.set(digest, decode);
        }
        let status: NativeReceiptResponse['status'] = 'success';
        let logs: NativeContributionLog[] = [];
        try {
          logs = await readNativeContributionLogs(
            input.hash,
            { ...input.block, hash: input.block.hash ?? blockHash },
            {
              request,
              decodeEvents: decode,
              hashExtrinsic: bytes => toHex(Blake2256(bytes))
            }
          );
        } catch (error) {
          if (!(error instanceof FinalizedNativeContributionFailedError)) throw error;
          status = 'failed';
        }
        const receipt: NativeReceiptResponse = { ...input, block: { ...input.block, hash: blockHash }, genesisHash: genesis, status, logs };
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 30 * 60_000, receipt });
        return receipt;
      } finally {
        active -= 1;
      }
    }
  };
}
