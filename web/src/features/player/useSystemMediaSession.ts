import { useLayoutEffect, useEffect, useRef } from 'react';
import type { TrackInfo } from '../../shared/types';
import type { PlaybackControls } from '../../hooks/usePlayback';
import { getGatewayUrl } from '../../services/pinata';
import { bindMediaSession } from './systemMediaSession';

export function useSystemMediaSession(playback: PlaybackControls, track: TrackInfo | null, enabled: boolean) {
  const latest = useRef(playback);
  useLayoutEffect(() => {
    latest.current = playback;
  }, [playback]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session || !enabled) return;
    return bindMediaSession(session, {
      play: () => latest.current.setPlaying(true),
      pause: () => latest.current.setPlaying(false),
      ...(playback.canSkip ? { next: () => latest.current.skip('next'), previous: () => latest.current.skip('previous') } : {}),
      ...(playback.canSeek
        ? {
            seek: (time: number) => {
              const duration = latest.current.transport.duration;
              if (duration > 0) latest.current.seekToProgress((100 * time) / duration);
            }
          }
        : {}),
      position: () => latest.current.transport.currentTime
    });
  }, [enabled, playback.canSkip, playback.canSeek]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    try {
      session.metadata =
        enabled && track && typeof MediaMetadata !== 'undefined'
          ? new MediaMetadata({ title: track.title, artist: track.artist, artwork: track.imageRef ? [{ src: getGatewayUrl(track.imageRef) }] : [] })
          : null;
    } catch {
      session.metadata = null;
    }
    return () => {
      session.metadata = null;
    };
  }, [enabled, track]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    session.playbackState = !enabled ? 'none' : playback.transport.playing ? 'playing' : 'paused';
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
