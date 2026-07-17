import { getGatewayUrls } from '../../services/pinata';

export type AudioV2GatewayPhase = 'header' | 'first-chunk' | 'chunk';

export type AudioV2RangeResult = {
  bytes: Uint8Array;
  gatewayUrl: string;
  elapsedMs: number;
  fromCache: boolean;
  hedged: boolean;
};

type RangeFetchOptions = {
  phase?: AudioV2GatewayPhase;
  timeoutMs?: number;
  hedgeDelayMs?: number;
  hedge?: boolean;
  fetchImpl?: typeof fetch;
  getGatewayUrlsForCid?: (cid: string) => string[];
  signal?: AbortSignal;
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

const DEFAULT_RANGE_TIMEOUT_MS = 5_000;
const DEFAULT_HEDGE_DELAY_MS = 700;
const MAX_PARALLEL_HEDGED_RANGES = 2;

const winningGatewayByCid = new Map<string, string>();

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

function makeRangeAttempt(
  id: number,
  gatewayUrl: string,
  rangeHeader: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  cachedGateway: string | undefined,
  signal?: AbortSignal
): Attempt {
  const controller = new AbortController();
  const startedAt = nowMs();
  const abortFromParent = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const promise = fetchImpl(gatewayUrl, {
    headers: { Range: rangeHeader },
    signal: controller.signal
  })
    .then(async response => {
      if (response.status !== 206) {
        throw new Error(`Gateway ${gatewayUrl} did not serve a range (${response.status})`);
      }
      return {
        ok: true as const,
        id,
        bytes: new Uint8Array(await response.arrayBuffer()),
        gatewayUrl,
        elapsedMs: Number((nowMs() - startedAt).toFixed(1)),
        fromCache: gatewayUrl === cachedGateway
      };
    })
    .catch(error => ({
      ok: false as const,
      id,
      error,
      gatewayUrl,
      elapsedMs: Number((nowMs() - startedAt).toFixed(1))
    }))
    .finally(() => {
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
}

export function getCachedAudioV2Gateway(cid: string): string | undefined {
  return winningGatewayByCid.get(cid);
}

export async function fetchAudioV2RangeThroughGateways(cid: string, start: number, end: number, options: RangeFetchOptions = {}): Promise<AudioV2RangeResult> {
  const phase = options.phase ?? 'chunk';
  const timeoutMs = options.timeoutMs ?? DEFAULT_RANGE_TIMEOUT_MS;
  const hedgeDelayMs = options.hedgeDelayMs ?? DEFAULT_HEDGE_DELAY_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const gateways = options.getGatewayUrlsForCid?.(cid) ?? getGatewayUrls(cid);
  const { ordered, cachedGateway } = orderGatewaysForCid(cid, gateways);
  const shouldHedge = options.hedge ?? shouldHedgePhase(phase);

  if (ordered.length === 0) throw new Error(`No IPFS gateways configured for DAV2 CID ${cid}`);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new Error(`Invalid DAV2 range ${start}-${end}`);
  }

  const rangeHeader = `bytes=${start}-${end}`;
  const active = new Map<number, Attempt>();
  let nextGatewayIndex = 0;
  let nextAttemptId = 0;
  let hedged = false;
  let lastError: unknown;

  const launch = () => {
    const gatewayUrl = ordered[nextGatewayIndex];
    nextGatewayIndex += 1;
    const attempt = makeRangeAttempt(nextAttemptId, gatewayUrl, rangeHeader, timeoutMs, fetchImpl, cachedGateway, options.signal);
    nextAttemptId += 1;
    active.set(attempt.id, attempt);
  };

  launch();

  while (active.size > 0) {
    const canLaunchHedge = shouldHedge && active.size < MAX_PARALLEL_HEDGED_RANGES && nextGatewayIndex < ordered.length;
    const raceItems: Array<Promise<AttemptOutcome | { hedge: true }>> = Array.from(active.values()).map(attempt => attempt.promise);
    if (canLaunchHedge) {
      raceItems.push(
        new Promise<{ hedge: true }>(resolve => {
          setTimeout(() => resolve({ hedge: true }), hedgeDelayMs);
        })
      );
    }

    const outcome = await Promise.race(raceItems);
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
        hedged
      };
    }

    lastError = outcome.error;
    if (active.size === 0 && nextGatewayIndex < ordered.length) {
      launch();
    }
  }

  throw new Error(`Unable to fetch DAV2 range ${start}-${end} for CID ${cid}: ${formatError(lastError)}`);
}
