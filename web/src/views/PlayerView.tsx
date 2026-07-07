import {
  Copy,
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
import { PanelTitle } from '../shared/ui/PanelTitle';
import { EndpointRow } from '../shared/ui/EndpointRow';
import { Avatar } from '../components/Presence';
import { AccessGateOverlay } from '../components/AccessGateOverlay';
import { RoomChat } from '../components/RoomChat';
import { RoomRequests } from '../components/RoomRequests';
import { RoomQrCode } from '../components/RoomQrCode';
import { Dialog } from '../components/Dialog';
import { hashHue, initialsFor } from '../shared/utils/aura';
import { formatTime } from '../shared/utils/format';
import { isPolicyManagedTrack, trackHasAccess } from '../features/access/accessPolicy';
import { roomPresenceCount } from '../features/rooms/roomState';
import { playbackStatusLabel, transportProgressPercent } from '../features/player/playbackStatus';
import { useCatalogContext, useSessionContext, usePlaybackContext, useUiFeedback, useNavigation, useReleaseForm } from '../app/providers';
import type { CatalogTrack } from '../shared/types';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

// The player page reads its track/session/playback state from context. The only
// props are the two room-modal triggers, whose open state lives in ListenerShell.
type PlayerViewProps = {
  onShowCreateModal: () => void;
  onShowJoinModal: () => void;
};

export function PlayerView({ onShowCreateModal, onShowJoinModal }: PlayerViewProps) {
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { playback } = usePlaybackContext();
  const { setShowWalletModal } = useUiFeedback();
  const { navigateToView, setPublicArtistName } = useNavigation();
  const { title, artistName, accessMode, priceDot } = useReleaseForm();

  const trackInfo = catalog.trackInfo;
  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const coverSource = catalog.coverSource;
  const accessGate = catalog.accessGate;
  const {
    mode,
    hostName,
    roomId,
    sessionLink,
    sessionAction,
    sessionStatus,
    listenerCount,
    listeners,
    remoteReady,
    localStreamReady,
    roomPlaybackMode,
    error
  } = session;
  const streamTitle = trackInfo?.title || selectedTrack?.title || title;
  const streamArtist = trackInfo?.artist || selectedTrack?.artist || artistName;
  const selectedTrackHasAccess = selectedTrack ? trackHasAccess(selectedTrack, catalog.catalogAccessByTrackId) : false;

  const onLeaveSession = session.leaveSession;
  const onRetryRoomAudio = session.requestRoomAudio;
  const onCopySessionLink = session.copySessionLink;
  const onSetAccessGate = catalog.setAccessGate;
  const onPayForTrackAccess = (track: CatalogTrack) => {
    void catalog.payForTrackAccess(track);
  };
  const onShowWalletModal = () => setShowWalletModal(true);
  const onNavigateToListen = () => navigateToView('listen');
  const onOpenArtist = (name: string) => {
    setPublicArtistName(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const effectiveAccessMode = trackInfo?.accessMode ?? selectedTrack?.accessMode ?? accessMode;
  const effectivePriceDot = trackInfo?.priceDot ?? selectedTrack?.priceDot ?? priceDot;
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; x: number; senderName: string; self: boolean }>>([]);
  const [isQrProjectorOpen, setIsQrProjectorOpen] = useState(false);

  const { transport, status } = playback;
  const transportDuration = transport.duration || trackInfo?.duration || selectedTrack?.duration || 0;
  const transportProgress = transportProgressPercent(transport.currentTime, transportDuration);
  const transportProgressStyle = { '--progress': `${transportProgress}%` } as CSSProperties;
  const isBusy = status === 'preparing' || status === 'joining';
  const isOnAir = !isBusy && transport.playing;
  const statusLabel = isOnAir ? 'ON AIR' : playbackStatusLabel(status, mode);
  const isManagedTrack = Boolean(selectedTrack && isPolicyManagedTrack(selectedTrack));
  const needsTrackAccess = Boolean(selectedTrack && isManagedTrack && !selectedTrackHasAccess);
  const showPreviewAction = Boolean(needsTrackAccess && selectedTrack);
  const showWideStatus = Boolean(selectedTrack && !showPreviewAction);
  const accessStatusLabel = needsTrackAccess ? 'Preview mode' : effectiveAccessMode === 'classic' ? 'Full track unlocked' : 'Ready to listen';
  const accessPriceLabel = effectiveAccessMode === 'classic' ? (needsTrackAccess ? `${effectivePriceDot} DOT` : 'Unlocked for this wallet') : 'Human pass';
  const previewCtaLabel = effectiveAccessMode === 'classic' ? 'Unlock full track' : 'Check access';
  const presenceCount = roomPresenceCount(listenerCount, Boolean(roomId));
  const activeListeners = listeners.filter(listener => listener.status !== 'disconnected');
  const disconnectedListeners = listeners.filter(listener => listener.status === 'disconnected');
  const showManualAudioStart = Boolean(
    mode === 'listener' && roomId && remoteReady && (status === 'autoplay-blocked' || /manual|tap play/i.test(sessionStatus))
  );
  const showAudioRetry = Boolean(mode === 'listener' && roomId && (!remoteReady || status === 'no-audio'));

  // Broadcast reactions: petals rise from real room:reaction events relayed by
  // the signaling server (sender included -- the echo is the single render
  // path). Each petal carries the sender's initials and name-hashed hue, in
  // line with the Constellation honesty rule.
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const selfId = session.socketRef.current?.id;
    const fresh = session.reactionFeed.filter(reaction => !seenReactionIdsRef.current.has(reaction.id));
    if (fresh.length === 0) return;

    const petals = fresh.map(reaction => {
      seenReactionIdsRef.current.add(reaction.id);
      return {
        id: reaction.id,
        emoji: reaction.emoji,
        x: 20 + Math.random() * 60,
        senderName: reaction.senderName,
        self: reaction.senderId === selfId
      };
    });
    if (seenReactionIdsRef.current.size > 200) {
      seenReactionIdsRef.current = new Set(session.reactionFeed.map(reaction => reaction.id));
    }

    setReactions(current => [...current, ...petals]);
    const petalIds = new Set(petals.map(petal => petal.id));
    window.setTimeout(() => setReactions(current => current.filter(petal => !petalIds.has(petal.id))), 2600);
    // The feed is the only real input; socketRef is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.reactionFeed]);

  // Unlock ritual (Constellation phase C): when THIS track's real access flips
  // from needed to granted, a ring of light travels the cover once. Keyed off
  // the access map transition, never off status strings.
  const [ritualKey, setRitualKey] = useState(0);
  const previousAccessRef = useRef<{ trackId: string; needed: boolean } | null>(null);
  useEffect(() => {
    const trackId = selectedTrack?.id ?? null;
    const previous = previousAccessRef.current;
    if (trackId && previous && previous.trackId === trackId && previous.needed && !needsTrackAccess) {
      setRitualKey(Date.now());
      const timer = window.setTimeout(() => setRitualKey(0), 1400);
      previousAccessRef.current = { trackId, needed: needsTrackAccess };
      return () => window.clearTimeout(timer);
    }
    previousAccessRef.current = trackId ? { trackId, needed: needsTrackAccess } : null;
  }, [selectedTrack?.id, needsTrackAccess]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.player-view-grid')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const qrProjectorDialog =
    mode === 'host' && roomId && sessionLink && isQrProjectorOpen ? (
      <Dialog
        backdropClassName='room-qr-projector'
        className='room-qr-projector-card'
        labelledBy='room-qr-projector-title'
        onClose={() => setIsQrProjectorOpen(false)}
      >
        <button className='room-qr-projector-close' type='button' onClick={() => setIsQrProjectorOpen(false)} aria-label='Close projected QR'>
          <X size={20} />
        </button>
        <div className='room-qr-projector-content'>
          <p className='modal-eyebrow'>Room {roomId}</p>
          <h2 id='room-qr-projector-title'>Scan to join</h2>
          <RoomQrCode value={sessionLink} label={`Large QR code for room ${roomId}`} asLink={false} />
          <code>{sessionLink}</code>
        </div>
      </Dialog>
    ) : null;

  return (
    <section className={'content-grid player-view-grid' + (roomId ? ' player-room-mode' : '')}>
      {roomId && (
        <div className='room-header'>
          <span className='room-live-chip'>
            <span className='live-dot' />
            Live
          </span>
          <span className='room-header-meta'>{mode === 'host' ? `${presenceCount} in the room` : `with ${hostName || 'the host'}`}</span>
          {/* Honest room playback mode ('full' or the 42% 'preview' fallback),
              exposed as a non-visual metadata hook; the visible preview cue lives
              in the rooms list and session status. */}
          <span
            data-testid='room-playback-mode'
            data-mode={roomPlaybackMode}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0
            }}
          >
            {roomPlaybackMode}
          </span>
          <div className='room-code-pill'>
            <span>ROOM</span>
            <strong className='tnum' data-testid='room-code'>
              {roomId}
            </strong>
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
            {presenceCount} present
          </span>
          <span>
            <KeyRound size={14} />
            Host keeps the music flowing
          </span>
          <span>
            <ShieldCheck size={14} />
            Guests just join and listen
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
                  <span
                    className='room-reaction'
                    key={reaction.id}
                    data-self={reaction.self || undefined}
                    style={{ left: `${reaction.x}%`, '--petal-hue': hashHue(reaction.senderName) } as CSSProperties}
                  >
                    <span className='room-reaction-emoji'>{reaction.emoji}</span>
                    <span className='room-reaction-sender'>{initialsFor(reaction.senderName)}</span>
                  </span>
                ))}
              </span>
              {ritualKey !== 0 && <span className='unlock-ritual' key={ritualKey} aria-hidden='true' />}
            </div>
            <div className={`audio-stack${showPreviewAction ? ' has-preview-action' : ''}${showWideStatus ? ' has-wide-status' : ''}`}>
              <div className='remote-state' data-active={transport.playing} data-busy={isBusy}>
                {isBusy ? (
                  <span className='remote-state-dots' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : transport.playing ? (
                  <span className='on-air-pulse' aria-hidden='true' />
                ) : (
                  <Headphones size={16} />
                )}
                <span>{statusLabel}</span>
              </div>
              {showPreviewAction && selectedTrack && (
                <button
                  className='preview-cover-action'
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
              )}
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
              <span
                className='access-chip'
                data-tone={needsTrackAccess ? 'preview' : 'ready'}
                data-testid={needsTrackAccess ? 'preview-player-state' : effectiveAccessMode === 'classic' ? 'full-playback-state' : undefined}
              >
                {accessStatusLabel}
              </span>
              <span className='access-chip'>{accessPriceLabel}</span>
            </div>

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

            {/* The reaction bar lives in the RoomChat aside now: broadcast
                reactions and chat share one social cluster. */}
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
          <button className='primary-action compact-action' type='button' onClick={onShowCreateModal}>
            <Radio size={16} />
            Open room
          </button>
        </div>
      )}

      <div className='player-lower-grid'>
        <div className='doc-panel session-panel'>
          <PanelTitle icon={Radio} title={roomId ? 'In the room' : 'Listening room'} meta={roomId || 'offline'} />

          {/* State 1: not in any room */}
          {!roomId && (
            <button className='secondary-action' type='button' onClick={onShowJoinModal} disabled={sessionAction !== 'idle'}>
              <Headphones size={16} />
              Join a room
            </button>
          )}

          {/* State 2: hosting a room */}
          {roomId && mode === 'host' && (
            <>
              <div className='room-code'>
                <span>Room code</span>
                <strong>{roomId}</strong>
                <button type='button' onClick={onCopySessionLink} title='Copy link' aria-label='Copy link'>
                  <Copy size={16} />
                </button>
              </div>

              {sessionLink && (
                <div className='room-share-card'>
                  <div className='room-share-copy'>
                    <strong>Scan to join</strong>
                    <span>People can join from their camera.</span>
                    <button className='room-project-btn' type='button' onClick={() => setIsQrProjectorOpen(true)}>
                      <Maximize2 size={14} />
                      Show big QR
                    </button>
                  </div>
                  <RoomQrCode value={sessionLink} label={`QR code for room ${roomId}`} />
                </div>
              )}

              <div className='listener-list'>
                <div className='list-row'>
                  <div className='room-person-main'>
                    <Avatar name={hostName || 'You'} size={34} host />
                    <div>
                      <strong>
                        {hostName || 'You'}
                        <span className='room-person-tag'>host</span>
                      </strong>
                      <span>sharing the music</span>
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
                {activeListeners.length > 0 ? (
                  activeListeners.map(listener => (
                    <div className='list-row' key={listener.id}>
                      <div className='room-person-main'>
                        <Avatar name={listener.displayName} size={34} />
                        <div>
                          <strong>{listener.displayName}</strong>
                          <span>{listener.status === 'connected' ? 'In the room' : 'Connecting...'}</span>
                        </div>
                      </div>
                      {listener.status === 'connected' ? (
                        <span className='room-eq' aria-hidden='true'>
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <i data-status='connecting' />
                      )}
                    </div>
                  ))
                ) : (
                  <div className='list-row muted-row'>
                    <div>
                      <strong>No listeners yet</strong>
                      <span>Share the link to fill the room</span>
                    </div>
                    <i data-status='waiting' />
                  </div>
                )}
                {disconnectedListeners.length > 0 && (
                  <div className='list-row muted-row'>
                    <div>
                      <strong>{disconnectedListeners.length === 1 ? 'A listener left' : 'Some listeners left'}</strong>
                      <span>The room count only includes people still connected.</span>
                    </div>
                    <i data-status='waiting' />
                  </div>
                )}
              </div>

              <p className='room-doctrine-note'>You choose the music. Guests join and listen - only you need track access.</p>

              <button className='secondary-action' type='button' onClick={onLeaveSession}>
                Close room
              </button>
            </>
          )}

          {/* State 3: listening in a room */}
          {roomId && mode === 'listener' && (
            <>
              <div className='list-row'>
                <div className='room-person-main'>
                  <Avatar name={hostName || 'Host'} size={34} host />
                  <div>
                    <strong>
                      {hostName || 'Host'}
                      <span className='room-person-tag'>host</span>
                    </strong>
                    <span data-testid='room-listener-sync'>{remoteReady ? 'In sync' : 'Connecting...'}</span>
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

              <p className='room-doctrine-note'>You are listening with the host. The link is enough to be here.</p>

              {(showManualAudioStart || showAudioRetry) && (
                <button
                  className='primary-action'
                  type='button'
                  onClick={() => {
                    if (showManualAudioStart) {
                      void playback.togglePlay();
                      return;
                    }
                    onRetryRoomAudio();
                  }}
                >
                  <Headphones size={16} />
                  {showManualAudioStart ? 'Start audio' : 'Retry audio'}
                </button>
              )}

              <button className='secondary-action' type='button' onClick={onLeaveSession}>
                Leave
              </button>
            </>
          )}

          {error && (
            <p className='error-box' data-testid='session-error'>
              {error}
            </p>
          )}
        </div>

        {roomId && (
          <div className='room-social-column'>
            <RoomChat />
            <RoomRequests />
          </div>
        )}

        <div className='doc-panel player-context-panel'>
          <PanelTitle icon={Library} title='Current track' meta={needsTrackAccess ? 'Preview mode' : 'Ready to play'} />
          <div className='stack-list'>
            <EndpointRow label='Artist' value={streamArtist} />
            <EndpointRow
              label='Listen'
              value={effectiveAccessMode === 'classic' ? (needsTrackAccess ? `${effectivePriceDot} DOT to unlock` : 'Full track ready') : 'Open in this room'}
            />
            <EndpointRow label='Status' value={trackInfo?.metadataRef || selectedTrack?.metadataRef ? 'In the catalog' : 'Being prepared'} />
          </div>
          <button className='secondary-action' type='button' onClick={onNavigateToListen}>
            Browse music
          </button>
        </div>
      </div>

      {qrProjectorDialog}
    </section>
  );
}
