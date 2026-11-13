// Coordinate work, not promises or receipts. Each caller retains its own signal
// and verification; only one cold loader per canonical hash may run at a time.
import assert from 'node:assert/strict';

export const BULLETIN_PROOF_LOADS = 2;
export const BULLETIN_PROOF_WAITERS = 64;

export function createBulletinProofLoads() {
  const active = new Set<string>();
  const waiting: { key: string; signal: AbortSignal; enter(): void; reject(error: unknown): void; abort(): void }[] = [];
  const drain = () => {
    while (active.size < BULLETIN_PROOF_LOADS) {
      // A peer waiting for hash A must not hold up an unrelated hash B.
      const index = waiting.findIndex(entry => !active.has(entry.key));
      if (index === -1) break;
      const entry = waiting.splice(index, 1)[0];
      entry.signal.removeEventListener('abort', entry.abort);
      active.add(entry.key);
      entry.enter();
    }
  };
  return {
    async run<T>(key: string, signal: AbortSignal, read: () => Promise<T>): Promise<T> {
      signal.throwIfAborted();
      assert.match(key, /^0x[0-9a-f]{64}$/);
      if (active.size < BULLETIN_PROOF_LOADS && !active.has(key)) active.add(key);
      else
        await new Promise<void>((enter, reject) => {
          assert.ok(waiting.length < BULLETIN_PROOF_WAITERS, 'Bulletin proof queue limit reached');
          const entry = {
            key,
            signal,
            enter,
            reject,
            abort: () => {
              const index = waiting.indexOf(entry);
              if (index !== -1) {
                waiting.splice(index, 1);
                signal.removeEventListener('abort', entry.abort);
                reject(signal.reason);
              }
            }
          };
          waiting.push(entry);
          signal.addEventListener('abort', entry.abort, { once: true });
          if (signal.aborted) entry.abort();
        });
      try {
        signal.throwIfAborted();
        return await read();
      } finally {
        active.delete(key);
        drain();
      }
    }
  };
}
