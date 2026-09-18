// ── Persistent playback layer ───────────────────────────────────────────────
// Single owner of the media elements and transport state for the whole app.
//
// The two <audio> elements (host local source + room-listener remote stream)
// are rendered once by <PersistentAudio> at the App root and never unmount, so
// sound keeps playing while the listener moves between tabs. PlayerView and
// PlayerDock both drive the same state through this hook; neither owns media.
//
// Host audio also feeds the WebRTC capture (useSession.prepareLocalStream reads
// localAudioRef.current), and the room listener's stream lands on
// remoteAudioRef.current.srcObject - both refs are stable here.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isRoomJoinE2eContext, roomJoinE2eAutoplayEnabled } from '../e2e/roomJoinMock';
import type { HostAudioStartupMetric } from '../features/catalog/audioStartupTelemetry';
import type { CatalogTrack, Mode, PlayerState } from '../shared/types';
import { useRoomClock } from '../features/player/useRoomClock';
import { listenerPlaybackStatusForHostState, type AudioStatus } from '../features/player/playbackStatus';

export type PlaybackControls = ReturnType<typeof usePlayback>;

type UsePlaybackDeps = {
  mode: Mode;
  roomId: string;
  localAudioRef: RefObject<HTMLAudioElement | null>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  audioSource: string | null;
  trackSelectionPending: boolean;
  remoteReady: boolean;
  remoteStreamVersion: number;
  localStreamReady: boolean;
  playerState: PlayerState | null;
  catalogTracks: CatalogTrack[];
  selectedTrackId: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onEmitPlayerState: (force: boolean) => void;
};

type HostAudioStartup = {
  source: string;
  startedAt: number;
  metadataReported: boolean;
  firstAudioReported: boolean;
  errorReported: boolean;
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function publishHostAudioStartupMetric(detail: HostAudioStartupMetric): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('dotify:host-audio-startup', { detail }));
  if (import.meta.env.DEV) {
    console.info('[dotify.audio.startup]', detail);
  }
}

