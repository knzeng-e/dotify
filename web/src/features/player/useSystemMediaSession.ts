import { systemRoomAlbum, type SystemRoomContext } from './systemRoomContext';
import { useLayoutEffect, useEffect, useMemo, useRef } from 'react';
import type { PlaybackControls } from '../../hooks/usePlayback';
import { bindMediaSession } from './systemMediaSession';
import { resolveSystemArtwork, systemArtworkCandidates, type SystemMediaTrack } from './systemArtwork';

export function useSystemMediaSession(playback: PlaybackControls, track: SystemMediaTrack | null, enabled: boolean, room: SystemRoomContext | null = null) {
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
  const label = room?.label,
    presence = room?.presence,
    attribution = room?.attribution;
  const context = useMemo(
    () => (label !== undefined ? { label, presence: presence ?? '', attribution: attribution ?? '' } : null),
    [label, presence, attribution]
  );
  const album = systemRoomAlbum(context);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    const controller = new AbortController();
    try {
      const metadata =
        enabled && title !== undefined && typeof MediaMetadata !== 'undefined'
          ? new MediaMetadata({ title, artist, album, artwork: systemArtworkCandidates(imageRef) })
          : null;
      session.metadata = metadata;
      if (metadata) {
        void resolveSystemArtwork({ title: title!, artist: artist ?? '', imageRef }, controller.signal, context)
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
  }, [enabled, title, artist, imageRef, album, context]);
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
