import { afterEach, expect, it, vi } from 'vitest';
import { readCompatibilityAudio } from './compatibilityAudio';
import type { StreamingObject } from './streamingFormat';

function objects(count: number): StreamingObject[] {
  return Array.from({ length: count }, (_, index) => ({
    rendition: '96',
    kind: index === 0 ? 'init' : 'media',
    index: Math.max(0, index - 1),
    counter: index,
    plainLength: 1,
    encryptedLength: 17,
    path: index === 0 ? '96/init.bin' : `96/segment-${String(index - 1).padStart(3, '0')}.bin`
  }));
}

afterEach(() => vi.useRealTimers());

it('prepares a 71-segment track within the existing startup budget with bounded concurrent reads', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new DOMException('Startup expired', 'AbortError')), 60_000);
  let active = 0;
  let peak = 0;
  let finishedAt = 0;
  const pending = readCompatibilityAudio(
    objects(72),
    async (object, signal) => {
      active += 1;
      peak = Math.max(peak, active);
      try {
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
          }, 1000);
          signal.addEventListener('abort', abort, { once: true });
        });
        return Uint8Array.of(object.counter);
      } finally {
        active -= 1;
      }
    },
    controller.signal
  )
    .then(parts => {
      finishedAt = Date.now();
      return { parts, error: null };
    })
    .catch((error: unknown) => ({ parts: [] as Uint8Array[], error }))
    .finally(() => clearTimeout(deadline));
  await vi.advanceTimersByTimeAsync(60_000);
  const result = await pending;
  expect(result.error).toBeNull();
  expect(result.parts.map(part => part[0])).toEqual(Array.from({ length: 72 }, (_, i) => i));
  expect(finishedAt).toBeLessThan(60_000);
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(4);
  expect(active).toBe(0);
});

it('keeps authenticated output ordered when reads finish out of order and reports verified byte progress', async () => {
  const chunks = objects(5);
  const resolutions: Array<(bytes: Uint8Array) => void> = [];
  const progress: number[] = [];
  const pending = readCompatibilityAudio(
    chunks,
    (_object, _signal) => new Promise(resolve => resolutions.push(resolve)),
    new AbortController().signal,
    value => progress.push(value.completedBytes)
  );
  await vi.waitFor(() => expect(resolutions).toHaveLength(4));
  resolutions[2](Uint8Array.of(2));
  resolutions[1](Uint8Array.of(1));
  expect(progress).toEqual([0]);
  resolutions[0](Uint8Array.of(0));
  await vi.waitFor(() => expect(resolutions).toHaveLength(5));
  resolutions[4](Uint8Array.of(4));
  resolutions[3](Uint8Array.of(3));
  expect((await pending).map(bytes => bytes[0])).toEqual([0, 1, 2, 3, 4]);
  expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
});

it('rejects an oversized authenticated declaration before fetching media', async () => {
  const chunks = objects(1);
  chunks[0].plainLength = 40 * 1024 * 1024 + 1;
  const read = vi.fn();
  await expect(readCompatibilityAudio(chunks, read, new AbortController().signal)).rejects.toThrow(/budget/);
  expect(read).not.toHaveBeenCalled();
});

it('cancels all in-flight reads when the parent is interrupted and starts no later objects', async () => {
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  const pending = readCompatibilityAudio(
    objects(12),
    (_object, signal) => {
      signals.push(signal);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
    controller.signal
  );
  const result = pending.catch((error: unknown) => error);
  await vi.waitFor(() => expect(signals).toHaveLength(4));
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(signals).toHaveLength(4);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

it('propagates an authentication rejection and aborts the other bounded reads', async () => {
  const denied = new Error('Segment authentication failed');
  const signals: AbortSignal[] = [];
  const pending = readCompatibilityAudio(
    objects(12),
    (object, signal) => {
      signals.push(signal);
      if (object.counter === 0) return Promise.reject(denied);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
    new AbortController().signal
  );
  await expect(pending).rejects.toBe(denied);
  expect(signals).toHaveLength(4);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});
