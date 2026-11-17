import { useLayoutEffect, useEffect, useRef, type RefObject } from 'react';
import type { CatalogTrack } from '../../shared/types';
import { playbackPrefetchAllowed } from './usePlaybackPrefetch';
import { hasPlaybackHeadroom } from './trackNavigation';

/** A separate lifetime from current playback: interruption cancels only speculation. */
export function useNextTrackPreparation(
  audioRef: RefObject<HTMLAudioElement | null>,
  enabled: boolean,
  generation: number,
  next: CatalogTrack | undefined,
  prepare?: (track: CatalogTrack, signal: AbortSignal) => Promise<void>
) {
  const latest = useRef({ next, prepare });
  useLayoutEffect(() => {
    latest.current = { next, prepare };
  }, [next, prepare]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!enabled || !audio || !latest.current.next) return;
    let controller: AbortController | null = null;
    const cancel = () => {
      controller?.abort();
      controller = null;
    };
    const check = () => {
      // Engines emit pause/timeupdate immediately before natural ended. Keep
      // the ready successor until handleEnded transfers its ownership.
      if (audio.ended) return;
      if (!playbackPrefetchAllowed() || !hasPlaybackHeadroom(audio)) {
        cancel();
        return;
      }
      const remaining = audio.duration - audio.currentTime;
      if (remaining > 15 || remaining <= 0 || controller) return;
      controller = new AbortController();
      const { next, prepare } = latest.current;
      if (next && prepare) void prepare(next, controller.signal).catch(() => {});
    };
    const events = ['playing', 'progress', 'timeupdate'];
    const interruptions = ['pause', 'waiting', 'seeking'];
    const interrupt = () => {
      if (!audio.ended) cancel();
    };
    for (const event of events) audio.addEventListener(event, check);
    for (const event of interruptions) audio.addEventListener(event, interrupt);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('offline', check);
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener('change', check);
    check();
    return () => {
      cancel();
      for (const event of events) audio.removeEventListener(event, check);
      for (const event of interruptions) audio.removeEventListener(event, interrupt);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('offline', check);
      connection?.removeEventListener('change', check);
    };
  }, [audioRef, enabled, generation, next?.id, next?.audioRef]);
}
