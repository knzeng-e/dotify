import { ContractFunctionRevertedError, ContractFunctionZeroDataError, ExecutionRevertedError, ResponseBodyTooLargeError } from 'viem';
import { mapConcurrent } from './concurrency.js';
import { withDeadline } from '../deadline.js';

/** Admission policy for artist-controlled reads, not limits on the trusted directory. */
export const runtimeReadPolicy = {
  maxTracks: 1000,
  maxResponseBytes: 65_536,
  gas: 5_000_000n,
  callTimeoutMs: 10_000,
  scanTimeoutMs: 20_000
} as const;

export type RuntimeExclusionCode = 'execution-failed' | 'invalid-output' | 'track-limit' | 'response-limit' | 'scan-deadline';
const reasons: Record<RuntimeExclusionCode, string> = {
  'execution-failed': 'Runtime did not execute the required catalogue interface.',
  'invalid-output': 'Runtime returned incompatible catalogue data.',
  'track-limit': 'Runtime exceeds the catalogue track limit.',
  'response-limit': 'Runtime response exceeds the catalogue byte limit.',
  'scan-deadline': 'Runtime scan exceeds the catalogue time budget.'
};

export class CatalogRuntimeReadError extends Error {
  constructor(
    readonly runtimeAddress: `0x${string}`,
    readonly code: RuntimeExclusionCode
  ) {
    super(reasons[code]);
    this.name = 'CatalogRuntimeReadError';
  }
}

/** A readContract wrapper is not itself evidence of a contract fault: it can
 * wrap a provider outage. Inspect typed execution causes only, never messages. */
export function classifyRuntimeError(runtime: `0x${string}`, error: unknown): unknown {
  const seen = new Set<unknown>();
  for (let cause = error; cause instanceof Error && !seen.has(cause); cause = cause.cause) {
    seen.add(cause);
    if (cause instanceof ResponseBodyTooLargeError) return new CatalogRuntimeReadError(runtime, 'response-limit');
    if (cause instanceof ContractFunctionZeroDataError) return new CatalogRuntimeReadError(runtime, 'invalid-output');
    if (cause instanceof ContractFunctionRevertedError || cause instanceof ExecutionRevertedError)
      return new CatalogRuntimeReadError(runtime, 'execution-failed');
  }
  return error;
}

/** Viem's ordinary HTTP timeout ends at headers. Keep fetch AND body inside the
 * deadline, cancel the reader on excess, and return only bounded bytes to JSON
 * and ABI decoders. No detached Promise.race can outlive writer election. */
export async function fetchRuntimeRpc(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  owner: AbortSignal,
  timeoutMs: number = runtimeReadPolicy.callTimeoutMs,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  const signal = init?.signal ? AbortSignal.any([owner, init.signal]) : owner;
  return withDeadline(signal, timeoutMs, async deadline => {
    const response = await fetchFn(input, { ...init, signal: deadline });
    const reader = response.body?.getReader();
    if (!reader) return response;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const cancel = () => {
      void reader.cancel(deadline.reason).catch(() => undefined);
    };
    deadline.addEventListener('abort', cancel, { once: true });
    try {
      while (true) {
        deadline.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > runtimeReadPolicy.maxResponseBytes) {
          // Non-OK provider errors are transport failures, not artist faults.
          if (!response.ok) throw new Error('Catalogue RPC error response exceeds byte budget');
          throw new ResponseBodyTooLargeError({ maxSize: runtimeReadPolicy.maxResponseBytes, size });
        }
        chunks.push(chunk.value);
      }
      deadline.throwIfAborted();
      return new Response(Buffer.concat(chunks, size), { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally {
      deadline.removeEventListener('abort', cancel);
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  });
}

/** Preserve a concurrent provider failure even if another call fails locally.
 * Started calls drain before a runtime exclusion or writer release is returned. */
export async function mapRuntimeReads<T, U>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<U>): Promise<U[]> {
  const results = await mapConcurrent(items, limit, async (item, index) => {
    try {
      return { value: await work(item, index) };
    } catch (error) {
      if (!(error instanceof CatalogRuntimeReadError)) throw error;
      return { error };
    }
  });
  const failed = results.find(result => result.error);
  if (failed) throw failed.error;
  return results.map(result => result.value!);
}
