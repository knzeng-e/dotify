// Bounded ciphertext delivery for fixed objects of registered streaming releases.
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 64;
const GATEWAYS = ['https://gateway.pinata.cloud', 'https://ipfs.io', 'https://dweb.link'];
function safeGatewayRedirect(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    (['gateway.pinata.cloud', 'ipfs.io', 'dweb.link'].includes(url.hostname) ||
      url.hostname.endsWith('.ipfs.dweb.link') ||
      url.hostname.endsWith('.ipfs.ipfs.io'))
  );
}

export type EncryptedMedia = { bytes: Buffer };
type PendingRead = { controller: AbortController; promise: Promise<EncryptedMedia>; consumers: number; settled: boolean };
export class MediaError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(code === 'MEDIA_BUSY' ? 'Audio delivery is busy. Please try again.' : 'Audio could not be downloaded. Please try again.');
  }
}
export function encryptedMediaCid(ref: string): string | null {
  return /^dotify:enc:v3:key-v(?:[2-9]|[1-9][0-9]+):ipfs:\/\/((?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110}))$/.exec(ref)?.[1] ?? null;
}
function objectBudget(object: string): number {
  if (
    !/^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110})\/(?:manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/.test(
      object
    )
  )
    throw new MediaError(404, 'MEDIA_NOT_FOUND');
  return object.endsWith('/manifest.json') ? 256 * 1024 : 1024 * 1024 + 16;
}
export function createEncryptedMediaReader(fetchImpl: typeof fetch = fetch) {
  const cache = new Map<string, EncryptedMedia>();
  const pending = new Map<string, PendingRead>();
  let cacheBytes = 0,
    active = 0,
    generation = 0;
  const store = (key: string, value: EncryptedMedia) => {
    const previous = cache.get(key);
    if (previous) cacheBytes -= previous.bytes.length;
    cache.delete(key);
    cache.set(key, value);
    cacheBytes += value.bytes.length;
    while (cacheBytes > MAX_CACHE_BYTES || cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value!;
      cacheBytes -= cache.get(oldest)!.bytes.length;
      cache.delete(oldest);
    }
  };
  async function download(object: string, signal: AbortSignal): Promise<EncryptedMedia> {
    const maxBytes = objectBudget(object);
    for (const gateway of GATEWAYS) {
      signal.throwIfAborted();
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 12_000);
      try {
        let url = `${gateway}/ipfs/${object}`;
        let response: Response | undefined;
        for (let redirects = 0; redirects <= 2; redirects++) {
          response = await fetchImpl(url, { signal: AbortSignal.any([controller.signal, signal]), redirect: 'manual' });
          signal.throwIfAborted();
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get('location');
          void response.body?.cancel().catch(() => undefined);
          if (!location || redirects === 2) throw new Error('invalid redirect');
          const target = new URL(location, url);
          if (!safeGatewayRedirect(target)) throw new Error('untrusted redirect');
          url = target.href;
        }
        if (!response) continue;
        const declared = Number(response.headers.get('content-length'));
        if (response.status !== 200 || declared > maxBytes) {
          await response.body?.cancel();
          continue;
        }
        const reader = response.body?.getReader();
        if (!reader) continue;
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            signal.throwIfAborted();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > maxBytes) throw new Error('oversized');
            chunks.push(Buffer.from(part.value));
          }
        } finally {
          void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        if (!size || (!response.headers.has('content-encoding') && declared > 0 && size !== declared)) continue;
        return { bytes: Buffer.concat(chunks, size) };
      } catch {
        signal.throwIfAborted();
      } finally {
        clearTimeout(deadline);
        controller.abort();
      }
    }
    throw new MediaError(502, 'MEDIA_UNAVAILABLE');
  }
  function subscribe(key: string, operation: PendingRead, signal?: AbortSignal): Promise<EncryptedMedia> {
    operation.consumers++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = () => {
        if (finished) return false;
        finished = true;
        signal?.removeEventListener('abort', abort);
        operation.consumers--;
        if (!operation.consumers && !operation.settled) {
          // Detach before aborting so a new caller cannot join an abandoned read.
          if (pending.get(key) === operation) pending.delete(key);
          operation.controller.abort();
        }
        return true;
      };
      const abort = () => {
        if (finish()) reject(signal!.reason);
      };
      // Both handlers remain attached even if this consumer has already left,
      // so a last-consumer abort can never create an unhandled rejection.
      operation.promise.then(
        value => {
          if (finish()) resolve(value);
        },
        error => {
          if (finish()) reject(error);
        }
      );
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  return {
    async read(object: string, signal?: AbortSignal): Promise<EncryptedMedia> {
      signal?.throwIfAborted();
      objectBudget(object);
      const hit = cache.get(object);
      if (hit) {
        cache.delete(object);
        cache.set(object, hit);
        return hit;
      }
      const shared = pending.get(object);
      if (shared) return subscribe(object, shared, signal);
      if (active >= 2) throw new MediaError(503, 'MEDIA_BUSY');
      active++;
      const atStart = generation;
      const controller = new AbortController();
      const promise = Promise.resolve()
        .then(() => download(object, controller.signal))
        .then(value => {
          if (!controller.signal.aborted && generation === atStart) store(object, value);
          return value;
        })
        .finally(() => {
          operation.settled = true;
          active--;
          if (pending.get(object) === operation) pending.delete(object);
        });
      const operation: PendingRead = { controller, promise, consumers: 0, settled: false };
      pending.set(object, operation);
      return subscribe(object, operation, signal);
    },
    clear() {
      generation++;
      cache.clear();
      cacheBytes = 0;
    }
  };
}
