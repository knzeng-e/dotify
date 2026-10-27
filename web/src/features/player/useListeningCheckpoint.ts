import { useCallback, useLayoutEffect, useEffect, useRef, useState } from 'react';
import type { CatalogTrack } from '../../shared/types';
import type { PlaybackControls } from '../../hooks/usePlayback';
import { LISTENING_CHECKPOINT_KEY, parseListeningCheckpoint } from './listeningCheckpoint';

export function useListeningCheckpoint(playback: PlaybackControls, track: CatalogTrack | undefined, enabled: boolean, identity: string) {
  const [offer, setOffer] = useState(() => {
    try {
      return parseListeningCheckpoint(localStorage.getItem(LISTENING_CHECKPOINT_KEY));
    } catch {
      return null;
    }
  });

  const clear = useCallback(() => {
    setOffer(null);
    try {
      localStorage.removeItem(LISTENING_CHECKPOINT_KEY);
    } catch {
      /* Private/blocked storage remains optional. */
    }
  }, []);
  useEffect(() => {
    try {
      const value = parseListeningCheckpoint(localStorage.getItem(LISTENING_CHECKPOINT_KEY));
      setOffer(value?.scope === identity ? value : null);
    } catch {
      setOffer(null);
    }
  }, [identity]);
  const latest = useRef({ playback, track, enabled, identity });
  useLayoutEffect(() => {
    latest.current = { playback, track, enabled, identity };
  }, [playback, track, enabled, identity]);
  useEffect(() => {
    const save = () => {
      const { playback, track, enabled, identity } = latest.current;
      if (!enabled || !track || track.id === 'draft-upload' || playback.transport.currentTime <= 0 || playback.transport.currentTime > 900) return;
      const value = {
        version: 1,
        savedAt: Date.now(),
        scope: identity,
        trackId: track.id,
        hash: track.hash,
        position: playback.transport.currentTime,
        queue: (playback.lineup.length ? playback.lineup.map(item => item.trackId) : [playback.nextTrackId]).filter(Boolean).slice(0, 24)
      };
      try {
        localStorage.setItem(LISTENING_CHECKPOINT_KEY, JSON.stringify(value));
      } catch {
        /* Quota/storage denial cannot interrupt audio. */
      }
    };
    const timer = setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
    };
  }, []);
  useEffect(() => {
    if (track?.id) setOffer(null);
  }, [track?.id]);
  return { offer: offer?.scope === identity ? offer : null, clear };
}
