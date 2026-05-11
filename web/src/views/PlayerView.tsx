import { Copy, Disc3, Headphones, Library, Pause, Play, Radio, Repeat2, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { EndpointRow } from '../components/ui/EndpointRow';
import { AccessGateOverlay } from '../components/AccessGateOverlay';
import { accessModeLabel, accessModeLabelFromState, formatTime, peerStatusLabel } from '../utils/format';
import type { AccessGate, AccessMode, CatalogTrack, ListenerRecord, Mode, PersonhoodLevel, PlayerState, SessionAction, TrackInfo } from '../types';
import { useEffect, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';

type PlayerViewProps = {
  // Track/audio state
  trackInfo: TrackInfo | null;
  selectedTrack: CatalogTrack | undefined;
  audioSource: string | null;
  coverSource: string;
  playerState: PlayerState | null;
  accessGate: AccessGate | null;
  catalogTracks: CatalogTrack[];
  selectedTrackId: string;
  // Session state
  mode: Mode;
  hostName: string;
  roomId: string;
  sessionAction: SessionAction;
  displayName: string;
  joinCode: string;
  listeners: ListenerRecord[];
  listenerCount: number;
  remoteReady: boolean;
  localStreamReady: boolean;
  error: string | null;
  // Derived display values
  streamTitle: string;
  streamArtist: string;
  accessMode: AccessMode;
  priceDot: string;
  personhoodLevel: PersonhoodLevel;
  description: string;
  // Refs
  localAudioRef: RefObject<HTMLAudioElement>;
  remoteAudioRef: RefObject<HTMLAudioElement>;
  // Callbacks
  onSetDisplayName: (name: string) => void;
  onSetJoinCode: (code: string) => void;
  onChangeMode: (mode: Mode) => void;
  onCreateSession: (event?: FormEvent<HTMLFormElement>) => void;
  onJoinSession: (event: FormEvent<HTMLFormElement>) => void;
  onLeaveSession: () => void;
  onCopySessionLink: () => void;
  onSetAccessGate: (gate: AccessGate | null) => void;
  onPayForTrackAccess: (track: CatalogTrack) => void;
  onShowWalletModal: () => void;
  onNavigateToListen: () => void;
  onPrepareLocalStream: () => void;
  onSetupPreviewLimit: () => void;
  onEmitPlayerState: (force: boolean) => void;
  onEnforcePreviewCutoff: () => void;
  onOpenTrack: (track: CatalogTrack) => void;
};

type QueuedAutoplay = {
  trackId: string;
  previousSource: string | null;
};

export function PlayerView({
  trackInfo,
  selectedTrack,
  audioSource,
  coverSource,
  playerState,
  accessGate,
  catalogTracks,
  selectedTrackId,
  mode,
  hostName,
  roomId,
  sessionAction,
  displayName,
  joinCode,
  listeners,
  remoteReady,
  localStreamReady,
  error,
  streamTitle,
  streamArtist,
  accessMode,
  priceDot,
  personhoodLevel,
  localAudioRef,
  remoteAudioRef,
  onSetDisplayName,
  onSetJoinCode,
  onChangeMode,
  onCreateSession,
  onJoinSession,
  onLeaveSession,
  onCopySessionLink,
  onSetAccessGate,
  onPayForTrackAccess,
  onShowWalletModal,
  onNavigateToListen,
  onPrepareLocalStream,
  onSetupPreviewLimit,
  onEmitPlayerState,
  onEnforcePreviewCutoff,
  onOpenTrack,
  description
}: PlayerViewProps) {
  const effectiveAccessMode = trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode;
  const effectivePriceDot = trackInfo?.priceDot ?? selectedTrack?.priceDot ?? priceDot;
  const effectivePersonhoodLevel = trackInfo?.personhoodLevel ?? selectedTrack?.personhoodLevel ?? personhoodLevel;
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [queuedAutoplay, setQueuedAutoplay] = useState<QueuedAutoplay | null>(null);
  const [transportState, setTransportState] = useState<PlayerState>({
    playing: false,
    duration: playerState?.duration ?? trackInfo?.duration ?? 0,
    currentTime: playerState?.currentTime ?? 0,
    updatedAt: Date.now()
  });
  const transportDuration = transportState.duration || trackInfo?.duration || selectedTrack?.duration || 0;
  const transportProgress = transportDuration > 0 ? Math.min(100, Math.max(0, (transportState.currentTime / transportDuration) * 100)) : 0;
  const transportProgressStyle = { '--progress': `${transportProgress}%` } as CSSProperties;
  const canUseTransport = mode === 'host' ? Boolean(audioSource) : Boolean(remoteReady || remoteAudioRef.current?.srcObject);
  const canShuffle = mode === 'host' && catalogTracks.length > 1;
  const canSkipTracks = mode === 'host' && catalogTracks.length > 1;

  useEffect(() => {
    setTransportState({
      playing: false,
      duration: trackInfo?.duration ?? selectedTrack?.duration ?? 0,
      currentTime: 0,
      updatedAt: Date.now()
    });
  }, [audioSource, selectedTrack?.duration, selectedTrackId, trackInfo?.duration]);

  useEffect(() => {
    if (!playerState) return;
    setTransportState(playerState);
  }, [playerState]);

  useEffect(() => {
    if (!queuedAutoplay || mode !== 'host' || !audioSource || selectedTrackId !== queuedAutoplay.trackId) return undefined;
    if (queuedAutoplay.previousSource && audioSource === queuedAutoplay.previousSource) return undefined;

    const audio = localAudioRef.current;
    if (!audio) return undefined;

    const clearQueuedAutoplay = () => {
      setQueuedAutoplay(current => (current?.trackId === queuedAutoplay.trackId ? null : current));
    };

    const playQueuedTrack = () => {
      void audio
        .play()
        .then(() => syncTransportFromAudio(audio))
        .finally(clearQueuedAutoplay);
    };

    if (audio.readyState >= 1) {
      playQueuedTrack();
      return undefined;
    }

    audio.addEventListener('loadedmetadata', playQueuedTrack, { once: true });
    return () => audio.removeEventListener('loadedmetadata', playQueuedTrack);
  }, [audioSource, localAudioRef, mode, queuedAutoplay, selectedTrackId]);

  function getActiveAudio() {
    return mode === 'host' ? localAudioRef.current : remoteAudioRef.current;
  }

  function syncTransportFromAudio(audio: HTMLAudioElement | null = getActiveAudio()) {
    if (!audio) return;
    setTransportState({
      playing: !audio.paused,
      currentTime: audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : transportDuration,
      updatedAt: Date.now()
    });
  }

  async function togglePlayback() {
    const activeAudio = getActiveAudio();
    if (!activeAudio || !canUseTransport) return;

    if (activeAudio.paused) {
      await activeAudio.play().catch(() => undefined);
    } else {
      activeAudio.pause();
    }

    syncTransportFromAudio(activeAudio);
    if (mode === 'host') onEmitPlayerState(true);
  }

  function seekTransport(nextProgress: number) {
    const activeAudio = getActiveAudio();
    if (!activeAudio || transportDuration <= 0) return;
    activeAudio.currentTime = (nextProgress / 100) * transportDuration;
    syncTransportFromAudio(activeAudio);
    if (mode === 'host') onEmitPlayerState(true);
  }

  function getSkipTrack(direction: 'previous' | 'next') {
    if (catalogTracks.length === 0) return null;

    if (direction === 'next' && shuffleEnabled) {
      const nextTracks = catalogTracks.filter(track => track.id !== selectedTrackId);
      return nextTracks[Math.floor(Math.random() * nextTracks.length)] ?? catalogTracks[0] ?? null;
    }

    const currentIndex = catalogTracks.findIndex(track => track.id === selectedTrackId);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const offset = direction === 'next' ? 1 : -1;
    const nextIndex = (safeCurrentIndex + offset + catalogTracks.length) % catalogTracks.length;
    return catalogTracks[nextIndex] ?? null;
  }

  function openTrackFromTransport(track: CatalogTrack, audio: HTMLAudioElement | null = getActiveAudio()) {
    setQueuedAutoplay({
      trackId: track.id,
      previousSource: audio?.currentSrc || audio?.src || audioSource
    });
    onOpenTrack(track);
  }

  function skipTrack(direction: 'previous' | 'next') {
    if (!canSkipTracks) return;
    const nextTrack = getSkipTrack(direction);
    if (nextTrack) openTrackFromTransport(nextTrack);
  }

  function handleAudioEnded(audio: HTMLAudioElement) {
    syncTransportFromAudio(audio);

    if (repeatEnabled) {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
      return;
    }

    if (shuffleEnabled && mode === 'host' && catalogTracks.length > 0) {
      const nextTrack = getSkipTrack('next');
      if (nextTrack) openTrackFromTransport(nextTrack, audio);
    }
  }

  return (
    <section className='content-grid player-view-grid'>
      <div className='doc-panel player-panel integrated-player-panel'>
        <div className='now-playing'>
          <div className='cover' data-live={localStreamReady || remoteReady} data-playing={transportState.playing}>
            <img src={trackInfo?.imageRef ?? selectedTrack?.imageRef ?? coverSource} alt='' crossOrigin='anonymous' />
            <span className='sound-bars' aria-hidden='true'>
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className='track-copy'>
            <span>{mode === 'host' ? 'Source' : hostName || 'Room'}</span>
            <h2>{streamTitle}</h2>
            <p>{streamArtist}</p>
            <div className='access-badges'>
              <span>{accessModeLabelFromState(effectiveAccessMode)}</span>
              <span>{effectiveAccessMode === 'classic' ? `${effectivePriceDot} DOT` : `PoP ${effectivePersonhoodLevel}`}</span>
            </div>
            <p className='track-description'>{trackInfo?.description ?? selectedTrack?.description ?? description}</p>
          </div>
        </div>

        {mode === 'host' ? (
          <div className='audio-stack'>
            <audio
              className='native-player-source'
              ref={localAudioRef}
              src={audioSource ?? undefined}
              crossOrigin='anonymous'
              onLoadedMetadata={() => {
                syncTransportFromAudio(localAudioRef.current);
                void onPrepareLocalStream();
                onSetupPreviewLimit();
              }}
              onPlay={() => {
                syncTransportFromAudio(localAudioRef.current);
                onEmitPlayerState(true);
                onEnforcePreviewCutoff();
              }}
              onPause={() => {
                syncTransportFromAudio(localAudioRef.current);
                onEmitPlayerState(true);
              }}
              onSeeked={() => {
                syncTransportFromAudio(localAudioRef.current);
                onEmitPlayerState(true);
              }}
              onTimeUpdate={() => {
                syncTransportFromAudio(localAudioRef.current);
                onEmitPlayerState(false);
                onEnforcePreviewCutoff();
              }}
              onEnded={event => handleAudioEnded(event.currentTarget)}
            />
            <div className='remote-state' data-active={localStreamReady}>
              {localStreamReady ? <Play size={16} /> : <Pause size={16} />}
              <span>{localStreamReady ? 'Stream ready' : 'Source missing'}</span>
            </div>
          </div>
        ) : (
          <div className='audio-stack'>
            <audio
              className='native-player-source'
              ref={remoteAudioRef}
              autoPlay
              playsInline
              onLoadedMetadata={event => syncTransportFromAudio(event.currentTarget)}
              onPlay={event => syncTransportFromAudio(event.currentTarget)}
              onPause={event => syncTransportFromAudio(event.currentTarget)}
              onSeeked={event => syncTransportFromAudio(event.currentTarget)}
              onTimeUpdate={event => syncTransportFromAudio(event.currentTarget)}
              onEnded={event => handleAudioEnded(event.currentTarget)}
            />
            <div className='remote-state' data-active={remoteReady}>
              {remoteReady ? <Play size={16} /> : playerState?.playing ? <Pause size={16} /> : <Headphones size={16} />}
              <span>{remoteReady ? 'Stream received' : 'Waiting'}</span>
            </div>
          </div>
        )}

        <div className='player-transport' data-playing={transportState.playing}>
          <div className='transport-cluster' aria-label='Track navigation'>
            <button
              className='transport-skip'
              type='button'
              onClick={() => skipTrack('previous')}
              disabled={!canSkipTracks}
              aria-label='Previous track'
              title={canSkipTracks ? 'Previous track' : 'Previous track needs more than one catalog track'}
            >
              <SkipBack size={16} />
            </button>
            <button
              className='transport-play'
              type='button'
              onClick={() => void togglePlayback()}
              disabled={!canUseTransport}
              aria-label={transportState.playing ? 'Pause track' : 'Play track'}
            >
              {transportState.playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              className='transport-skip'
              type='button'
              onClick={() => skipTrack('next')}
              disabled={!canSkipTracks}
              aria-label='Next track'
              title={canSkipTracks ? (shuffleEnabled ? 'Shuffle next track' : 'Next track') : 'Next track needs more than one catalog track'}
            >
              <SkipForward size={16} />
            </button>
          </div>
          <div className='transport-progress'>
            <span>{formatTime(transportState.currentTime)}</span>
            <input
              type='range'
              min={0}
              max={100}
              step={0.1}
              value={transportProgress}
              style={transportProgressStyle}
              onChange={event => seekTransport(Number(event.target.value))}
              disabled={!canUseTransport || transportDuration <= 0}
              aria-label='Seek track'
            />
            <span>{formatTime(transportDuration)}</span>
          </div>
          <div className='transport-actions' aria-label='Playback modes'>
            <button
              type='button'
              data-active={shuffleEnabled}
              onClick={() => setShuffleEnabled(current => !current)}
              disabled={!canShuffle}
              aria-pressed={shuffleEnabled}
              title={canShuffle ? 'Shuffle catalog after this track' : 'Shuffle needs more than one catalog track'}
            >
              <Shuffle size={16} />
            </button>
            <button
              type='button'
              data-active={repeatEnabled}
              onClick={() => setRepeatEnabled(current => !current)}
              disabled={!canUseTransport}
              aria-pressed={repeatEnabled}
              title='Repeat this track'
            >
              <Repeat2 size={16} />
            </button>
          </div>
        </div>

        {accessGate && (
          <AccessGateOverlay
            gate={accessGate}
            onDismiss={() => onSetAccessGate(null)}
            onPay={
              accessGate.actionType === 'payment'
                ? () => {
                    void onPayForTrackAccess(accessGate.track);
                  }
                : undefined
            }
            onSignIn={accessGate.actionType === 'signin' ? onShowWalletModal : undefined}
          />
        )}
      </div>

      <div className='studio-column player-side-column'>
        <div className='doc-panel session-panel'>
          <PanelTitle icon={Radio} title='Listening room' meta={roomId || 'offline'} />
          <div className='segmented' role='tablist' aria-label='Mode'>
            <button type='button' className={mode === 'host' ? 'active' : ''} onClick={() => onChangeMode('host')}>
              <Radio size={16} />
              Host
            </button>
            <button type='button' className={mode === 'listener' ? 'active' : ''} onClick={() => onChangeMode('listener')}>
              <Headphones size={16} />
              Join
            </button>
          </div>

          <label className='field-label'>Name</label>
          <input className='field' value={displayName} onChange={event => onSetDisplayName(event.target.value)} maxLength={32} />

          {mode === 'host' ? (
            <form className='session-form' onSubmit={onCreateSession}>
              <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
                {sessionAction === 'creating' ? <Disc3 size={16} className='spin' /> : <Radio size={16} />}
                {sessionAction === 'creating' ? 'Opening room…' : 'Start a room'}
              </button>
              <div className='room-code'>
                <span>Code</span>
                <strong>{roomId || '------'}</strong>
                <button type='button' onClick={onCopySessionLink} disabled={!roomId} title='Copy link' aria-label='Copy link'>
                  <Copy size={16} />
                </button>
              </div>
            </form>
          ) : (
            <form className='session-form' onSubmit={onJoinSession}>
              <label className='field-label'>Code</label>
              <input
                className='field code-field'
                value={joinCode}
                onChange={event => onSetJoinCode(event.target.value.toUpperCase())}
                placeholder='ABC123'
                maxLength={12}
              />
              <button className='primary-action' type='submit' disabled={sessionAction !== 'idle'}>
                {sessionAction === 'joining' ? <Disc3 size={16} className='spin' /> : <Headphones size={16} />}
                {sessionAction === 'joining' ? 'Joining…' : 'Join'}
              </button>
            </form>
          )}

          {roomId && (
            <button className='secondary-action' type='button' onClick={onLeaveSession}>
              Leave
            </button>
          )}

          <div className='listener-list'>
            {mode === 'host' && listeners.length > 0 ? (
              listeners.map(listener => (
                <div className='list-row' key={listener.id}>
                  <div>
                    <strong>{listener.displayName}</strong>
                    <span>{peerStatusLabel(listener.status)}</span>
                  </div>
                  <i data-status={listener.status} />
                </div>
              ))
            ) : (
              <div className='list-row muted-row'>
                <div>
                  <strong>{mode === 'host' ? 'No listeners yet' : hostName || 'Host'}</strong>
                  <span>{mode === 'host' ? 'Waiting' : roomId || 'Not connected'}</span>
                </div>
                <i data-status={remoteReady ? 'connected' : 'waiting'} />
              </div>
            )}
          </div>

          {error && <p className='error-box'>{error}</p>}
        </div>

        <div className='doc-panel player-context-panel'>
          <PanelTitle icon={Library} title='Track access' meta={selectedTrack ? accessModeLabel(selectedTrack) : accessModeLabelFromState(accessMode)} />
          <div className='stack-list'>
            <EndpointRow label='Artist' value={streamArtist} />
            <EndpointRow
              label='Access'
              value={
                (selectedTrack?.accessMode ?? accessMode) === 'classic'
                  ? `${selectedTrack?.priceDot ?? priceDot} DOT`
                  : `Human proof ${selectedTrack?.personhoodLevel ?? personhoodLevel}`
              }
            />
            <EndpointRow label='Metadata' value={trackInfo?.metadataRef || selectedTrack?.metadataRef ? 'portable manifest' : 'draft source'} />
          </div>
          <button className='secondary-action' type='button' onClick={onNavigateToListen}>
            Back to catalog
          </button>
        </div>
      </div>
    </section>
  );
}
