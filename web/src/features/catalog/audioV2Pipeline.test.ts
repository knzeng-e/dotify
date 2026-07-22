import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_V2_READ_AHEAD_CHUNKS, pumpAudioV2ReadAhead } from './audioV2Pipeline';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function chunks(count: number) {
  return Array.from({ length: count }, (_, index) => ({ index }));
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('DAV2 read-ahead pipeline', () => {
  it('prepares the current chunk plus two future chunks and appends in order', async () => {
    const preparations = chunks(4).map(() => deferred<string>());
    const firstAppend = deferred<void>();
    const firstAppendStarted = deferred<void>();
    const fourthPreparationStarted = deferred<void>();
    const prepareOrder: number[] = [];
    const appendOrder: number[] = [];

    const pipeline = pumpAudioV2ReadAhead({
      chunks: chunks(4),
      prepareChunk: async chunk => {
        prepareOrder.push(chunk.index);
        if (chunk.index === 3) fourthPreparationStarted.resolve();
        return preparations[chunk.index].promise;
      },
      appendChunk: async (chunk, prepared) => {
        appendOrder.push(chunk.index);
        expect(prepared).toBe(`clear-${chunk.index}`);
        if (chunk.index === 0) {
          firstAppendStarted.resolve();
          await firstAppend.promise;
        }
      }
    });

    await flushPromises();
    expect(prepareOrder).toEqual([0, 1, 2]);

    preparations[2].resolve('clear-2');
    preparations[1].resolve('clear-1');
    preparations[0].resolve('clear-0');
    await firstAppendStarted.promise;

    expect(appendOrder).toEqual([0]);
    expect(prepareOrder).toEqual([0, 1, 2]);

    firstAppend.resolve();
    await fourthPreparationStarted.promise;
    expect(prepareOrder).toEqual([0, 1, 2, 3]);

    preparations[3].resolve('clear-3');
    await pipeline;
    expect(appendOrder).toEqual([0, 1, 2, 3]);
    expect(DEFAULT_AUDIO_V2_READ_AHEAD_CHUNKS).toBe(2);
  });

  it('aborts pending preparation and stops appending when the parent is cancelled', async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const appendChunk = vi.fn();

    const pipeline = pumpAudioV2ReadAhead({
      chunks: chunks(4),
      signal: controller.signal,
      prepareChunk: async (chunk, signal) => {
        started.push(chunk.index);
        return new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
        });
      },
      appendChunk
    });

    await flushPromises();
    expect(started).toEqual([0, 1, 2]);
    controller.abort();

    await expect(pipeline).rejects.toMatchObject({ name: 'AbortError' });
    expect(appendChunk).not.toHaveBeenCalled();
  });

  it('propagates an authentication failure and cancels future work', async () => {
    class AuthenticationError extends Error {}
    const authenticationError = new AuthenticationError('chunk authentication failed');
    const observedSignals: AbortSignal[] = [];
    const appendChunk = vi.fn();

    const pipeline = pumpAudioV2ReadAhead({
      chunks: chunks(3),
      prepareChunk: async (chunk, signal) => {
        observedSignals.push(signal);
        if (chunk.index === 0) throw authenticationError;
        return new Promise<string>(() => undefined);
      },
      appendChunk
    });

    await expect(pipeline).rejects.toBe(authenticationError);
    expect(appendChunk).not.toHaveBeenCalled();
    expect(observedSignals).toHaveLength(3);
    expect(observedSignals.every(signal => signal.aborted)).toBe(true);
  });

  it('rejects non-monotonic chunks before starting work', async () => {
    const prepareChunk = vi.fn();

    await expect(
      pumpAudioV2ReadAhead({
        chunks: [{ index: 0 }, { index: 2 }],
        prepareChunk,
        appendChunk: vi.fn()
      })
    ).rejects.toThrow(/monotonic/);
    expect(prepareChunk).not.toHaveBeenCalled();
  });
});
