// Bounded read-through for registered ciphertext only. Keys and clear audio
// never enter this service; the client still authenticates every DAV2 chunk.
import { parseAudioV2Container } from './audioV2.js';
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_RANGE_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 128;
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

export type MediaRange = { start: number; end: number };
export type EncryptedMedia = { bytes: Buffer; total: number; start: number; partial: boolean };
export class MediaError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(code === 'MEDIA_BUSY' ? 'Audio delivery is busy. Please try again.' : 'Audio could not be downloaded. Please try again.');
  }
}

export function parseMediaRange(value: string | undefined): MediaRange | null {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d+)$/.exec(value);
  const start = Number(match?.[1]);
  const end = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= MAX_BYTES || end - start + 1 > MAX_RANGE_BYTES)
    throw new MediaError(416, 'MEDIA_RANGE_INVALID');
  return { start, end };
}

export function encryptedMediaCid(ref: string): string | null {
  // A bare, bounded CID only: never paths, queries, credentials or caller URLs.
  return /^dotify:enc:(?:v2:(?:key-v[1-9][0-9]*:)?)?ipfs:\/\/((?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110}))$/.exec(ref)?.[1] ?? null;
}

export function createEncryptedMediaReader(fetchImpl: typeof fetch = fetch) {
  const cache = new Map<string, EncryptedMedia>();
  const pending = new Map<string, Promise<EncryptedMedia>>();
  let cacheBytes = 0;
  let active = 0;
  let reservedBytes = 0;
  let generation = 0;
  const store = (key: string, value: EncryptedMedia) => {
    cache.set(key, value);
    cacheBytes += value.bytes.length;
    while (cacheBytes > MAX_CACHE_BYTES || cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value!;
      cacheBytes -= cache.get(oldest)!.bytes.length;
      cache.delete(oldest);
    }
  };
  async function download(cid: string, range: MediaRange | null, dav2: boolean): Promise<EncryptedMedia> {
    for (const gateway of GATEWAYS) {
      const controller = new AbortController();
      // Hard total bound, including a slow/dripping body. No unbounded queues.
      const deadline = setTimeout(() => controller.abort(), 12_000);
      try {
        let url = `${gateway}/ipfs/${cid}`;
        let response: Response | undefined;
        for (let redirects = 0; redirects <= 2; redirects++) {
          response = await fetchImpl(url, {
            headers: range ? { Range: `bytes=${range.start}-${range.end}` } : {},
            signal: controller.signal,
            redirect: 'manual'
          });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get('location');
          void response.body?.cancel().catch(() => undefined);
          if (!location || redirects === 2) throw new Error('invalid redirect');
          const target = new URL(location, url);
          if (!safeGatewayRedirect(target)) throw new Error('untrusted redirect');
          url = target.href;
        }
        if (!response) continue;
        if (response.status !== (range ? 206 : 200)) {
          void response.body?.cancel().catch(() => undefined);
          continue;
        }
        const contentRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
        const lengthLimit = range ? range.end - range.start + 1 : MAX_BYTES;
        const declared = Number(response.headers.get('content-length'));
        if (declared > lengthLimit || (range && (!contentRange || Number(contentRange[1]) !== range.start || Number(contentRange[2]) > range.end))) {
          void response.body?.cancel().catch(() => undefined);
          continue;
        }
        const reader = response.body?.getReader();
        if (!reader) continue;
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > lengthLimit) throw new Error('oversized');
            chunks.push(Buffer.from(part.value));
          }
        } finally {
          void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        const total = range ? Number(contentRange![3]) : size;
        const expected = range ? Number(contentRange![2]) - range.start + 1 : size;
        if (!response.headers.has('content-encoding') && declared > 0 && size !== declared) continue;
        if (!size || size !== expected || !Number.isSafeInteger(total) || total < (range?.start ?? 0) + size || total > MAX_BYTES) continue;
        const bytes = Buffer.concat(chunks, size);
        if (!range && dav2) parseAudioV2Container(bytes);
        return { bytes, total, start: range?.start ?? 0, partial: Boolean(range) };
      } catch {
        // A transport failure can switch readers. Authentication never happens here.
      } finally {
        clearTimeout(deadline);
        controller.abort();
      }
    }
    throw new MediaError(502, 'MEDIA_UNAVAILABLE');
  }
  return {
    async read(cid: string, range: MediaRange | null, dav2 = false): Promise<EncryptedMedia> {
      const prefix = `${cid}:${dav2 ? 'dav2' : 'enc'}:`;
      const key = `${prefix}${range ? `${range.start}-${range.end}` : 'full'}`;
      const hit = cache.get(key);
      if (hit) {
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      const full = cache.get(`${prefix}full`);
      if (range && full && range.start < full.total) {
        return { bytes: full.bytes.subarray(range.start, Math.min(range.end + 1, full.total)), total: full.total, start: range.start, partial: true };
      }
      const shared = pending.get(key);
      if (shared) return shared;
      // Reserve worst-case body space before starting a cold read. One complete
      // object can coexist with a range, but never another complete object on
      // the 512 MiB API instance (assembly/validation also need working space).
      const reservation = range ? range.end - range.start + 1 : MAX_BYTES;
      if (active >= 2 || reservedBytes + reservation > MAX_BYTES + MAX_RANGE_BYTES) throw new MediaError(503, 'MEDIA_BUSY');
      active++;
      reservedBytes += reservation;
      const atStart = generation;
      const request = download(cid, range, dav2).then(value => {
        if (generation === atStart) store(key, value);
        return value;
      });
      pending.set(key, request);
      try {
        return await request;
      } finally {
        active--;
        reservedBytes -= reservation;
        pending.delete(key);
      }
    },
    clear() {
      generation++;
      cache.clear();
      cacheBytes = 0;
    }
  };
}
