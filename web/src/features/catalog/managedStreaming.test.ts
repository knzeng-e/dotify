import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pumpManagedAudio } from './managedStreaming';
import type { ManagedAudioSource } from './streamingMediaSource';

function ranges(items: Array<[number, number]>): TimeRanges {
  return { length: items.length, start: i => items[i][0], end: i => items[i][1] };
}
function harness(count = 20) {
  const source = Object.assign(new EventTarget(), {
    streaming: false,
    readyState: 'open',
    endOfStream: vi.fn(() => {
      source.readyState = 'ended';
    })
  });
  const buffer = Object.assign(new EventTarget(), { buffered: ranges([]) });
  const audio = Object.assign(new EventTarget(), { currentTime: 0 });
  const controller = new AbortController();
  const initialize = vi.fn(async () => {
    source.readyState = 'open';
  });
  const readSegment = vi.fn(async (index: number, signal: AbortSignal) => {
    signal.throwIfAborted();
    return Uint8Array.of(index);
  });
  const appendSegment = vi.fn(async (_index: number, _bytes: Uint8Array) => {});
  const run = () =>
    pumpManagedAudio({
      source: source as unknown as ManagedAudioSource,
      buffer: buffer as unknown as SourceBuffer,
      audio: audio as unknown as HTMLAudioElement,
      segmentCount: count,
      duration: count * 4,
      signal: controller.signal,
      bufferAheadSeconds: () => 8,
      initialize,
      readSegment,
      appendSegment,
      demandTimeoutMs: 1000
    });
  const demand = (value: boolean) => {
    source.streaming = value;
    source.dispatchEvent(new Event(value ? 'startstreaming' : 'endstreaming'));
  };
  const remove = (from: number, to: number) => buffer.dispatchEvent(Object.assign(new Event('bufferedchange'), { removedRanges: ranges([[from, to]]) }));
  return { source, buffer, audio, controller, initialize, readSegment, appendSegment, run, demand, remove };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const tick = () => vi.advanceTimersByTimeAsync(1);

it('waits for managed demand, fills a bounded window, then pauses network work', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  await tick();
  expect(h.initialize).not.toHaveBeenCalled();
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1, 2]);
  h.demand(false);
  h.audio.currentTime = 40;
  h.audio.dispatchEvent(new Event('seeking'));
  await tick();
  expect(h.appendSegment).toHaveBeenCalledTimes(3);
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.slice(3).map(c => c[0])).toEqual([9, 10, 11, 12]);
  h.controller.abort();
  expect((await result).name).toBe('AbortError');
});
it('refills an evicted segment after demand resumes without fetching the rest of the file', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  h.demand(false);
  h.remove(0.5, 1.5);
  await tick();
  expect(h.appendSegment).toHaveBeenCalledTimes(3);
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1, 2, 0]);
  h.controller.abort();
  await result;
});
it('reopens an ended source to refill eviction and supports backwards seeks', async () => {
  const h = harness(3);
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(h.source.readyState).toBe('ended');
  h.demand(false);
  h.remove(0, 4);
  await tick();
  expect(h.source.readyState).toBe('open');
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1, 2, 0, 1]);
  h.controller.abort();
  await result;
});
it('cancels in-flight network work on demand stop and on owner cancellation', async () => {
  const h = harness();
  let request: AbortSignal | undefined;
  h.readSegment.mockImplementation(
    async (_index, signal) =>
      new Promise<Uint8Array>((_, reject) => {
        request = signal;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
  );
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  h.demand(false);
  expect(request?.aborted).toBe(true);
  await tick();
  h.demand(true);
  await tick();
  expect(request?.aborted).toBe(false);
  h.controller.abort();
  await result;
  expect(request?.aborted).toBe(true);
});
it('keeps a completed append when managed demand stops during the buffer update', async () => {
  const h = harness();
  h.appendSegment.mockImplementation(async index => {
    if (index === 0) {
      // Native endstreaming may precede updateend. The adapter finishes this
      // append under the owner signal even though speculative reads stop.
      h.buffer.buffered = ranges([[0, 4]]);
      h.demand(false);
    }
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0]);
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1, 2]);
  h.controller.abort();
  await result;
});
it('retries an evicted append even when demand stopped before its completion', async () => {
  const h = harness();
  let first = true;
  h.appendSegment.mockImplementation(async index => {
    if (index === 0 && first) {
      first = false;
      h.demand(false);
      h.remove(0.5, 1);
    }
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 0, 1, 2]);
  h.controller.abort();
  await result;
});
it('still stops before finalizing if the owner cancels during a completed append', async () => {
  const h = harness(1);
  h.appendSegment.mockImplementation(async () => {
    h.controller.abort();
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect((await result).name).toBe('AbortError');
  expect(h.source.endOfStream).not.toHaveBeenCalled();
  expect(h.appendSegment).toHaveBeenCalledTimes(1);
});
it('reports unavailable demand instead of preparing forever and detaches its listeners', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  await vi.advanceTimersByTimeAsync(1100);
  expect((await result).message).toContain('did not request data');
  h.demand(true);
  await tick();
  expect(h.initialize).not.toHaveBeenCalled();
});
it('does not retry authentication failures', async () => {
  const h = harness();
  const failure = new Error('Invalid authentication');
  h.appendSegment.mockRejectedValue(failure);
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(await result).toBe(failure);
  expect(h.appendSegment).toHaveBeenCalledTimes(1);
});
it('bounds a repeated eviction loop instead of refetching indefinitely', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  for (let i = 0; i < 5; i++) {
    h.remove(0.5, 1);
    await tick();
  }
  expect((await result).message).toContain('retain its buffer');
});
it('reports an unexpectedly closed source even after first audio', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  h.source.readyState = 'closed';
  h.source.dispatchEvent(new Event('sourceclose'));
  await tick();
  expect((await result).message).toContain('disconnected');
});
it('does not confuse replaced frames with evicted data or poll while idle', async () => {
  const h = harness();
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  h.buffer.buffered = ranges([[0, 12]]);
  h.remove(0, 4);
  await tick();
  expect(h.appendSegment).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
  h.controller.abort();
  await result;
});
it('does not mark a segment present if it was evicted while its append completed', async () => {
  const h = harness();
  let evicted = false;
  h.appendSegment.mockImplementation(async index => {
    if (index === 0 && !evicted) {
      evicted = true;
      h.remove(0.5, 1);
    }
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 0, 1, 2]);
  h.controller.abort();
  await result;
});

