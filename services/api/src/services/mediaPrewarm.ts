import { encryptedMediaCid } from './encryptedMedia.js';
import type { CatalogSnapshot } from './catalog/types.js';

/** Ciphertext-only warming after durable confirmed catalog sync. Max 8 jobs /
 * minute, 2 concurrent jobs, 7 fixed objects/job and 3 attempts/CID/process.
 * No key, wallet/session, upload capability or listener data enters this path.
 */
export function createMediaPrewarmer(edge: string, fetchImpl: typeof fetch = fetch, now = Date.now) {
  const seen = new Map<string, { attempts: number; retryAt: number }>();
  const queue: string[] = [];
  let active = 0,
    tokens = 8,
    windowStart = now();
  const shutdown = new AbortController();
  async function warm(cid: string) {
    for (const object of ['manifest.json', ...[96, 160, 320].flatMap(rate => [`${rate}/init.bin`, `${rate}/segment-000.bin`])]) {
      shutdown.signal.throwIfAborted();
      const signal = AbortSignal.any([shutdown.signal, AbortSignal.timeout(5000)]);
      const response = await fetchImpl(`${edge.replace(/\/$/, '')}/ipfs/${cid}/${object}`, { signal, redirect: 'error', credentials: 'omit' });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing warming response');
      let size = 0;
      try {
        if (response.status !== 200) throw new Error('Warming transport unavailable');
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > (object === 'manifest.json' ? 256 * 1024 : 1024 * 1024 + 16)) throw new Error('Warming object too large');
        }
        if (!size) throw new Error('Empty warming response');
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    }
  }
  function pump() {
    while (!shutdown.signal.aborted && active < 2 && queue.length) {
      const cid = queue.shift()!;
      active++;
      void warm(cid)
        .catch(() => {
          const entry = seen.get(cid);
          if (entry) entry.retryAt = now() + 20_000;
        })
        .finally(() => {
          active--;
          pump();
        });
    }
  }
  return {
    observe(snapshot: CatalogSnapshot) {
      if (shutdown.signal.aborted) return;
      if (now() - windowStart >= 60_000) {
        tokens = 8;
        windowStart = now();
      }
      const current = new Set(
        snapshot.releases
          .filter(release => release.active && release.encrypted)
          .map(release => encryptedMediaCid(release.audioRef))
          .filter((cid): cid is string => cid !== null)
          .slice(0, 2000)
      );
      for (const cid of seen.keys()) if (!current.has(cid)) seen.delete(cid);
      for (const cid of current) {
        const entry = seen.get(cid);
        if (tokens > 0 && queue.length < 8 && (!entry || (entry.attempts < 3 && entry.retryAt <= now()))) {
          tokens--;
          seen.set(cid, { attempts: (entry?.attempts ?? 0) + 1, retryAt: Infinity });
          queue.push(cid);
        }
      }
      pump();
    },
    close() {
      shutdown.abort();
      queue.length = 0;
      seen.clear();
    }
  };
}
