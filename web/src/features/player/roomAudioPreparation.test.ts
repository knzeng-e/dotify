import { afterEach, expect, it, vi } from 'vitest';
import { RoomAudioPreparation } from './roomAudioPreparation';
const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => vi.useRealTimers());
it('cancels a pending decoder on any owner loss and rejects an uncooperative late result', async () => {
  for (let owner = 0; owner < 3; owner++) {
    const preparation = new RoomAudioPreparation();
    const signals = Array.from({ length: 3 }, () => new AbortController());
    const late = deferred();
    let decoderSignal!: AbortSignal;
    const result = preparation.run({
      signals: signals.map(item => item.signal),
      isCurrent: () => true,
      timeoutMs: 60_000,
      prepare: signal => {
        decoderSignal = signal;
        return late.promise;
      }
    });
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    signals[owner].abort();
    await rejection;
    expect(decoderSignal.aborted).toBe(true);
    late.resolve('obsolete');
    await Promise.resolve();
  }
});
it('bounds media after authorization, without consuming the wallet wait budget', async () => {
  vi.useFakeTimers();
  const preparation = new RoomAudioPreparation();
  let authorized!: () => void;
  const late = deferred();
  const result = preparation.run({
    signals: [],
    isCurrent: () => true,
    timeoutMs: 60_000,
    prepare: (_, arm) => {
      authorized = arm;
      return late.promise;
    }
  });
  await vi.advanceTimersByTimeAsync(90_000);
  authorized();
  const rejection = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(60_000);
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
});
it('replacement cancels only the old candidate; its cleanup cannot cancel the new one', async () => {
  const preparation = new RoomAudioPreparation();
  const old = deferred(),
    next = deferred();
  const start = (promise: Promise<string>) => preparation.run({ signals: [], isCurrent: () => true, timeoutMs: 60_000, prepare: () => promise });
  const first = start(old.promise);
  const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = start(next.promise);
  await rejection;
  next.resolve('current');
  expect(await second).toBe('current');
  old.resolve('obsolete');
});
it('refuses a changed listening identity even when the transport resolves', async () => {
  let current = true;
  const late = deferred();
  const result = new RoomAudioPreparation().run({ signals: [], isCurrent: () => current, timeoutMs: 60_000, prepare: () => late.promise });
  current = false;
  late.resolve('obsolete');
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
});