export function usePlayback(deps: UsePlaybackDeps) {
  const {
    mode,
    roomId,
    localAudioRef,
    remoteAudioRef,
    audioSource,
    trackSelectionPending,
    remoteReady,
    remoteStreamVersion,
    localStreamReady,
    playerState,
    catalogTracks,
    selectedTrackId,
    onOpenTrack,
    onEmitPlayerState
  } = deps;

  const [localTransport, setTransport] = useState<PlayerState>(() => ({ playing: false, duration: 0, currentTime: 0, updatedAt: Date.now() }));
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [muted, setMutedState] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [remotePausedByUser, setRemotePausedByUser] = useState(false);

  const roomClock = useRoomClock(playerState, mode === 'listener' && remoteReady);
  const transport =
    mode === 'listener'
      ? { ...roomClock.state, playing: roomClock.state.playing && remoteReady && !remotePausedByUser }
      : trackSelectionPending
        ? { playing: false, currentTime: 0, duration: 0, updatedAt: localTransport.updatedAt }
        : localTransport;
  const remoteMuted = muted || mode !== 'listener' || !remoteReady || !playerState?.playing || remotePausedByUser || roomClock.stale;
  const visibleStatus =
    mode !== 'listener'
      ? trackSelectionPending
        ? 'preparing'
        : status
      : roomClock.stale && remoteReady
        ? 'syncing'
        : listenerPlaybackStatusForHostState(status, remoteReady, playerState?.playing ?? false, remotePausedByUser);

  // When a track is opened/skipped we want sound to start as soon as the new
  // source is ready, without forcing the user to press play again.
  const autoplayIntentRef = useRef(false);
  const hostStartupRef = useRef<HostAudioStartup | null>(null);

  // Latest-ref for onOpenTrack: the parent passes a fresh closure every render,
  // so reading it through a ref keeps skip/handleEnded callbacks stable.
  const onOpenTrackRef = useRef(onOpenTrack);
  useEffect(() => {
    onOpenTrackRef.current = onOpenTrack;
  }, [onOpenTrack]);

  const getControllingAudio = useCallback(() => (mode === 'host' ? localAudioRef.current : remoteAudioRef.current), [mode, localAudioRef, remoteAudioRef]);

  const canUseTransport = !trackSelectionPending && (transport.playing || (mode === 'host' ? Boolean(audioSource) : remoteReady));
  const canSeek = mode === 'host' && canUseTransport && localTransport.duration > 0;
  const canRepeat = mode === 'host';
  const canSkip = mode === 'host' && !trackSelectionPending && catalogTracks.length > 1;
  const canShuffle = mode === 'host' && catalogTracks.length > 1;

  const syncFromAudio = useCallback(
    (audio: HTMLAudioElement | null = getControllingAudio()) => {
      // A MediaStream's currentTime is time since reception, not song position.
      // Neither its events nor a leftover solo element may own the room clock.
      if (!audio || mode !== 'host' || audio !== localAudioRef.current) return;
      setTransport(previous => ({
        playing: !audio.paused,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : previous.duration,
        updatedAt: Date.now()
      }));
      setStatus(previous => {
        if (!audio.paused) return 'playing';
        if (previous === 'autoplay-blocked' || previous === 'no-audio') return previous;
        return mode === 'host' ? 'ready' : remoteReady ? 'ready' : previous;
      });
    },
    [getControllingAudio, localAudioRef, mode, remoteReady]
  );

  // Mark intent to start playback as soon as the active source is ready.
  const requestAutoplay = useCallback(() => {
    autoplayIntentRef.current = true;
  }, []);

  // Host: a new decoded source arrived. Move to "preparing" and arm autoplay so
  // the next loadedmetadata kicks playback off inside the user's gesture chain.
  useEffect(() => {
    if (mode !== 'host') return;
    if (!audioSource) {
      hostStartupRef.current = null;
      setStatus(previous => (previous === 'no-audio' ? previous : 'idle'));
      return;
    }
    const startedAt = nowMs();
    hostStartupRef.current = {
      source: audioSource,
      startedAt,
      metadataReported: false,
      firstAudioReported: false,
      errorReported: false
    };
    publishHostAudioStartupMetric({
      phase: 'source-selected',
      source: audioSource,
      elapsedMs: 0,
      timestamp: Date.now()
    });
    autoplayIntentRef.current = true;
    setStatus('preparing');
  }, [audioSource, mode]);

  useEffect(() => {
    setRemotePausedByUser(false);
  }, [roomId]);

  // Consume the live stream continuously, but disable/mute output during host
  // pause or local listening pause. No seeks, stops or peer rebuilds are needed.
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = remoteMuted;
    const stream = audio.srcObject as MediaStream | null;
    stream?.getAudioTracks().forEach(track => {
      track.enabled = !remoteMuted;
    });
  }, [remoteMuted, remoteAudioRef, remoteStreamVersion]);

  useEffect(() => {
    if (mode !== 'listener' || !remoteReady || remotePausedByUser) return;
    const audio = remoteAudioRef.current;
    if (!audio?.srcObject) return;
    let obsolete = false;
    void audio
      .play()
      .then(() => {
        if (!obsolete) setStatus('ready');
      })
      .catch(() => {
        if (!obsolete) setStatus('autoplay-blocked');
      });
    return () => {
      obsolete = true;
    };
  }, [mode, remoteReady, remoteStreamVersion, remoteAudioRef, remotePausedByUser]);

  // Host capture lifecycle feeds the "Hosting" ready state.
  useEffect(() => {
    if (mode !== 'host' || !localStreamReady) return;
    setStatus(previous => (previous === 'playing' ? previous : 'ready'));
  }, [mode, localStreamReady]);

  // Repeat via the element's native `loop`, not a manual replay on `ended`.
  // Native loop seeks back without ever firing `ended`, so the captureStream()
  // audio track never goes to `ended` and the room keeps hearing the looped
  // track. Manual replay-on-ended used to silence the WebRTC stream on loop.
  useEffect(() => {
    const audio = localAudioRef.current;
    if (audio) audio.loop = repeatEnabled;
  }, [repeatEnabled, localAudioRef]);

  const applyMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      if (localAudioRef.current) localAudioRef.current.muted = next;
    },
    [localAudioRef]
  );

  const toggleMute = useCallback(() => applyMuted(!muted), [applyMuted, muted]);

  const togglePlay = useCallback(async () => {
    const audio = getControllingAudio();
    if (!audio || !canUseTransport) return;
    if (mode === 'listener') {
      if (!remotePausedByUser && !audio.paused && playerState?.playing && status !== 'autoplay-blocked') {
        setRemotePausedByUser(true);
      } else {
        setRemotePausedByUser(false);
        try {
          await audio.play();
          setStatus('ready');
        } catch {
          setStatus('autoplay-blocked');
        }
      }
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        setStatus('playing');
      } catch {
        setStatus('autoplay-blocked');
      }
    } else {
      audio.pause();
      setStatus('ready');
    }
    syncFromAudio(audio);
    onEmitPlayerState(true);
  }, [getControllingAudio, canUseTransport, mode, remotePausedByUser, playerState?.playing, status, syncFromAudio, onEmitPlayerState]);

  const seekToProgress = useCallback(
    (progressPercent: number) => {
      const audio = getControllingAudio();
      const duration = transport.duration;
      if (!canSeek || !audio || duration <= 0 || !Number.isFinite(progressPercent)) return;
      audio.currentTime = Math.min(duration, Math.max(0, (progressPercent / 100) * duration));
      syncFromAudio(audio);
      if (mode === 'host') onEmitPlayerState(true);
    },
    [getControllingAudio, transport.duration, syncFromAudio, mode, onEmitPlayerState, canSeek]
  );

  const getSkipTrack = useCallback(
    (direction: 'previous' | 'next') => {
      if (catalogTracks.length === 0) return null;
      if (direction === 'next' && shuffleEnabled) {
        const pool = catalogTracks.filter(track => track.id !== selectedTrackId);
        return pool[Math.floor(Math.random() * pool.length)] ?? catalogTracks[0] ?? null;
      }
      const currentIndex = catalogTracks.findIndex(track => track.id === selectedTrackId);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const offset = direction === 'next' ? 1 : -1;
      const nextIndex = (safeIndex + offset + catalogTracks.length) % catalogTracks.length;
      return catalogTracks[nextIndex] ?? null;
    },
    [catalogTracks, selectedTrackId, shuffleEnabled]
  );

  const skip = useCallback(
    (direction: 'previous' | 'next') => {
      if (!canSkip) return;
      const next = getSkipTrack(direction);
      if (!next) return;
      requestAutoplay();
      onOpenTrackRef.current(next);
    },
    [canSkip, getSkipTrack, requestAutoplay]
  );

  const handleEnded = useCallback(
    (audio: HTMLAudioElement) => {
      if (mode !== 'host') return;
      syncFromAudio(audio);
      if (shuffleEnabled && mode === 'host' && catalogTracks.length > 1) {
        const next = getSkipTrack('next');
        if (next) {
          requestAutoplay();
          onOpenTrackRef.current(next);
        }
      }
    },
    [syncFromAudio, shuffleEnabled, mode, catalogTracks.length, getSkipTrack, requestAutoplay]
  );

  // Called by <PersistentAudio> once the host source has loaded its metadata.
  const handleHostLoadedMetadata = useCallback(
    (audio: HTMLAudioElement) => {
      syncFromAudio(audio);
      const startup = hostStartupRef.current;
      if (startup && !startup.metadataReported) {
        startup.metadataReported = true;
        publishHostAudioStartupMetric({
          phase: 'metadata-ready',
          source: startup.source,
          elapsedMs: Number((nowMs() - startup.startedAt).toFixed(1)),
          durationSeconds: Number.isFinite(audio.duration) ? audio.duration : undefined,
          timestamp: Date.now()
        });
      }
      // E2E room-join keeps the host paused on load so the deterministic preview
      // -> auto-advance transition is driven explicitly by the test rather than
      // racing a sub-second autoplay window. Scope to room-join contexts only so
      // the classic-unlock and artist-publish suites keep their normal autoplay.
      // Manual togglePlay still works.
      if (!autoplayIntentRef.current || (isRoomJoinE2eContext() && !roomJoinE2eAutoplayEnabled())) {
        setStatus('ready');
        return;
      }
      autoplayIntentRef.current = false;
      void audio
        .play()
        .then(() => setStatus('playing'))
        .catch(() => setStatus('autoplay-blocked'));
    },
    [syncFromAudio]
  );

  const handleHostPlaying = useCallback(
    (audio: HTMLAudioElement) => {
      syncFromAudio(audio);
      const startup = hostStartupRef.current;
      if (!startup || startup.firstAudioReported) return;
      startup.firstAudioReported = true;
      publishHostAudioStartupMetric({
        phase: 'first-audio',
        source: startup.source,
        elapsedMs: Number((nowMs() - startup.startedAt).toFixed(1)),
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : undefined,
        timestamp: Date.now()
      });
    },
    [syncFromAudio]
  );

  const handleHostError = useCallback(() => {
    const startup = hostStartupRef.current;
    if (!startup || startup.errorReported) return;
    startup.errorReported = true;
    publishHostAudioStartupMetric({
      phase: 'error',
      source: startup.source,
      elapsedMs: Number((nowMs() - startup.startedAt).toFixed(1)),
      timestamp: Date.now()
    });
  }, []);

  const markNoAudio = useCallback(() => setStatus('no-audio'), []);
  const toggleRepeat = useCallback(() => {
    if (mode === 'host') setRepeatEnabled(value => !value);
  }, [mode]);
  const toggleShuffle = useCallback(() => setShuffleEnabled(value => !value), []);

  return {
    // state
    transport,
    status: visibleStatus,
    remoteMuted,
    muted,
    repeatEnabled,
    shuffleEnabled,
    // capability flags
    canUseTransport,
    canSeek,
    canRepeat,
    canSkip,
    canShuffle,
    // controls
    togglePlay,
    seekToProgress,
    toggleMute,
    skip,
    toggleRepeat,
    toggleShuffle,
    // wiring used by <PersistentAudio>
    getActiveAudio: getControllingAudio,
    syncFromAudio,
    handleEnded,
    handleHostLoadedMetadata,
    handleHostPlaying,
    handleHostError,
    requestAutoplay,
    markNoAudio
  };
}
