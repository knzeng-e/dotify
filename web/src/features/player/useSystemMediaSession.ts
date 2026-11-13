import { useLayoutEffect, useEffect, useRef } from 'react';
import type { PlaybackControls } from '../../hooks/usePlayback';
import { bindMediaSession } from './systemMediaSession';
import { preparedSystemArtwork, resolveSystemArtwork, systemArtworkCandidates, type SystemMediaTrack } from './systemArtwork';

export function useSystemMediaSession(playback: PlaybackControls, track: SystemMediaTrack | null, enabled: boolean) {
  const latest = useRef(playback);
  const active = useRef(enabled);
  useLayoutEffect(() => {
    latest.current = playback;
    active.current = enabled;
  }, [playback, enabled]);
  useLayoutEffect(() => {
    const session = navigator.mediaSession;
    if (!session || !enabled) return;
    return bindMediaSession(session, {
      play: () => {
        if (active.current) latest.current.setPlaying(true);
      },
      pause: () => {
        if (active.current) latest.current.setPlaying(false);
      },
      ...(playback.canSkip
        ? {
            next: () => {
              if (active.current) latest.current.skip('next');
            },
            previous: () => {
              if (active.current) latest.current.skip('previous');
            }
          }
        : {}),
      ...(playback.canSeek
        ? {
            seek: (time: number) => {
              const duration = latest.current.transport.duration;
              if (active.current && duration > 0) latest.current.seekToProgress((100 * time) / duration);
            }
          }
        : {})
    });
  }, [enabled, playback.canSkip, playback.canSeek]);
  const title = track?.title;
  const artist = track?.artist;
  const imageRef = track?.imageRef;
  const album = 'Dotify';
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    const controller = new AbortController();
    try {
      const currentTrack = enabled && title !== undefined ? { title, artist: artist ?? '', imageRef } : null;
      const prepared = currentTrack ? preparedSystemArtwork(currentTrack) : null;
      const metadata =
        currentTrack && typeof MediaMetadata !== 'undefined'
          ? new MediaMetadata({ title, artist, album, artwork: prepared ?? systemArtworkCandidates(imageRef) })
          : null;
      session.metadata = metadata;
      if (metadata && currentTrack && !prepared) {
        void resolveSystemArtwork(currentTrack, controller.signal)
          .then(artwork => {
            if (!controller.signal.aborted && active.current && session.metadata === metadata) {
              session.metadata = new MediaMetadata({ title, artist, album, artwork });
            }
          })
          .catch(() => {
            /* Artwork must never delay or interrupt audio. */
          });
      }
    } catch {
      session.metadata = null;
    }
    return () => {
      controller.abort();
      session.metadata = null;
    };
  }, [enabled, title, artist, imageRef]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    try {
      session.playbackState = !enabled ? 'none' : playback.transport.playing ? 'playing' : 'paused';
    } catch {
      /* A partial Host implementation must not interrupt audio. */
    }
    const { duration, currentTime } = playback.transport;
    try {
      session.setPositionState(
        enabled && playback.canSeek && duration > 0 && Number.isFinite(duration)
          ? { duration, position: Math.min(duration, Math.max(0, currentTime)), playbackRate: 1 }
          : {}
      );
    } catch {
      /* Unsupported position state must not affect transport. */
    }
  }, [enabled, playback.canSeek, playback.transport]);
}
