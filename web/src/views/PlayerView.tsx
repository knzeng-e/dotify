import { Copy, Disc3, Headphones, Library, Pause, Play, Radio } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { EndpointRow } from '../components/ui/EndpointRow';
import { AccessGateOverlay } from '../components/AccessGateOverlay';
import { accessModeLabel, accessModeLabelFromState, formatTime, peerStatusLabel, progressPercent } from '../utils/format';
import type { AccessGate, AccessMode, CatalogTrack, ListenerRecord, Mode, PersonhoodLevel, PlayerState, SessionAction, TrackInfo } from '../types';
import type { FormEvent } from 'react';

type PlayerViewProps = {
  // Track/audio state
  trackInfo: TrackInfo | null;
  selectedTrack: CatalogTrack | undefined;
  audioSource: string | null;
  coverSource: string;
  playerState: PlayerState | null;
  accessGate: AccessGate | null;
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
  localAudioRef: React.RefObject<HTMLAudioElement>;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
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
};

export function PlayerView({
  trackInfo,
  selectedTrack,
  audioSource,
  coverSource,
  playerState,
  accessGate,
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
  description
}: PlayerViewProps) {
  const effectiveAccessMode = trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode;
  const effectivePriceDot = trackInfo?.priceDot ?? selectedTrack?.priceDot ?? priceDot;
  const effectivePersonhoodLevel = trackInfo?.personhoodLevel ?? selectedTrack?.personhoodLevel ?? personhoodLevel;

  return (
    <section className='content-grid player-view-grid'>
      <div className='doc-panel player-panel integrated-player-panel'>
        <div className='now-playing'>
          <div className='cover' data-live={localStreamReady || remoteReady}>
            <img src={trackInfo?.imageRef ?? selectedTrack?.imageRef ?? coverSource} alt='' crossOrigin='anonymous' />
          </div>
          <div className='track-copy'>
            <span>{mode === 'host' ? 'Source' : hostName || 'Room'}</span>
            <h2>{streamTitle}</h2>
            <p>{streamArtist}</p>
            <div className='access-badges'>
              <span>{accessModeLabelFromState(effectiveAccessMode)}</span>
              <span>
                {effectiveAccessMode === 'classic'
                  ? `${effectivePriceDot} DOT`
                  : `PoP ${effectivePersonhoodLevel}`}
              </span>
            </div>
            <p className='track-description'>{trackInfo?.description ?? selectedTrack?.description ?? description}</p>
          </div>
        </div>

        {mode === 'host' ? (
          <div className='audio-stack'>
            <audio
              ref={localAudioRef}
              src={audioSource ?? undefined}
              crossOrigin='anonymous'
              controls
              onLoadedMetadata={() => {
                void onPrepareLocalStream();
                onSetupPreviewLimit();
              }}
              onPlay={() => {
                onEmitPlayerState(true);
                onEnforcePreviewCutoff();
              }}
              onPause={() => onEmitPlayerState(true)}
              onSeeked={() => onEmitPlayerState(true)}
              onTimeUpdate={() => {
                onEmitPlayerState(false);
                onEnforcePreviewCutoff();
              }}
            />
            <div className='remote-state' data-active={localStreamReady}>
              {localStreamReady ? <Play size={16} /> : <Pause size={16} />}
              <span>{localStreamReady ? 'Stream ready' : 'Source missing'}</span>
            </div>
          </div>
        ) : (
          <div className='audio-stack'>
            <audio ref={remoteAudioRef} controls autoPlay playsInline />
            <div className='remote-state' data-active={remoteReady}>
              {remoteReady ? <Play size={16} /> : playerState?.playing ? <Pause size={16} /> : <Headphones size={16} />}
              <span>{remoteReady ? 'Stream received' : 'Waiting'}</span>
            </div>
          </div>
        )}

        <div className='progress-line'>
          <span>{formatTime(playerState?.currentTime ?? 0)}</span>
          <div>
            <i style={{ width: `${progressPercent(playerState)}%` }} />
          </div>
          <span>{formatTime(playerState?.duration ?? trackInfo?.duration ?? 0)}</span>
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
          <PanelTitle
            icon={Library}
            title='Track access'
            meta={selectedTrack ? accessModeLabel(selectedTrack) : accessModeLabelFromState(accessMode)}
          />
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
