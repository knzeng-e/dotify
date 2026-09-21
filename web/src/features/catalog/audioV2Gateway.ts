import { getAudioGatewayUrls } from '../../services/pinata';

export type AudioV2GatewayPhase = 'header' | 'first-chunk' | 'chunk';

export type AudioV2RangeResult = {
  bytes: Uint8Array;
  gatewayUrl: string;
  elapsedMs: number;
  fromCache: boolean;
  hedged: boolean;
  recovered: boolean;
  intentPrefetched?: boolean;
};

type RangeFetchOptions = {
  phase?: AudioV2GatewayPhase;
  timeoutMs?: number;
  hedgeDelayMs?: number;
  hedge?: boolean;
  fetchImpl?: typeof fetch;
  getGatewayUrlsForCid?: (cid: string) => string[];
  signal?: AbortSignal;
  skipIntentCache?: boolean;
};

type AttemptOutcome =
  | {
      ok: true;
      id: number;
      bytes: Uint8Array;
      gatewayUrl: string;
      elapsedMs: number;
      fromCache: boolean;
    }
  | {
      ok: false;
      id: number;
      error: unknown;
      gatewayUrl: string;
      elapsedMs: number;
    };

type Attempt = {
  id: number;
  controller: AbortController;
  promise: Promise<AttemptOutcome>;
};

export const AUDIO_V2_RANGE_TIMEOUT_MS = 12_000;
export const AUDIO_V2_HEDGE_DELAY_MS = 6_500;
export const AUDIO_V2_RANGE_ATTEMPTS_PER_GATEWAY = 2;
const MAX_PARALLEL_HEDGED_RANGES = 2;
const AUDIO_V2_INTENT_CACHE_TTL_MS = 90_000;
const AUDIO_V2_INTENT_CACHE_MAX_ENTRIES = 8;
const AUDIO_V2_INTENT_CACHE_MAX_BYTES = 3 * 1024 * 1024;

const winningGatewayByCid = new Map<string, string>();
const intentRangeCache = new Map<string, { result: AudioV2RangeResult; expiresAt: number; cid: string }>();
const intentRangeLeases = new Map<symbol, ReadonlySet<string>>();
const intentRangeRequests = new Map<string, Promise<AudioV2RangeResult>>();
let intentRangeCacheBytes = 0;
let intentCacheGeneration = 0;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function orderGatewaysForCid(cid: string, gateways: string[]): { ordered: string[]; cachedGateway: string | undefined } {
  const cachedGateway = winningGatewayByCid.get(cid);
  if (!cachedGateway || !gateways.includes(cachedGateway)) return { ordered: gateways, cachedGateway: undefined };
  return { ordered: [cachedGateway, ...gateways.filter(gateway => gateway !== cachedGateway)], cachedGateway };
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRetryableRangeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  return /failed to fetch|load failed|network|returned 5\d\d/i.test(error.message);
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('DAV2 gateway range request cancelled', 'AbortError');
  const error = new Error('DAV2 gateway range request cancelled');
  error.name = 'AbortError';
  return error;
}

function intentRangeKey(cid: string, start: number, end: number): string {
  return `${cid}:${start}-${end}`;
}

function removeIntentRange(key: string): void {
  const entry = intentRangeCache.get(key);
  if (!entry) return;
  intentRangeCacheBytes -= entry.result.bytes.byteLength;
  intentRangeCache.delete(key);
}

function readIntentRange(key: string): AudioV2RangeResult | null {
  const entry = intentRangeCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now() && ![...intentRangeLeases.values()].some(cids => cids.has(entry.cid))) {
    removeIntentRange(key);
    return null;
  }

  // Refresh insertion order so eviction behaves as a tiny LRU.
  // A leased neighbor can wait through a long track. Once chosen, give real
  // playback the ordinary TTL to consume its ranges after access verification.
  if ([...intentRangeLeases.values()].some(cids => cids.has(entry.cid))) entry.expiresAt = Date.now() + AUDIO_V2_INTENT_CACHE_TTL_MS;
  intentRangeCache.delete(key);
  intentRangeCache.set(key, entry);
  return { ...entry.result, elapsedMs: 0, intentPrefetched: true };
}

function storeIntentRange(key: string, cid: string, result: AudioV2RangeResult): void {
  removeIntentRange(key);
  intentRangeCache.set(key, { cid, result: { ...result, intentPrefetched: false }, expiresAt: Date.now() + AUDIO_V2_INTENT_CACHE_TTL_MS });
  intentRangeCacheBytes += result.bytes.byteLength;

  while (intentRangeCache.size > AUDIO_V2_INTENT_CACHE_MAX_ENTRIES || intentRangeCacheBytes > AUDIO_V2_INTENT_CACHE_MAX_BYTES) {
    const oldestKey = intentRangeCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    removeIntentRange(oldestKey);
  }
}

