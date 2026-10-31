import type { ManagedAudioSource } from './streamingMediaSource';

const SEGMENT_SECONDS = 4; // W32's fixed nominal AAC fragment interval.

/** One demand-driven producer for a managed source. A monotonic download cursor
 * cannot recover browser-evicted media or a backwards seek. Keep only segment
 * presence, never a clear-media cache, and invalidate on native removed ranges.
 * The caller authenticates every read and serializes every append.
 */
export async function pumpManagedAudio(input: {
  source: ManagedAudioSource;
  buffer: SourceBuffer;
  audio: HTMLAudioElement;
  segmentCount: number;
  duration: number;
  signal: AbortSignal;
  bufferAheadSeconds: () => number;
  initialize: (signal: AbortSignal) => Promise<void>;
  // Resolve after the authenticated append commits. Demand can cancel its read,
  // but an already-started buffer update must finish under the owner signal.
  appendSegment: (index: number, signal: AbortSignal) => Promise<void>;
  demandTimeoutMs?: number;
}) {
  const { source, buffer, audio, signal } = input;
  const present = new Set<number>();
  const evictions = new Map<number, number>();
  let initialized = false;
  let firstSegment = false;
  let wake: (() => void) | undefined;
  let revision = 0;
  let closed = false;
  let readController: AbortController | null = null;
  const notify = () => {
    revision++;
    wake?.();
  };
  const pauseRead = () => {
    readController?.abort();
    notify();
  };
  const sourceClosed = () => {
    closed = true;
    pauseRead();
  };
  const interval = (index: number) => [index * SEGMENT_SECONDS, Math.min(input.duration, (index + 1) * SEGMENT_SECONDS)];
  const invalidate = (start: number, end: number) => {
    for (let index = 0; index < input.segmentCount; index++) {
      const [from, to] = interval(index);
      // AAC frames may straddle nominal 4s boundaries. Invalidate both sides.
      if (start < to + 0.1 && end > from - 0.1) {
        present.delete(index);
        evictions.set(index, (evictions.get(index) ?? 0) + 1);
      }
    }
  };
  const changed = (event: Event) => {
    const removed = (event as Event & { removedRanges?: TimeRanges }).removedRanges;
    if (removed)
      for (let i = 0; i < removed.length; i++) {
        const start = removed.start(i),
          end = removed.end(i);
        // Frame replacement can report removed AND added ranges. Do not treat
        // data already replaced in the native buffer as another eviction.
        let replaced = false;
        for (let j = 0; j < buffer.buffered.length; j++) {
          if (buffer.buffered.start(j) <= start && buffer.buffered.end(j) >= end) replaced = true;
        }
        if (!replaced) invalidate(start, end);
      }
    notify();
  };
  const seeking = () => {
    // Also repair a missed/coalesced eviction event when seeking into a hole.
    const at = audio.currentTime;
    let covered = false;
    for (let i = 0; i < buffer.buffered.length; i++) if (buffer.buffered.start(i) <= at && buffer.buffered.end(i) > at) covered = true;
    if (!covered) invalidate(Math.max(0, at - SEGMENT_SECONDS), at + SEGMENT_SECONDS);
    pauseRead();
  };
  const listeners: Array<[EventTarget, string, EventListener]> = [
    [source, 'startstreaming', notify],
    [source, 'endstreaming', pauseRead],
    [source, 'sourceclose', sourceClosed],
    [buffer, 'bufferedchange', changed],
    [audio, 'seeking', seeking],
    [audio, 'timeupdate', notify],
    [audio, 'play', notify],
    [signal, 'abort', pauseRead]
  ];
  for (const [target, event, listener] of listeners) target.addEventListener(event, listener);
  const wait = (seen: number) =>
    new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timer);
        wake = undefined;
        resolve();
      };
      const timer = firstSegment ? undefined : setTimeout(done, Math.max(0, firstDemandDeadline - performance.now()));
      wake = done;
      if (signal.aborted || revision !== seen) done();
    });
  const firstDemandDeadline = performance.now() + (input.demandTimeoutMs ?? 20_000);
  // Bound refills if a broken/low-memory shell evicts the playhead repeatedly.
  const refills = new Map<number, { start: number; count: number }>();
  try {
    while (!signal.aborted) {
      const seen = revision;
      if (closed) throw new Error('The audio player disconnected. Please try again.');
      if (!firstSegment && performance.now() >= firstDemandDeadline) throw new Error('The audio player did not request data. Please try again.');
      const at = Math.max(0, Math.min(audio.currentTime || 0, input.duration));
      const first = Math.max(0, Math.min(input.segmentCount - 1, Math.floor(at / SEGMENT_SECONDS) - 1));
      const ahead = Math.max(4, Math.min(30, input.bufferAheadSeconds()));
      const last = Math.min(input.segmentCount - 1, Math.floor((at + ahead) / SEGMENT_SECONDS));
      let next = -1;
      for (let i = first; i <= last; i++)
        if (!present.has(i)) {
          next = i;
          break;
        }
      if (next < 0 || (!source.streaming && source.readyState !== 'ended')) {
        await wait(seen);
        continue;
      }
      readController = new AbortController();
      const requestSignal = AbortSignal.any([signal, readController.signal]);
      try {
        // Re-appending verified init reopens an ended source after eviction or a
        // backwards seek. No new network request while managed demand is off.
        if (!initialized || source.readyState === 'ended') {
          if (!source.streaming && !initialized) {
            await wait(seen);
            continue;
          }
          await input.initialize(requestSignal);
          initialized = true;
        }
        if (!source.streaming) {
          await wait(seen);
          continue;
        }
        const now = performance.now();
        const recent = refills.get(next);
        const count = recent && now - recent.start < 15_000 ? recent.count + 1 : 1;
        if (count > 4) throw new Error('The audio player could not retain its buffer. Please try again.');
        const eviction = evictions.get(next) ?? 0;
        await input.appendSegment(next, requestSignal);
        // A successful append has committed under the owner's signal. Native
        // endstreaming can cancel speculative reads before updateend without
        // undoing that append; forgetting it would append the same frames again
        // on demand resume. Owner cancellation and actual evictions still win.
        signal.throwIfAborted();
        refills.set(next, { start: count === 1 ? now : recent!.start, count });
        if ((evictions.get(next) ?? 0) === eviction) present.add(next);
        firstSegment = true;
        if (present.has(next) && next === input.segmentCount - 1 && source.readyState === 'open') source.endOfStream();
      } catch (error) {
        if (signal.aborted) throw error;
        // Demand stop/seek cancels speculative work; authentication/transport
        // errors are terminal and must not become a Blob or different-key retry.
        if (!readController.signal.aborted) throw error;
      } finally {
        readController = null;
      }
    }
    signal.throwIfAborted();
  } finally {
    readController?.abort();
    wake?.();
    for (const [target, event, listener] of listeners) target.removeEventListener(event, listener);
  }
}
