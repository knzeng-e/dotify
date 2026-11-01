import { fetchBulletinPublicAsset } from './bulletinPublicAssets';
import { fetchThroughGateways } from './gatewayRace';

const CACHE = 'dotify-public-artwork-v1';
const MAX_ENTRIES = 48;
const MAX_DISK_IMAGE_BYTES = 1024 * 1024;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_MEMORY_BYTES = 16 * 1024 * 1024;
const memory = new Map<string, { url: string; bytes: number }>();
const pending = new Map<string, Promise<string>>();
let totalBytes = 0;
let activeReads = 0;
const waiting: Array<() => void> = [];
async function readSlot() {
  if (activeReads >= 4) await new Promise<void>(resolve => waiting.push(resolve));
  else activeReads += 1;
  return () => {
    const next = waiting.shift();
    if (next) next();
    else activeReads -= 1;
  };
}

// Only immutable IPFS image paths are eligible. Never use this store for audio,
// session tokens or keys; no artist/wallet identity enters the cache key.
export function artworkCacheKey(url: string): string | null {
  try {
    const path = new URL(url).pathname.match(/^(?:\/api\/assets)?\/ipfs\/(b[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/[^?#]*)?$/);
    if (!path || /(?:\.mp3|\.wav|\.dav2|\.json|\.bin|\/audio)(?:$|\/)/i.test(path[2] ?? '')) return null;
    return `https://dotify.artwork.invalid/ipfs/${path[1]}${path[2] ?? ''}`;
  } catch {
    return null;
  }
}

function remember(key: string, blob: Blob) {
  const previous = memory.get(key);
  if (previous) return previous.url;
  const url = URL.createObjectURL(blob);
  memory.set(key, { url, bytes: blob.size });
  totalBytes += blob.size;
  while (memory.size > MAX_ENTRIES || totalBytes > MAX_MEMORY_BYTES) {
    const oldest = memory.entries().next().value;
    if (!oldest) break;
    memory.delete(oldest[0]);
    totalBytes -= oldest[1].bytes;
    URL.revokeObjectURL(oldest[1].url);
  }
  return url;
}

async function boundedImage(response: Response): Promise<Blob> {
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!/^image\/(?:webp|png|jpeg|gif|avif)$/.test(type) || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES || !response.body)
    throw new Error('Artwork is not a bounded image.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Artwork exceeds the cache budget.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new Blob(chunks as BlobPart[], { type });
}

export async function loadPublicArtwork(urls: string[]): Promise<string> {
  const key = artworkCacheKey(urls[0] ?? '');
  if (!key) throw new Error('Only public immutable artwork can be cached.');
  const hit = memory.get(key);
  if (hit) {
    memory.delete(key);
    memory.set(key, hit);
    return hit.url;
  }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  if (pending.size >= 128) throw new Error('Artwork cache queue is full.');
  const task = (async () => {
    let disk: Cache | undefined;
    try {
      if (typeof caches !== 'undefined') {
        disk = await caches.open(CACHE);
        const saved = await disk.match(key);
        if (saved) return remember(key, await boundedImage(saved));
      }
    } catch {
      /* Private mode or Host storage restrictions do not block covers. */
    }
    const release = await readSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = urls[0]?.includes('/api/assets/ipfs/')
        ? await fetchBulletinPublicAsset(urls[0], controller.signal)
        : await fetchThroughGateways(urls, {
            signal: controller.signal,
            hedgeDelayMs: 500,
            timeoutMs: 8000,
            init: { cache: 'force-cache' },
            // Race complete image bodies: quick headers followed by a stalled body
            // must not prevent another gateway from winning.
            prepareResponse: async response => {
              const image = await boundedImage(response);
              return new Response(image, { headers: { 'content-type': image.type } });
            },
            label: 'cover'
          });
      const blob = await boundedImage(response);
      if (disk && blob.size <= MAX_DISK_IMAGE_BYTES) {
        try {
          await disk.put(key, new Response(blob, { headers: { 'content-type': blob.type } }));
          const keys = await disk.keys();
          for (const oldest of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await disk.delete(oldest);
        } catch {
          /* Quota exhaustion leaves a useful in-memory cover. */
        }
      }
      return remember(key, blob);
    } finally {
      clearTimeout(timeout);
      release();
    }
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