it('overlaps slow segment reads while committing in order and holding at most two', async () => {
  const h = harness();
  let active = 0,
    peak = 0;
  h.readSegment.mockImplementation(async (index, signal) => {
    active++;
    peak = Math.max(peak, active);
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(
          () => {
            signal.removeEventListener('abort', abort);
            resolve();
          },
          index === 0 ? 6000 : 5000
        );
        signal.addEventListener('abort', abort, { once: true });
      });
      return Uint8Array.of(index);
    } finally {
      active--;
    }
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.appendSegment).not.toHaveBeenCalled(); // segment 1 cannot overtake 0
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1]);
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([0, 1, 2]);
  expect(peak).toBe(2);
  expect(active).toBe(0);
  h.controller.abort();
  await result;
});

it('cancels both prefetched reads on seek and only appends the new playhead window', async () => {
  const h = harness();
  const requests: Array<{ index: number; signal: AbortSignal; resolve: (value: Uint8Array) => void }> = [];
  h.readSegment.mockImplementation(
    (index, signal) =>
      new Promise((resolve, reject) => {
        requests.push({ index, signal, resolve });
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
  );
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(requests.map(r => r.index)).toEqual([0, 1]);
  h.audio.currentTime = 40;
  h.audio.dispatchEvent(new Event('seeking'));
  await tick();
  expect(requests.slice(0, 2).every(r => r.signal.aborted)).toBe(true);
  expect(requests.slice(2).map(r => r.index)).toEqual([9, 10]);
  requests[2].resolve(Uint8Array.of(9));
  await tick();
  expect(h.appendSegment.mock.calls.map(c => c[0])).toEqual([9]);
  h.controller.abort();
  await result;
  expect(requests.every(r => r.signal.aborted)).toBe(true);
});

it('does not fetch again after a prefetched authentication failure and aborts its sibling', async () => {
  const h = harness();
  const failure = new Error('Invalid authentication');
  const signals: AbortSignal[] = [];
  h.readSegment.mockImplementation(async (index, signal) => {
    signals.push(signal);
    if (index === 0) throw failure;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const result = h.run().catch(error => error);
  h.demand(true);
  await tick();
  expect(await result).toBe(failure);
  expect(h.appendSegment).not.toHaveBeenCalled();
  expect(signals).toHaveLength(2);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  h.demand(true);
  await tick();
  expect(h.readSegment).toHaveBeenCalledTimes(2);
});
