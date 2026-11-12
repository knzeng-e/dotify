import { fetchBulletinPublicAsset } from './bulletinPublicAssets';
import { fetchThroughGateways } from './gatewayRace';

const CACHE = 'dotify-public-artwork-v1';
const MAX_ENTRIES = 48;
const MAX_DISK_IMAGE_BYTES = 1024 * 1024;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_MEMORY_BYTES = 16 * 1024 * 1024;
const DISK_READ_TIMEOUT_MS = 500;
const memory = new Map<string, { url: string; bytes: number }>();
const pending = new Map<string, Promise<string>>();
let totalBytes = 0;
let activeReads = 0;
let diskWritePending = false;
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

async function boundedImage(response: Response, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!/^image\/(?:webp|png|jpeg|gif|avif)$/.test(type) || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES || !response.body)
    throw new Error('Artwork is not a bounded image.');
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Artwork exceeds the cache budget.');
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    const cancelled = reader.cancel().catch(() => {});
    // Optional storage may also stall cancellation, including after a bad
    // body. Its lookup deadline owns the read; do not retain chunks awaiting it.
    if (!signal) await cancelled;
  }
  return new Blob(chunks as BlobPart[], { type });
}

// Browser storage is optional. Its API calls can stall without rejecting;
// give the complete lookup/body a small budget before using ordinary delivery.
async function readDiskArtwork(key: string): Promise<{ disk: Cache; blob?: Blob } | undefined> {
  let storage: CacheStorage;
  try {
    if (typeof caches === 'undefined') return;
    storage = caches;
  } catch {
    return undefined;
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<undefined>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, DISK_READ_TIMEOUT_MS);
  });
  const read = (async () => {
    const disk = await storage.open(CACHE);
    controller.signal.throwIfAborted();
    const saved = await disk.match(key);
    controller.signal.throwIfAborted();
    return { disk, blob: saved ? await boundedImage(saved, controller.signal) : undefined };
  })();
  try {
    return await Promise.race([read, expired]);
  } catch {
    // Private mode, invalid entries and Host restrictions use network/memory.
    return undefined;
  } finally {
    clearTimeout(timer!);
  }
}

// One best-effort writer bounds retained blobs even if put/keys/delete never
// settles. A later cover may skip persistence; displaying it never waits here.
function persistArtwork(disk: Cache | undefined, key: string, blob: Blob) {
  if (!disk || blob.size > MAX_DISK_IMAGE_BYTES || diskWritePending) return;
  diskWritePending = true;
  void (async () => {
    try {
      await disk.put(key, new Response(blob, { headers: { 'content-type': blob.type } }));
      const keys = await disk.keys();
      for (const oldest of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await disk.delete(oldest);
    } catch {
      // Quota exhaustion leaves the useful in-memory cover available.
    } finally {
      diskWritePending = false;
    }
  })();
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
    const saved = await readDiskArtwork(key);
    if (saved?.blob) return remember(key, saved.blob);
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
      const url = remember(key, blob);
      persistArtwork(saved?.disk, key, blob);
      return url;
    } finally {
      clearTimeout(timeout);
      release();
    }
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
