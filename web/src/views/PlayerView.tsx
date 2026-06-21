import {
  Copy,
  Disc3,
  Headphones,
  KeyRound,
  Library,
  Maximize2,
  Pause,
  Play,
  Radio,
  Repeat2,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Users,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { EndpointRow } from '../components/ui/EndpointRow';
import { Avatar } from '../components/Presence';
import { AccessGateOverlay } from '../components/AccessGateOverlay';
import { RoomQrCode } from '../components/RoomQrCode';
import { accessModeLabel, accessModeLabelFromState, formatTime, peerStatusLabel } from '../utils/format';
import { playbackStatusLabel, type PlaybackControls } from '../hooks/usePlayback';
import type { AccessGate, AccessMode, CatalogTrack, ListenerRecord, Mode, SessionAction, TrackInfo } from '../types';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

type PlayerViewProps = {
  // Track/audio state
  trackInfo: TrackInfo | null;
  selectedTrack: CatalogTrack | undefined;
  coverSource: string;
  accessGate: AccessGate | null;
  // Shared persistent playback
  playback: PlaybackControls;
  // Session state
  mode: Mode;
  hostName: string;
  roomId: string;
  sessionLink: string;
  sessionAction: SessionAction;
  displayName: string;
  joinCode: string;
  listeners: ListenerRecord[];
  remoteReady: boolean;
  localStreamReady: boolean;
  error: string | null;
  // Derived display values
  streamTitle: string;
  streamArtist: string;
  selectedTrackHasAccess: boolean;
  accessMode: AccessMode;
  priceDot: string;
  description: string;
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
  onOpenArtist: (artistName: string) => void;
};

export function PlayerView({
  trackInfo,
  selectedTrack,
  coverSource,
  accessGate,
  playback,
  mode,
  hostName,
  roomId,
  sessionLink,
  sessionAction,
  displayName,
  joinCode,
  listeners,
  remoteReady,
  localStreamReady,
  error,
  streamTitle,
  streamArtist,
  selectedTrackHasAccess,
  accessMode,
  priceDot,
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
  onOpenArtist,
  description
}: PlayerViewProps) {
  const effectiveAccessMode = trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode;
  const effectivePriceDot = trackInfo?.priceDot ?? selectedTrack?.priceDot ?? priceDot;
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [isQrProjectorOpen, setIsQrProjectorOpen] = useState(false);
  const qrProjectorRef = useRef<HTMLDivElement | null>(null);
  const qrProjectorCloseRef = useRef<HTMLButtonElement | null>(null);

  const { transport, status } = playback;
  const transportDuration = transport.duration || trackInfo?.duration || selectedTrack?.duration || 0;
  const transportProgress = transportDuration > 0 ? Math.min(100, Math.max(0, (transport.currentTime / transportDuration) * 100)) : 0;
  const transportProgressStyle = { '--progress': `${transportProgress}%` } as CSSProperties;
  const isBusy = status === 'preparing' || status === 'joining';
  const statusLabel = playbackStatusLabel(status, mode);
  const isManagedTrack = Boolean(selectedTrack && selectedTrack.source === 'artist' && selectedTrack.id.includes(':'));
  const needsTrackAccess = Boolean(selectedTrack && isManagedTrack && !selectedTrackHasAccess);
  const accessStatusLabel = needsTrackAccess ? 'Preview available' : effectiveAccessMode === 'classic' ? 'Full track unlocked' : 'Ready to listen';
  const accessPriceLabel = effectiveAccessMode === 'classic' ? (needsTrackAccess ? `${effectivePriceDot} DOT` : 'Unlocked for this wallet') : 'Human pass';
  const previewCtaLabel = effectiveAccessMode === 'classic' ? 'Unlock full track' : 'Check access';

  function handleQrProjectorBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsQrProjectorOpen(false);
    }
  }

  // Local ambient reactions over the cover (visual delight, not broadcast).
  function sendReaction(emoji: string) {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    setReactions(current => [...current, { id, emoji, x }]);
    window.setTimeout(() => setReactions(current => current.filter(reaction => reaction.id !== id)), 2600);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.player-view-grid')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isQrProjectorOpen) return undefined;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appContainer = document.getElementById('root');
    const previousAppContainerAriaHidden = appContainer?.getAttribute('aria-hidden') ?? null;
    let didHideAppContainer = false;
    const frame = window.requestAnimationFrame(() => {
      (qrProjectorCloseRef.current ?? qrProjectorRef.current)?.focus();
      if (appContainer) {
        appContainer.setAttribute('aria-hidden', 'true');
        didHideAppContainer = true;
      }
    });

    function getFocusableElements() {
      const dialog = qrProjectorRef.current;
      if (!dialog) return [];

      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(element => element.getClientRects().length > 0 || element === document.activeElement);
    }

    function handleProjectorKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsQrProjectorOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = qrProjectorRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && (activeElement === lastElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleProjectorKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleProjectorKeyDown);
      if (appContainer && didHideAppContainer) {
        if (previousAppContainerAriaHidden === null) {
          appContainer.removeAttribute('aria-hidden');
        } else {
          appContainer.setAttribute('aria-hidden', previousAppContainerAriaHidden);
        }
      }
      previousActiveElement?.focus();
    };
  }, [isQrProjectorOpen]);

  const connectedListenerCount = listeners.filter(listener => listener.status === 'connected').length;
  const qrProjectorDialog =
    mode === 'host' && roomId && sessionLink && isQrProjectorOpen ? (
      <div
        className='room-qr-projector'
        role='dialog'
        aria-modal='true'
        aria-labelledby='room-qr-projector-title'
        tabIndex={-1}
        ref={qrProjectorRef}
        onClick={handleQrProjectorBackdropClick}
      >
        <button
          className='room-qr-projector-close'
          type='button'
          onClick={() => setIsQrProjectorOpen(false)}
          aria-label='Close projected QR'
          ref={qrProjectorCloseRef}
        >
          <X size={20} />
        </button>
        <div className='room-qr-projector-content'>
          <p className='modal-eyebrow'>Room {roomId}</p>
          <h2 id='room-qr-projector-title'>Scan to join</h2>
          <RoomQrCode value={sessionLink} label={`Large QR code for room ${roomId}`} asLink={false} />
          <code>{sessionLink}</code>
        </div>
      </div>
    ) : null;

  return (
    <section className={'content-grid player-view-grid' + (roomId ? ' player-room-mode' : '')}>
      {roomId && (
        <div className='room-header'>
          <span className='room-live-chip'>
            <span className='live-dot' />
            Live
          </span>
          <span className='room-header-meta'>{mode === 'host' ? `${connectedListenerCount + 1} in the room` : `with ${hostName || 'the host'}`}</span>
          <div className='room-code-pill'>
            <span>ROOM</span>
            <strong className='tnum'>{roomId}</strong>
            <button className='room-copy-btn' type='button' onClick={onCopySessionLink}>
              <Copy size={14} />
              Copy link
            </button>
          </div>
        </div>
      )}
      {roomId && (
        <div className='room-promise-strip' aria-label='Room access model'>
          <span>
            <Users size={14} />
            {connectedListenerCount + 1} present
          </span>
          <span>
            <KeyRound size={14} />
            Host holds access
          </span>
          <span>
            <ShieldCheck size={14} />
            Guests receive stream only
          </span>
        </div>
      )}
      <div className='player-stage'>
        <div className='player-cover-column'>
          <div className={'room-cover-glow' + (transport.playing ? ' on' : '')} aria-hidden='true' />
          <div className='cover-card'>
            <div className='cover' data-live={localStreamReady || remoteReady} data-playing={transport.playing}>
              <img src={trackInfo?.imageRef ?? selectedTrack?.imageRef ?? coverSource} alt='' crossOrigin='anonymous' />
              <span className='sound-bars' aria-hidden='true'>
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className='room-reactions' aria-hidden='true'>
                {reactions.map(reaction => (
                  <span className='room-reaction' key={reaction.id} style={{ left: `${reaction.x}%` }}>
                    {reaction.emoji}
                  </span>
                ))}
              </span>
            </div>
            <div className='audio-stack'>
              <div className='remote-state' data-active={transport.playing} data-busy={isBusy}>
                {isBusy ? (
                  <span className='remote-state-dots' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : transport.playing ? (
                  <Play size={16} />
                ) : (
                  <Headphones size={16} />
                )}
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className='player-main-column'>
          <div className='track-copy'>
            <button className='player-artist-link' type='button' onClick={() => onOpenArtist(streamArtist)}>
              {streamArtist}
            </button>
            <h2>{streamTitle}</h2>
            <span className='track-room-label'>{mode === 'host' ? 'Now playing' : hostName || 'Room'}</span>
            <div className='access-badges'>
              <span className='access-chip' data-tone={needsTrackAccess ? 'preview' : 'ready'}>
                {accessStatusLabel}
              </span>
              <span className='access-chip'>{accessPriceLabel}</span>
            </div>
            <p className='track-description'>{trackInfo?.description ?? selectedTrack?.description ?? description}</p>

            {needsTrackAccess && selectedTrack && (
              <div className='preview-access-card' data-access={effectiveAccessMode}>
                <div>
                  <strong>{effectiveAccessMode === 'classic' ? 'Preview mode' : 'Access check needed'}</strong>
                  <span>
                    {effectiveAccessMode === 'classic'
                      ? 'Stay in preview, or unlock full playback when you are ready.'
                      : 'Stay in preview, or check whether your wallet can open the full track.'}
                  </span>
                </div>
                <button
                  className='primary-action compact-action'
                  type='button'
                  onClick={() => {
                    if (effectiveAccessMode === 'classic') {
                      void onPayForTrackAccess(selectedTrack);
                      return;
                    }
                    onShowWalletModal();
                  }}
                >
                  <KeyRound size={16} />
                  {previewCtaLabel}
                </button>
              </div>
            )}

            <div className='player-transport' data-playing={transport.playing}>
              <div className='transport-cluster' aria-label='Track navigation'>
                <button
                  className='transport-skip'
                  type='button'
                  onClick={() => playback.skip('previous')}
                  disabled={!playback.canSkip}
                  aria-label='Previous track'
                  title={playback.canSkip ? 'Previous track' : 'Add more tracks to skip'}
                >
                  <SkipBack size={16} />
                </button>
                <button
                  className='transport-play'
                  type='button'
                  onClick={() => void playback.togglePlay()}
                  disabled={!playback.canUseTransport}
                  aria-label={transport.playing ? 'Pause' : 'Play'}
                >
                  {transport.playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  className='transport-skip'
                  type='button'
                  onClick={() => playback.skip('next')}
                  disabled={!playback.canSkip}
                  aria-label='Next track'
                  title={playback.canSkip ? (playback.shuffleEnabled ? 'Shuffle next track' : 'Next track') : 'Add more tracks to skip'}
                >
                  <SkipForward size={16} />
                </button>
              </div>
              <div className='transport-progress'>
                <span>{formatTime(transport.currentTime)}</span>
                <input
                  type='range'
                  min={0}
                  max={100}
                  step={0.1}
                  value={transportProgress}
                  style={transportProgressStyle}
                  onChange={event => playback.seekToProgress(Number(event.target.value))}
                  disabled={!playback.canUseTransport || transportDuration <= 0}
                  aria-label='Seek'
                />
                <span>{formatTime(transportDuration)}</span>
              </div>
              <div className='transport-actions' aria-label='Playback modes'>
                <button
                  type='button'
                  data-active={playback.muted}
                  onClick={playback.toggleMute}
                  aria-pressed={playback.muted}
                  title={playback.muted ? 'Unmute' : 'Mute'}
                >
                  {playback.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  type='button'
                  data-active={playback.shuffleEnabled}
                  onClick={playback.toggleShuffle}
                  disabled={!playback.canShuffle}
                  aria-pressed={playback.shuffleEnabled}
                  title={playback.canShuffle ? 'Shuffle' : 'Add more tracks to shuffle'}
                >
                  <Shuffle size={16} />
                </button>
                <button
                  type='button'
                  data-active={playback.repeatEnabled}
                  onClick={playback.toggleRepeat}
                  disabled={!playback.canUseTransport}
                  aria-pressed={playback.repeatEnabled}
                  title='Repeat this track'
                >
                  <Repeat2 size={16} />
                </button>
              </div>
            </div>

            {roomId && (
              <p className='room-sync-note'>
                <span className='live-dot' />
                {mode === 'host' ? 'You are hosting - everyone hears what you play.' : `Following ${hostName || 'the host'} - in sync`}
              </p>
            )}

            {roomId && (
              <div className='room-react-bar' aria-label='Send a reaction to the room'>
                {['heart', 'fire', 'leaf', 'sparkle', 'raise', 'tear'].map((key, index) => {
                  const emoji = ['❤️', '🔥', '🌿', '✨', '🙌', '🥹'][index];
                  return (
                    <button className='room-react-btn' type='button' key={key} onClick={() => sendReaction(emoji)} aria-label={`React ${key}`}>
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
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
      </div>

      {!roomId && (
        <div className='solo-room-invite'>
          <div>
            <span className='eyebrow'>One link away</span>
            <strong>Make this track a shared room.</strong>
            <p>Live stream, one link, host-held access.</p>
          </div>
          <button className='primary-action compact-action' type='button' onClick={() => onCreateSession()}>
            <Radio size={16} />
            Open room
          </button>
        </div>
      )}

      <div className='player-lower-grid'>
        <div className='doc-panel session-panel'>
          <PanelTitle icon={Radio} title={roomId ? 'In the room' : 'Listening room'} meta={roomId || 'offline'} />
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

          {mode === 'host' && roomId && sessionLink && (
            <div className='room-share-card'>
              <div className='room-share-copy'>
                <strong>Scan to join</strong>
                <span>Opens this room link directly.</span>
                <button className='room-project-btn' type='button' onClick={() => setIsQrProjectorOpen(true)}>
                  <Maximize2 size={14} />
                  Project QR
                </button>
              </div>
              <RoomQrCode value={sessionLink} label={`QR code for room ${roomId}`} />
            </div>
          )}

          <div className='listener-list'>
            {mode === 'host' && (
              <div className='list-row' key='host-self'>
                <div className='room-person-main'>
                  <Avatar name={displayName || 'Host'} size={34} host />
                  <div>
                    <strong>
                      {displayName || 'You'}
                      <span className='room-person-tag'>host</span>
                    </strong>
                    <span>holds access</span>
                  </div>
                </div>
                {transport.playing ? (
                  <span className='room-eq' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <i data-status={localStreamReady ? 'connected' : 'waiting'} />
                )}
              </div>
            )}
            {mode === 'host' && listeners.length > 0 ? (
              listeners.map(listener => (
                <div className='list-row' key={listener.id}>
                  <div className='room-person-main'>
                    <Avatar name={listener.displayName} size={34} />
                    <div>
                      <strong>{listener.displayName}</strong>
                      <span>{peerStatusLabel(listener.status)}</span>
                    </div>
                  </div>
                  {listener.status === 'connected' ? (
                    <span className='room-eq' aria-hidden='true'>
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <i data-status={listener.status} />
                  )}
                </div>
              ))
            ) : mode === 'host' ? (
              <div className='list-row muted-row'>
                <div>
                  <strong>No listeners yet</strong>
                  <span>Share the link to fill the room</span>
                </div>
                <i data-status='waiting' />
              </div>
            ) : (
              <div className='list-row'>
                <div className='room-person-main'>
                  <Avatar name={hostName || 'Host'} size={34} host />
                  <div>
                    <strong>
                      {hostName || 'Host'}
                      <span className='room-person-tag'>host</span>
                    </strong>
                    <span>{roomId || 'Not connected'}</span>
                  </div>
                </div>
                {remoteReady ? (
                  <span className='room-eq' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <i data-status='waiting' />
                )}
              </div>
            )}
          </div>

          {roomId && (
            <p className='room-doctrine-note'>
              {mode === 'host'
                ? 'You hold track access for this room. Guests hear your stream and never receive content keys.'
                : 'You are listening to the host stream. No wallet or proof is needed just to be present.'}
            </p>
          )}

          {error && <p className='error-box'>{error}</p>}
        </div>

        <div className='doc-panel player-context-panel'>
          <PanelTitle
            icon={Library}
            title='Listening access'
            meta={needsTrackAccess ? 'Preview mode' : selectedTrack ? accessModeLabel(selectedTrack) : accessModeLabelFromState(accessMode)}
          />
          <div className='stack-list'>
            <EndpointRow label='Artist' value={streamArtist} />
            <EndpointRow
              label={(selectedTrack?.accessMode ?? accessMode) === 'classic' ? 'Full track' : 'Access'}
              value={(selectedTrack?.accessMode ?? accessMode) === 'classic' ? `${selectedTrack?.priceDot ?? priceDot} DOT` : 'Human pass'}
            />
            <EndpointRow label='Release' value={trackInfo?.metadataRef || selectedTrack?.metadataRef ? 'Published' : 'Draft'} />
          </div>
          <button className='secondary-action' type='button' onClick={onNavigateToListen}>
            Back to catalog
          </button>
        </div>
      </div>

      {qrProjectorDialog && (typeof document === 'undefined' ? qrProjectorDialog : createPortal(qrProjectorDialog, document.body))}
    </section>
  );
}
