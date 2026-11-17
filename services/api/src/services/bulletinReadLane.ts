import assert from 'node:assert/strict';

/** Bounded FIFO. Queued cancellation consumes no slot and performs no RPC. */
export function createBulletinReadLane(concurrency: number) {
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 16, 'Invalid read concurrency');
  let active = 0;
  let closed: Error | undefined;
  const waiting: { enter(): void; reject(error: unknown): void; signal: AbortSignal; abort(): void }[] = [];
  const drain = () => {
    while (!closed && active < concurrency && waiting.length) {
      const next = waiting.shift()!;
      next.signal.removeEventListener('abort', next.abort);
      active++;
      next.enter();
    }
  };
  return {
    async run<T>(signal: AbortSignal, read: () => Promise<T>): Promise<T> {
      signal.throwIfAborted();
      if (closed) throw closed;
      if (active < concurrency) active++;
      else
        await new Promise<void>((enter, reject) => {
          assert.ok(waiting.length < 64, 'Bulletin read queue limit reached');
          const entry = {
            enter,
            reject,
            signal,
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
        if (closed) throw closed;
        return await read();
      } finally {
        active--;
        drain();
      }
    },
    close(error = new Error('Bulletin read lane closed')) {
      closed ??= error;
      for (const entry of waiting.splice(0)) {
        entry.signal.removeEventListener('abort', entry.abort);
        entry.reject(closed);
      }
    }
  };
}
