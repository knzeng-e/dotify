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
  const {
    mode,
    localAudioRef,
    remoteAudioRef,
    audioSource,
    remoteReady,
    localStreamReady,
    playerState,
    catalogTracks,
    selectedTrackId,
    onOpenTrack,
    onEmitPlayerState
  } = deps;

  const [transport, setTransport] = useState<PlayerState>(() => ({ playing: false, duration: 0, currentTime: 0, updatedAt: Date.now() }));
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [muted, setMutedState] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [remotePausedByUser, setRemotePausedByUser] = useState(false);

  // When a track is opened/skipped we want sound to start as soon as the new
  // source is ready, without forcing the user to press play again.
  const autoplayIntentRef = useRef(false);

  // Latest-ref for onOpenTrack: the parent passes a fresh closure every render,
  // so reading it through a ref keeps skip/handleEnded callbacks stable.
  const onOpenTrackRef = useRef(onOpenTrack);
  useEffect(() => {
    onOpenTrackRef.current = onOpenTrack;
  }, [onOpenTrack]);

  const isAudioPlaying = useCallback((audio: HTMLAudioElement | null) => Boolean(audio && !audio.paused && !audio.ended), []);

  const getModeAudio = useCallback(() => (mode === 'host' ? localAudioRef.current : remoteAudioRef.current), [mode, localAudioRef, remoteAudioRef]);

  const getPlayingAudio = useCallback(() => {
    const localAudio = localAudioRef.current;
    const remoteAudio = remoteAudioRef.current;
    if (isAudioPlaying(localAudio)) return localAudio;
    if (isAudioPlaying(remoteAudio)) return remoteAudio;
    return null;
  }, [isAudioPlaying, localAudioRef, remoteAudioRef]);

  const getControllingAudio = useCallback(() => getPlayingAudio() ?? getModeAudio(), [getPlayingAudio, getModeAudio]);

  const canUseTransport = transport.playing || (mode === 'host' ? Boolean(audioSource) : remoteReady);
  const canSkip = mode === 'host' && catalogTracks.length > 1;
  const canShuffle = mode === 'host' && catalogTracks.length > 1;

  const syncFromAudio = useCallback(
    (audio: HTMLAudioElement | null = getControllingAudio()) => {
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
        return mode === 'host' ? 'ready' : remoteReady ? 'ready' : previous;
      });
    },
    [getControllingAudio, mode, remoteReady]
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
    if (playerState) {
      setTransport(remotePausedByUser ? { ...playerState, playing: false, updatedAt: Date.now() } : playerState);
    }
  }, [mode, playerState, remotePausedByUser]);

  useEffect(() => {
    if (mode !== 'listener') return;
    // Before the first broadcast arrives, a freshly connected listener is
    // "Connected" rather than "In sync" - default to not-playing.
    setStatus(remoteReady ? (!remotePausedByUser && (playerState?.playing ?? false) ? 'playing' : 'ready') : 'joining');
    // Depend only on the play flag: playerState is a fresh object on every host
    // clock tick (~4 Hz), but only playing/paused changes the status.
  }, [mode, remoteReady, remotePausedByUser, playerState?.playing]);

  useEffect(() => {
    if (mode !== 'listener' || !remoteReady) {
      setRemotePausedByUser(false);
    }
  }, [mode, remoteReady]);

  // Listener: as soon as the remote stream lands (remoteReady), attempt playback.
  // Surfaces 'autoplay-blocked' so the UI shows "Tap play to start" instead of
  // silent "In sync" when the browser blocks autoplay without user gesture.
  useEffect(() => {
    if (mode !== 'listener' || !remoteReady) return;
    const audio = remoteAudioRef.current;
    if (!audio || !audio.srcObject) return;
    void audio
      .play()
      .then(() => setStatus('playing'))
      .catch(() => setStatus('autoplay-blocked'));
  }, [mode, remoteReady, remoteAudioRef]);

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
    const playingAudio = getPlayingAudio();
    if (playingAudio) {
      if (isAudioPlaying(localAudioRef.current)) {
        localAudioRef.current?.pause();
      }
      if (isAudioPlaying(remoteAudioRef.current)) {
        remoteAudioRef.current?.pause();
        if (mode === 'listener') setRemotePausedByUser(true);
      }
      syncFromAudio(playingAudio);
      if (mode === 'host' || playingAudio === localAudioRef.current) onEmitPlayerState(true);
      return;
    }

    const audio = getControllingAudio();
    if (!audio || !canUseTransport) return;
    if (audio.paused) {
      try {
        await audio.play();
        if (audio === remoteAudioRef.current) setRemotePausedByUser(false);
        setStatus('playing');
      } catch {
        setStatus('autoplay-blocked');
      }
    } else {
      audio.pause();
      // Host idles back to its capturable "ready" state; a listener pausing a
      // live stream keeps whatever connection status it already had.
      setStatus(previous => (mode === 'host' ? 'ready' : previous));
    }
    syncFromAudio(audio);
    if (mode === 'host') onEmitPlayerState(true);
  }, [getPlayingAudio, isAudioPlaying, localAudioRef, remoteAudioRef, mode, syncFromAudio, onEmitPlayerState, getControllingAudio, canUseTransport]);

  const seekToProgress = useCallback(
    (progressPercent: number) => {
      const audio = getControllingAudio();
      const duration = transport.duration;
      if (!audio || duration <= 0) return;
      audio.currentTime = Math.min(duration, Math.max(0, (progressPercent / 100) * duration));
      syncFromAudio(audio);
      if (mode === 'host') onEmitPlayerState(true);
    },
    [getControllingAudio, transport.duration, syncFromAudio, mode, onEmitPlayerState]
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
          onOpenTrackRef.current(next);
        }
      }
    },
    [syncFromAudio, repeatEnabled, shuffleEnabled, mode, catalogTracks.length, getSkipTrack, requestAutoplay]
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
  const toggleRepeat = useCallback(() => setRepeatEnabled(value => !value), []);
  const toggleShuffle = useCallback(() => setShuffleEnabled(value => !value), []);

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
    toggleRepeat,
    toggleShuffle,
    // wiring used by <PersistentAudio>
    getActiveAudio: getControllingAudio,
    syncFromAudio,
    handleEnded,
    handleHostLoadedMetadata,
    requestAutoplay,
    markNoAudio
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
    case 'idle':
      return '';
    default:
      return mode === 'host' ? 'Hosting' : 'Ready';
  }
}