function waitForSharedIntentRange(request: Promise<AudioV2RangeResult>, signal?: AbortSignal): Promise<AudioV2RangeResult> {
  if (!signal) return request;
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    request.then(
      result => {
        cleanup();
        resolve(result);
      },
      error => {
        cleanup();
        reject(error);
      }
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function validateRangeBytes(response: Response, bytes: Uint8Array, gatewayUrl: string, start: number, end: number, phase: AudioV2GatewayPhase): void {
  const expectedLength = end - start + 1;
  if (bytes.length === 0 || bytes.length > expectedLength || (phase !== 'header' && bytes.length !== expectedLength)) {
    throw new Error(`Gateway ${gatewayUrl} returned ${bytes.length} bytes for range ${start}-${end}`);
  }

  const contentRange = response.headers.get('content-range');
  if (!contentRange) return;
  const match = /^bytes (\d+)-(\d+)\/(?:\d+|\*)$/i.exec(contentRange.trim());
  if (!match) throw new Error(`Gateway ${gatewayUrl} returned an invalid Content-Range header`);

  const responseStart = Number(match[1]);
  const responseEnd = Number(match[2]);
  if (responseStart !== start || responseEnd > end || responseEnd - responseStart + 1 !== bytes.length) {
    throw new Error(`Gateway ${gatewayUrl} returned mismatched Content-Range ${contentRange}`);
  }
}

function makeRangeAttempt(
  id: number,
  gatewayUrl: string,
  start: number,
  end: number,
  phase: AudioV2GatewayPhase,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  cachedGateway: string | undefined,
  signal?: AbortSignal
): Attempt {
  const controller = new AbortController();
  const startedAt = nowMs();
  const abortFromParent = () => controller.abort();
  const rangeHeader = `bytes=${start}-${end}`;

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const promise = (async (): Promise<AttemptOutcome> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < AUDIO_V2_RANGE_ATTEMPTS_PER_GATEWAY; attempt += 1) {
      try {
        const response = await fetchImpl(gatewayUrl, {
          headers: { Range: rangeHeader },
          signal: controller.signal
        });
        if (response.status !== 206) {
          throw new Error(`Gateway ${gatewayUrl} did not serve a range (${response.status})`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        validateRangeBytes(response, bytes, gatewayUrl, start, end, phase);
        return {
          ok: true as const,
          id,
          bytes,
          gatewayUrl,
          elapsedMs: Number((nowMs() - startedAt).toFixed(1)),
          fromCache: gatewayUrl === cachedGateway
        };
      } catch (error) {
        lastError = error;
        if (controller.signal.aborted || attempt === AUDIO_V2_RANGE_ATTEMPTS_PER_GATEWAY - 1 || !isRetryableRangeError(error)) {
          return {
            ok: false as const,
            id,
            error,
            gatewayUrl,
            elapsedMs: Number((nowMs() - startedAt).toFixed(1))
          };
        }
      }
    }
    return {
      ok: false as const,
      id,
      error: lastError ?? new Error(`Gateway ${gatewayUrl} did not return a range`),
      gatewayUrl,
      elapsedMs: Number((nowMs() - startedAt).toFixed(1))
    };
  })().finally(() => {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  });

  return { id, controller, promise };
}

function shouldHedgePhase(phase: AudioV2GatewayPhase): boolean {
  return phase === 'header' || phase === 'first-chunk';
}

export function clearAudioV2GatewayCache(): void {
  winningGatewayByCid.clear();
  intentRangeCache.clear();
  intentRangeRequests.clear();
  intentRangeLeases.clear();
  intentRangeCacheBytes = 0;
  intentCacheGeneration += 1;
}

/** Keep at most two active neighbors warm through long tracks. The 3 MiB LRU
 * budget still wins; this lease affects age only and contains no clear media. */
export function retainAudioV2IntentRanges(cids: readonly string[]): () => void {
  const lease = Symbol('playback-neighbors');
  intentRangeLeases.set(lease, new Set(cids.slice(0, 2)));
  return () => {
    intentRangeLeases.delete(lease);
  };
}

/**
 * Remove one speculative encrypted range after the caller discovers that its
 * contents are not a valid DAV2 structure. Transport-level range validation
 * cannot establish that semantic guarantee on its own.
 */
export function evictAudioV2IntentRange(cid: string, start: number, end: number): void {
  removeIntentRange(intentRangeKey(cid, start, end));
}

export function getCachedAudioV2Gateway(cid: string): string | undefined {
  return winningGatewayByCid.get(cid);
}

export async function fetchAudioV2RangeThroughGateways(cid: string, start: number, end: number, options: RangeFetchOptions = {}): Promise<AudioV2RangeResult> {
  throwIfAborted(options.signal);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new Error(`Invalid DAV2 range ${start}-${end}`);
  }

  const intentKey = intentRangeKey(cid, start, end);
  if (!options.skipIntentCache) {
    const cached = readIntentRange(intentKey);
    if (cached) return cached;
    const pending = intentRangeRequests.get(intentKey);
    if (pending) {
      try {
        const result = await waitForSharedIntentRange(pending, options.signal);
        return { ...result, elapsedMs: 0, intentPrefetched: true };
      } catch (error) {
        throwIfAborted(options.signal);
        // A speculative request can be cancelled or fail independently. The
        // real playback request still gets its own bounded gateway attempt.
        if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
          console.info('[dotify.dav2.intent] prefetch unavailable, retrying for playback');
        }
      }
    }
  }

  const phase = options.phase ?? 'chunk';
  const timeoutMs = options.timeoutMs ?? AUDIO_V2_RANGE_TIMEOUT_MS;
  const hedgeDelayMs = options.hedgeDelayMs ?? AUDIO_V2_HEDGE_DELAY_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const gateways = options.getGatewayUrlsForCid?.(cid) ?? getAudioGatewayUrls(cid);
  const { ordered, cachedGateway } = orderGatewaysForCid(cid, gateways);
  const shouldHedge = options.hedge ?? shouldHedgePhase(phase);

  if (ordered.length === 0) throw new Error(`No IPFS gateways configured for DAV2 CID ${cid}`);
  const active = new Map<number, Attempt>();
  let nextGatewayIndex = 0;
  let nextAttemptId = 0;
  let hedged = false;
  let lastError: unknown;

  const launch = () => {
    const gatewayUrl = ordered[nextGatewayIndex];
    nextGatewayIndex += 1;
    const attempt = makeRangeAttempt(nextAttemptId, gatewayUrl, start, end, phase, timeoutMs, fetchImpl, cachedGateway, options.signal);
    nextAttemptId += 1;
    active.set(attempt.id, attempt);
  };

  launch();

  while (active.size > 0) {
    throwIfAborted(options.signal);

    const canLaunchHedge = shouldHedge && active.size < MAX_PARALLEL_HEDGED_RANGES && nextGatewayIndex < ordered.length;
    const raceItems: Array<Promise<AttemptOutcome | { hedge: true }>> = Array.from(active.values()).map(attempt => attempt.promise);
    let hedgeTimerId: ReturnType<typeof setTimeout> | undefined;
    if (canLaunchHedge) {
      raceItems.push(
        new Promise<{ hedge: true }>(resolve => {
          hedgeTimerId = setTimeout(() => resolve({ hedge: true }), hedgeDelayMs);
        })
      );
    }

    const outcome = await Promise.race(raceItems);
    if (hedgeTimerId) clearTimeout(hedgeTimerId);
    throwIfAborted(options.signal);

    if ('hedge' in outcome) {
      hedged = true;
      launch();
      continue;
    }

    active.delete(outcome.id);
    if (outcome.ok) {
      for (const attempt of active.values()) {
        attempt.controller.abort();
      }
      winningGatewayByCid.set(cid, outcome.gatewayUrl);
      return {
        bytes: outcome.bytes,
        gatewayUrl: outcome.gatewayUrl,
        elapsedMs: outcome.elapsedMs,
        fromCache: outcome.fromCache,
        hedged,
        recovered: outcome.id > 0,
        intentPrefetched: false
      };
    }

    lastError = outcome.error;
    if (active.size === 0 && nextGatewayIndex < ordered.length) {
      launch();
    }
  }

  throw new Error(`Unable to fetch DAV2 range ${start}-${end} for CID ${cid}: ${formatError(lastError)}`);
}

/**
 * Warm one exact encrypted range without touching access checks or content
 * keys. Playback reuses the in-flight request or the short-lived bounded bytes.
 */
export async function prefetchAudioV2RangeThroughGateways(
  cid: string,
  start: number,
  end: number,
  options: RangeFetchOptions = {}
): Promise<AudioV2RangeResult> {
  const key = intentRangeKey(cid, start, end);
  const cached = readIntentRange(key);
  if (cached) return cached;
  const pending = intentRangeRequests.get(key);
  if (pending) return waitForSharedIntentRange(pending, options.signal);

  const generation = intentCacheGeneration;
  const request = fetchAudioV2RangeThroughGateways(cid, start, end, { ...options, skipIntentCache: true });
  intentRangeRequests.set(key, request);
  try {
    const result = await request;
    if (generation === intentCacheGeneration) storeIntentRange(key, cid, result);
    return result;
  } finally {
    if (intentRangeRequests.get(key) === request) intentRangeRequests.delete(key);
  }
}
