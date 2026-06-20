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
import type { CatalogTrack, Mode, PlayerState } from '../types';

export type AudioStatus =
  | 'idle' //            nothing selected yet
  | 'preparing' //       source set, decoding / loading metadata
  | 'autoplay-blocked' // play() was rejected; a tap is needed
  | 'ready' //           host source loaded and capturable ("Hosting")
  | 'playing' //         sound is actually playing
  | 'joining' //         room listener waiting for the live stream
  | 'no-audio'; //       genuine failure or missing source

export type PlaybackControls = ReturnType<typeof usePlayback>;

type UsePlaybackDeps = {
  mode: Mode;
  localAudioRef: RefObject<HTMLAudioElement | null>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  audioSource: string | null;
  remoteReady: boolean;
  localStreamReady: boolean;
  playerState: PlayerState | null;
  catalogTracks: CatalogTrack[];
  selectedTrackId: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onEmitPlayerState: (force: boolean) => void;
};

export function usePlayback(deps: UsePlaybackDeps) {
  const { mode, localAudioRef, remoteAudioRef, audioSource, remoteReady, localStreamReady, playerState, catalogTracks, selectedTrackId, onOpenTrack, onEmitPlayerState } = deps;

  const [transport, setTransport] = useState<PlayerState>(() => ({ playing: false, duration: 0, currentTime: 0, updatedAt: Date.now() }));
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [muted, setMutedState] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);

  // When a track is opened/skipped we want sound to start as soon as the new
  // source is ready, without forcing the user to press play again.
  const autoplayIntentRef = useRef(false);

  const getActiveAudio = useCallback(() => (mode === 'host' ? localAudioRef.current : remoteAudioRef.current), [mode, localAudioRef, remoteAudioRef]);

  const canUseTransport = mode === 'host' ? Boolean(audioSource) : remoteReady;
  const canSkip = mode === 'host' && catalogTracks.length > 1;
  const canShuffle = mode === 'host' && catalogTracks.length > 1;

  const syncFromAudio = useCallback(
    (audio: HTMLAudioElement | null = getActiveAudio()) => {
      if (!audio) return;
      setTransport(previous => ({
        playing: !audio.paused,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : previous.duration,
        updatedAt: Date.now()
      }));
      setStatus(previous => {
        if (!audio.paused) return 'playing';
        if (previous === 'autoplay-blocked' || previous === 'no-audio') return previous;
        return mode === 'host' ? 'ready' : previous;
      });
    },
    [getActiveAudio, mode]
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
      setStatus(previous => (previous === 'no-audio' ? previous : 'idle'));
      return;
    }
    autoplayIntentRef.current = true;
    setStatus('preparing');
  }, [audioSource, mode]);

  // Listener: reflect the host's broadcast clock and the connection lifecycle.
  useEffect(() => {
    if (mode !== 'listener') return;
    if (playerState) setTransport(playerState);
  }, [mode, playerState]);

  useEffect(() => {
    if (mode !== 'listener') return;
    setStatus(remoteReady ? (playerState?.playing ?? true ? 'playing' : 'ready') : 'joining');
  }, [mode, remoteReady, playerState]);

  // Host capture lifecycle feeds the "Hosting" ready state.
  useEffect(() => {
    if (mode !== 'host' || !localStreamReady) return;
    setStatus(previous => (previous === 'playing' ? previous : 'ready'));
  }, [mode, localStreamReady]);

  const applyMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      if (localAudioRef.current) localAudioRef.current.muted = next;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = next;
    },
    [localAudioRef, remoteAudioRef]
  );

  const toggleMute = useCallback(() => applyMuted(!muted), [applyMuted, muted]);

  const togglePlay = useCallback(async () => {
    const audio = getActiveAudio();
    if (!audio || !canUseTransport) return;
    if (audio.paused) {
      try {
        await audio.play();
        setStatus('playing');
      } catch {
        setStatus('autoplay-blocked');
      }
    } else {
      audio.pause();
      setStatus(mode === 'host' ? 'ready' : 'ready');
    }
    syncFromAudio(audio);
    if (mode === 'host') onEmitPlayerState(true);
  }, [getActiveAudio, canUseTransport, mode, syncFromAudio, onEmitPlayerState]);

  const seekToProgress = useCallback(
    (progressPercent: number) => {
      const audio = getActiveAudio();
      const duration = transport.duration;
      if (!audio || duration <= 0) return;
      audio.currentTime = Math.min(duration, Math.max(0, (progressPercent / 100) * duration));
      syncFromAudio(audio);
      if (mode === 'host') onEmitPlayerState(true);
    },
    [getActiveAudio, transport.duration, syncFromAudio, mode, onEmitPlayerState]
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
      onOpenTrack(next);
    },
    [canSkip, getSkipTrack, requestAutoplay, onOpenTrack]
  );

  const handleEnded = useCallback(
    (audio: HTMLAudioElement) => {
      syncFromAudio(audio);
      if (repeatEnabled) {
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
        return;
      }
      if (shuffleEnabled && mode === 'host' && catalogTracks.length > 1) {
        const next = getSkipTrack('next');
        if (next) {
          requestAutoplay();
          onOpenTrack(next);
        }
      }
    },
    [syncFromAudio, repeatEnabled, shuffleEnabled, mode, catalogTracks.length, getSkipTrack, requestAutoplay, onOpenTrack]
  );

  // Called by <PersistentAudio> once the host source has loaded its metadata.
  const handleHostLoadedMetadata = useCallback(
    (audio: HTMLAudioElement) => {
      syncFromAudio(audio);
      if (!autoplayIntentRef.current) {
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

  const markNoAudio = useCallback(() => setStatus('no-audio'), []);

  return {
    // state
    transport,
    status,
    muted,
    repeatEnabled,
    shuffleEnabled,
    // capability flags
    canUseTransport,
    canSkip,
    canShuffle,
    // controls
    togglePlay,
    seekToProgress,
    toggleMute,
    skip,
    toggleRepeat: () => setRepeatEnabled(value => !value),
    toggleShuffle: () => setShuffleEnabled(value => !value),
    // wiring used by <PersistentAudio>
    getActiveAudio,
    syncFromAudio,
    handleEnded,
    handleHostLoadedMetadata,
    requestAutoplay,
    markNoAudio,
    setStatus
  };
}

export function playbackStatusLabel(status: AudioStatus, mode: Mode): string {
  switch (status) {
    case 'preparing':
      return 'Preparing audio';
    case 'autoplay-blocked':
      return 'Tap play to start';
    case 'joining':
      return 'Joining live audio';
    case 'no-audio':
      return 'No audio available';
    case 'playing':
      return mode === 'host' ? 'Playing' : 'In sync';
    case 'ready':
      return mode === 'host' ? 'Hosting' : 'Connected';
    default:
      return mode === 'host' ? 'Hosting' : 'Ready';
  }
}
