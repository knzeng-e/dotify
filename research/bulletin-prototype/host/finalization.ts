import { pumpManagedAudio } from '../../../web/src/features/catalog/managedStreaming';

// The real encoder fixes AAC at 48 kHz. TimeRanges may round by a microsecond.
const TAIL_ROUNDING_SECONDS = 1 / 48_000;

export type FinalizationPolicy = 'after-final-append' | 'near-playback-end';
export type FinalizationEvent = {
  name: string;
  mediaSeconds: number;
  sourceState: string;
  managedStreaming: boolean;
  durationSeconds?: number;
  bufferedRanges: number[][];
  segmentIndex?: number;
};

export function finalizationPolicy(value = 'after-final-append'): FinalizationPolicy {
  if (value !== 'after-final-append' && value !== 'near-playback-end') throw new Error('Unknown stream finish experiment');
  return value;
}

/** Generated-only lab wrapper. No globals, native prototypes, bytes, key access or
 * production defaults change. Both variants run the same managed producer.
 * A deferred finish never blocks that producer's seek/eviction recovery.
 */
export function finalizationProducer(
  policy: FinalizationPolicy,
  observe: (event: FinalizationEvent) => void,
  onError: (error: unknown) => void
): typeof pumpManagedAudio {
  finalizationPolicy(policy);
  return async input => {
    const { source, buffer, audio, signal } = input;
    let pending = false;
    const ranges = () => Array.from({ length: Math.min(buffer.buffered.length, 8) }, (_, i) => [buffer.buffered.start(i), buffer.buffered.end(i)]);
    const emit = (name: string, segmentIndex?: number) => {
      if (signal.aborted) return;
      try {
        observe({
          name,
          mediaSeconds: audio.currentTime,
          sourceState: source.readyState,
          managedStreaming: source.streaming,
          durationSeconds: Number.isFinite(source.duration) ? source.duration : undefined,
          bufferedRanges: ranges(),
          ...(segmentIndex === undefined ? {} : { segmentIndex })
        });
      } catch {
        // Evidence observers cannot change playback or mask a transport error.
      }
    };
    const end = (error?: EndOfStreamError) => {
      pending = false;
      emit('end-of-stream-called');
      source.endOfStream(error);
    };
    const tryFinish = () => {
      if (!pending || signal.aborted || source.readyState !== 'open' || buffer.updating || audio.currentTime < input.duration - 1) return;
      // Seeking/managed eviction may leave a hole even after the final append.
      // Finish only when the playhead and full remaining tail are buffered.
      for (let i = 0; i < buffer.buffered.length; i++) {
        if (buffer.buffered.start(i) <= audio.currentTime && buffer.buffered.end(i) + TAIL_ROUNDING_SECONDS >= input.duration) {
          end();
          return;
        }
      }
    };
    const finish = (error?: EndOfStreamError) => {
      emit('end-of-stream-requested');
      if (error || policy === 'after-final-append') end(error);
      else {
        pending = true;
        tryFinish();
      }
    };
    // Bind native accessors/methods to their real receiver. The proxy exists
    // solely for this producer; the audio element keeps the original source.
    const observedSource = new Proxy(source, {
      get(target, property) {
        if (property === 'endOfStream') return finish;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    const listeners: Array<[EventTarget, string, EventListener]> = [];
    const listen = (target: EventTarget, name: string, callback: EventListener) => {
      listeners.push([target, name, callback]);
      target.addEventListener(name, callback);
    };
    for (const name of ['sourceopen', 'sourceended', 'sourceclose', 'startstreaming', 'endstreaming']) listen(source, name, () => emit(name));
    for (const name of ['bufferedchange', 'updateend']) listen(buffer, name, () => emit(`buffer-${name}`));
    const check = () => {
      try {
        tryFinish();
      } catch (error) {
        pending = false;
        onError(error);
      }
    };
    listen(audio, 'timeupdate', check);
    listen(buffer, 'updateend', check);
    emit('managed-observer-attached');
    try {
      await pumpManagedAudio({
        ...input,
        source: observedSource,
        appendSegment: async (index, requestSignal) => {
          emit('segment-append-start', index);
          await input.appendSegment(index, requestSignal);
          emit('segment-append-complete', index);
        }
      });
    } finally {
      pending = false;
      for (const [target, name, listener] of listeners) target.removeEventListener(name, listener);
    }
  };
}
