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
};

export function createStreamingReadTimings(now: () => number = () => performance.now()) {
  const counters: StreamingReadTimings = {
    objectsRead: 0,
    objectsDecrypted: 0,
    encryptedBytes: 0,
    cachedObjects: 0,
    hostObjects: 0,
    httpObjects: 0,
    recoveredObjects: 0,
    readWorkMs: 0,
    decryptWorkMs: 0,
    maxReadMs: 0
  };
  return {
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
