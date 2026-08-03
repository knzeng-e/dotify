// Bounded, hedged reads across a list of interchangeable gateway URLs.
//
// The serial alternative - await each gateway in turn with no timeout - makes
// one unresponsive gateway cost the user the browser's full connection
// timeout before the next candidate is even attempted, and the browser will
// happily stall a request for far longer than a listener will wait for sound.
// Every URL here addresses the same immutable CID, so racing them is free of
// consistency concerns: whichever answers first is the same object.
//
// This is the whole-object sibling of `audioV2Gateway`, which does the same
// for byte ranges. It lives under services/ with no project imports so
// `pinata` can use it without depending on a feature module.

export type GatewayRaceOptions = {
  /** Time budget for one gateway to return response headers. */
  timeoutMs?: number;
  /** Wait before racing the next gateway alongside the current one. */
  hedgeDelayMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Request init applied to every attempt. `signal` is managed internally. */
  init?: Omit<RequestInit, 'signal'>;
  /** Label used in the aggregate error when every gateway fails. */
  label?: string;
};

type AttemptOutcome =
  | { ok: true; id: number; response: Response; url: string; controller: AbortController }
  | { ok: false; id: number; error: unknown; url: string };

type Attempt = {
  id: number;
  controller: AbortController;
  promise: Promise<AttemptOutcome>;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_HEDGE_DELAY_MS = 1_200;
const MAX_PARALLEL_ATTEMPTS = 3;

function createAbortError(message: string): Error {
  if (typeof DOMException !== 'undefined') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined, message: string): void {
  if (signal?.aborted) throw createAbortError(message);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function makeAttempt(id: number, url: string, timeoutMs: number, fetchImpl: typeof fetch, init: Omit<RequestInit, 'signal'>, signal?: AbortSignal): Attempt {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  // Bounds time-to-headers only. Once a gateway starts answering, the body is
  // allowed to stream at its own pace - cutting a healthy download short would
  // trade a slow track for a broken one.
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const promise = fetchImpl(url, { ...init, signal: controller.signal })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Gateway ${url} returned ${response.status}`);
      }
      return { ok: true as const, id, response, url, controller };
    })
    .catch(error => ({ ok: false as const, id, error, url }))
    .finally(() => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromParent);
    });

  return { id, controller, promise };
}

/**
 * Fetch the first successful response among interchangeable gateway URLs.
 *
 * Attempts start staggered rather than all at once, so a healthy primary
 * gateway still serves nearly every read alone and slow ones stop blocking the
 * queue behind them. Losing attempts are aborted as soon as a winner is known;
 * the winner's own abort controller is never triggered, so its body stays
 * readable by the caller.
 */
export async function fetchThroughGateways(urls: string[], options: GatewayRaceOptions = {}): Promise<Response> {
  const message = `${options.label ?? 'Gateway'} read cancelled`;
  throwIfAborted(options.signal, message);

  if (urls.length === 0) {
    throw new Error(`No gateways configured for ${options.label ?? 'this read'}`);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hedgeDelayMs = options.hedgeDelayMs ?? DEFAULT_HEDGE_DELAY_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const init = options.init ?? {};

  const active = new Map<number, Attempt>();
  let nextUrlIndex = 0;
  let nextAttemptId = 0;
  let lastError: unknown;

  // A caller abort must stop the queue where it is. Without this guard the
  // failure branch below would answer each in-flight abort by starting the
  // next gateway, turning one cancellation into a walk down the whole list.
  const launch = () => {
    if (options.signal?.aborted || nextUrlIndex >= urls.length) return;
    const url = urls[nextUrlIndex];
    nextUrlIndex += 1;
    const attempt = makeAttempt(nextAttemptId, url, timeoutMs, fetchImpl, init, options.signal);
    nextAttemptId += 1;
    active.set(attempt.id, attempt);
  };

  launch();

  try {
    while (active.size > 0) {
      throwIfAborted(options.signal, message);

      const canHedge = active.size < MAX_PARALLEL_ATTEMPTS && nextUrlIndex < urls.length;
      const raceItems: Array<Promise<AttemptOutcome | { hedge: true }>> = Array.from(active.values()).map(attempt => attempt.promise);
      let hedgeTimerId: ReturnType<typeof setTimeout> | undefined;
      if (canHedge) {
        raceItems.push(
          new Promise<{ hedge: true }>(resolve => {
            hedgeTimerId = setTimeout(() => resolve({ hedge: true }), hedgeDelayMs);
          })
        );
      }

      const outcome = await Promise.race(raceItems);
      if (hedgeTimerId) clearTimeout(hedgeTimerId);

      if ('hedge' in outcome) {
        launch();
        continue;
      }

      active.delete(outcome.id);

      if (outcome.ok) {
        if (options.signal?.aborted) {
          // A late abort still has to stop the winner: it is no longer in
          // `active`, so the finally block below would not reach it.
          outcome.controller.abort();
          throwIfAborted(options.signal, message);
        }
        for (const attempt of active.values()) {
          attempt.controller.abort();
        }
        active.clear();
        // `makeAttempt` detaches its parent-abort link once headers arrive, but
        // the body has only just started streaming. Re-link the winner so a
        // caller that cancels - a listener skipping to another track - actually
        // stops the download instead of leaving it to run to completion unread.
        options.signal?.addEventListener('abort', () => outcome.controller.abort(), { once: true });
        return outcome.response;
      }

      lastError = outcome.error;
      if (active.size === 0 && nextUrlIndex < urls.length) {
        launch();
      }
    }
  } finally {
    // Covers the abort/throw paths; the success path already cleared `active`.
    for (const attempt of active.values()) {
      attempt.controller.abort();
    }
  }

  throwIfAborted(options.signal, message);
  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${options.label ?? 'resource'}: ${formatError(lastError)}`);
}
