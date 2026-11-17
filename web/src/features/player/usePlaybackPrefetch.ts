import { useEffect, useRef, type RefObject } from 'react';
import { startStreamingNeighborPrefetch } from '../catalog/streamingPrefetch';
import { allowNeighborPrefetch, hasPlaybackHeadroom } from './trackNavigation';

type PlaybackConnection = EventTarget & { saveData?: boolean; effectiveType?: string };

export function playbackPrefetchAllowed(): boolean {
  const connection = (navigator as Navigator & { connection?: PlaybackConnection }).connection;
  return allowNeighborPrefetch(navigator.onLine, document.visibilityState === 'visible', connection);
}

/** Wait for buffered, advancing audio; cancel speculative traffic on stall,
 * pause, backgrounding, data-saving mode, or a changed selection. */
export function usePlaybackPrefetch(
  audioRef: RefObject<HTMLAudioElement | null>,
  enabled: boolean,
  generation: number,
  nextAudioRef: string | undefined,
  previousAudioRef: string | undefined,
  prepareKeys?: (signal: AbortSignal) => Promise<void>
): void {
  const prepareRef = useRef(prepareKeys);
  useEffect(() => {
    prepareRef.current = prepareKeys;
  }, [prepareKeys]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled) return;
    const refs = [nextAudioRef, previousAudioRef].filter((ref): ref is string => Boolean(ref));
    if (!refs.length) return;
    let keyController = new AbortController();
    let lastPreparation = -Infinity;
    let preparing = false;
    const prepare = () => {
      if (preparing || Date.now() - lastPreparation < 20_000) return;
      preparing = true;
      lastPreparation = Date.now();
      const current = keyController;
      void prepareRef
        .current?.(current.signal)
        .catch(() => {})
        .finally(() => {
          if (keyController === current) preparing = false;
        });
      if (!prepareRef.current) preparing = false;
    };
    let stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      keyController.abort();
      keyController = new AbortController();
      preparing = false;
      lastPreparation = -Infinity;
      clearTimeout(timer);
      timer = undefined;
      stop?.();
      stop = undefined;
    };
    const check = () => {
      if (!playbackPrefetchAllowed() || !hasPlaybackHeadroom(audio)) {
        cancel();
        return;
      }
      if (stop) {
        prepare();
        return;
      }
      if (timer !== undefined) return;
      // Let the current selection and its first media frame finish first.
      timer = setTimeout(() => {
        timer = undefined;
        if (playbackPrefetchAllowed() && hasPlaybackHeadroom(audio)) {
          stop = startStreamingNeighborPrefetch(refs);
          prepare();
        }
      }, 500);
    };
    const connection = (navigator as Navigator & { connection?: PlaybackConnection }).connection;
    const events = ['playing', 'progress', 'canplay', 'timeupdate'] as const;
    const interruptions = ['pause', 'waiting', 'seeking', 'ended'] as const;
    for (const event of events) audio.addEventListener(event, check);
    for (const event of interruptions) audio.addEventListener(event, cancel);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    connection?.addEventListener('change', check);
    check();
    return () => {
      cancel();
      for (const event of events) audio.removeEventListener(event, check);
      for (const event of interruptions) audio.removeEventListener(event, cancel);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
      connection?.removeEventListener('change', check);
    };
  }, [audioRef, enabled, generation, nextAudioRef, previousAudioRef]);
}
