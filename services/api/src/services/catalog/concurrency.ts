/** Stop admitting work on failure, but drain started work before releasing an
 * elected writer. A rejected Promise.all must not leave background RPC work. */
export async function mapConcurrent<T, U>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<U>): Promise<U[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid catalog concurrency');
  const results: U[] = new Array(items.length);
  let cursor = 0;
  let failure: unknown;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!failed && cursor < items.length) {
        const index = cursor++;
        try {
          results[index] = await work(items[index]!, index);
        } catch (error) {
          failed = true;
          failure = error;
        }
      }
    })
  );
  if (failed) throw failure;
  return results;
}

/** One budget for every RPC, including nested track/split enumeration. */
export function concurrencyGate(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid catalog concurrency');
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
