/** Per-reader aggregate only: no media identity, URL, key or persistent storage.
 * Parallel work durations overlap and must not be added to elapsed wall time. */
export type StreamingReadTimings = {
  objectsRead: number;
  objectsDecrypted: number;
  encryptedBytes: number;
  cachedObjects: number;
  hostObjects: number;
  httpObjects: number;
  recoveredObjects: number;
  readWorkMs: number;
  decryptWorkMs: number;
  maxReadMs: number;
  // Optional for older/custom readers. Work includes failed and cancelled phases.
  relayWaitMs?: number;
  nativeReadMs?: number;
  httpHeadersMs?: number;
  httpBodyMs?: number;
  nativeReadAttempts?: number;
  nativeReadFailures?: number;
  httpRequests?: number;
  httpBodyReads?: number;
  httpFailures?: number;
};

export type StreamingTransportPhase = 'relay-wait' | 'native-read' | 'http-headers' | 'http-body';
export type StreamingTransportMetric = { phase: StreamingTransportPhase; elapsedMs: number; failed: boolean };

/** Observe the existing operation, including rejection, without changing its outcome.
 * Header timing includes browser scheduling, connection and server work, not pure RTT. */
export async function measureStreamingTransport<T>(
  phase: StreamingTransportPhase,
  run: () => Promise<T>,
  observe?: (metric: StreamingTransportMetric) => void,
  rejected?: (result: T) => boolean
): Promise<T> {
  const start = performance.now();
  let failed = true;
  try {
    const result = await run();
    failed = rejected?.(result) ?? false;
    return result;
  } finally {
    try {
      observe?.({ phase, elapsedMs: Math.max(0, performance.now() - start), failed });
    } catch {
      // Diagnostics must not fail playback or turn a rejected read into success.
    }
  }
}

export function createStreamingReadTimings(now: () => number = () => performance.now()) {
  const counters: Required<StreamingReadTimings> = {
    objectsRead: 0,
    objectsDecrypted: 0,
    encryptedBytes: 0,
    cachedObjects: 0,
    hostObjects: 0,
    httpObjects: 0,
    recoveredObjects: 0,
    readWorkMs: 0,
    decryptWorkMs: 0,
    maxReadMs: 0,
    relayWaitMs: 0,
    nativeReadMs: 0,
    httpHeadersMs: 0,
    httpBodyMs: 0,
    nativeReadAttempts: 0,
    nativeReadFailures: 0,
    httpRequests: 0,
    httpBodyReads: 0,
    httpFailures: 0
  };
  return {
    observeTransport({ phase, elapsedMs, failed }: StreamingTransportMetric) {
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
      switch (phase) {
        case 'relay-wait':
          counters.relayWaitMs += elapsedMs;
          break;
        case 'native-read':
          counters.nativeReadMs += elapsedMs;
          counters.nativeReadAttempts++;
          if (failed) counters.nativeReadFailures++;
          break;
        case 'http-headers':
          counters.httpHeadersMs += elapsedMs;
          counters.httpRequests++;
          if (failed) counters.httpFailures++;
          break;
        case 'http-body':
          counters.httpBodyMs += elapsedMs;
          counters.httpBodyReads++;
          if (failed) counters.httpFailures++;
          break;
      }
    },
    async read<T extends Uint8Array>(
      run: () => Promise<T>,
      transport: () => { fromCache?: boolean; gatewayUrl?: string; gatewayRecovered?: boolean }
    ): Promise<T> {
      const start = now();
      try {
        const bytes = await run();
        const observation = transport();
        counters.objectsRead++;
        counters.encryptedBytes += bytes.length;
        if (observation.fromCache) counters.cachedObjects++;
        else if (observation.gatewayUrl === 'polkadot:bulletin') counters.hostObjects++;
        else if (/^https?:\/\//.test(observation.gatewayUrl ?? '')) counters.httpObjects++;
        if (observation.gatewayRecovered) counters.recoveredObjects++;
        return bytes;
      } finally {
        const elapsed = Math.max(0, now() - start);
        counters.readWorkMs += elapsed;
        counters.maxReadMs = Math.max(counters.maxReadMs, elapsed);
      }
    },
    async decrypt<T>(run: () => Promise<T>): Promise<T> {
      const start = now();
      try {
        const result = await run();
        counters.objectsDecrypted++;
        return result;
      } finally {
        counters.decryptWorkMs += Math.max(0, now() - start);
      }
    },
    snapshot: (): StreamingReadTimings => ({ ...counters })
  };
}
