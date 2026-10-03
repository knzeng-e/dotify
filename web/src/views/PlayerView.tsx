import { PlayerTransport } from '../components/PlayerTransport';
import { HostLineup } from '../components/HostLineup';
import { PlayerQueueDialog } from '../components/PlayerQueueDialog';
import { RoomShareDialog } from '../components/RoomShareDialog';
import { ReleaseDetailsDialog } from '../components/ReleaseDetailsDialog';
import { ArtistDonationButton } from '../components/ArtistDonationButton';
import { HostContributions } from '../components/HostContributions';
import { ChevronDown, Coins, Copy, Check, ExternalLink, Headphones, KeyRound, Library, QrCode, Radio, Share2, X } from 'lucide-react';
import { PanelTitle } from '../shared/ui/PanelTitle';
import { EndpointRow } from '../shared/ui/EndpointRow';
import { CoverImage } from '../components/CoverImage';
import { Avatar, AvatarStack } from '../components/Presence';
import { AccessGateOverlay } from '../components/AccessGateOverlay';
import { RoomChat } from '../components/RoomChat';
import { RoomReactions } from '../components/RoomReactions';
import { RoomRequests } from '../components/RoomRequests';
import { RoomQrCode } from '../components/RoomQrCode';
import { Dialog } from '../components/Dialog';
import { isPolicyManagedTrack, trackHasAccess } from '../features/access/accessPolicy';
import { isChosenDisplayName } from '../features/identity/walletIdentity';
import { roomHostDisplayName, roomListenerSyncLabel, roomPresenceCount, roomPresencePreview } from '../features/rooms/roomState';
import { playbackTrack, playbackTrackDetails } from '../features/player/playbackPresentation';
import { playbackStatusLabel } from '../features/player/playbackStatus';
import { nativeRuntimeAmountLabel } from '../features/payments/paymentModel';
import { runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import { resolveRoomContributionTrack } from '../features/donations/roomContributionTrack';
import { useCatalogContext, useSessionContext, usePlaybackContext, useUiFeedback, useNavigation, useReleaseForm } from '../app/providers';
import type { CatalogTrack } from '../shared/types';
import { useEffect, useRef, useState } from 'react';

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
  const { openWalletModal } = useUiFeedback();
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
    displayName,
    remoteReady,
    localStreamReady,
    roomPlaybackMode,
    productHostWebRtcUnavailable,
    error
  } = session;
  const roomContribution = resolveRoomContributionTrack(catalog.catalogTracks, trackInfo);
  const contributionTrack = roomId ? (roomContribution.state === 'ready' ? roomContribution.track : null) : selectedTrack;
  const currentTrack = playbackTrack(mode, trackInfo, selectedTrack);
  const streamTitle = currentTrack?.title || (mode === 'listener' ? 'Waiting for the host’s track' : title);
  const streamArtist = currentTrack?.artist || (mode === 'listener' ? '' : artistName);
  const selectedTrackHasAccess = selectedTrack ? trackHasAccess(selectedTrack, catalog.catalogAccessByTrackId) : false;

  const onLeaveSession = session.leaveSession;
  const onSetDisplayName = session.setDisplayName;
  const onUpdateDisplayName = session.updateDisplayName;
  const onRetryRoomAudio = session.requestRoomAudio;
  const onCopySessionLink = session.copySessionLink;
  const onSetAccessGate = catalog.setAccessGate;
  const onPayForTrackAccess = (track: CatalogTrack) => {
    void catalog.payForTrackAccess(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
  };
  const onShowSupportWalletModal = () => openWalletModal('support');
  const onNavigateToListen = () => navigateToView('listen');
  const onOpenArtist = (name: string) => {
    setPublicArtistName(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const trackDetails = playbackTrackDetails(mode, trackInfo, selectedTrack, { accessMode, priceDot });
  const effectiveAccessMode = trackDetails.accessMode;
  const effectivePriceDot = trackDetails.priceDot;
  const nativePaymentAsset = catalog.nativeRuntimePaymentAsset;
  const effectivePaymentAmount = nativeRuntimeAmountLabel(effectivePriceDot, nativePaymentAsset);
  const releaseDescription = trackDetails.description;
  const [isQrProjectorOpen, setIsQrProjectorOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsTrack, setDetailsTrack] = useState<CatalogTrack | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [roomPanel, setRoomPanel] = useState<'chat' | 'queue' | 'people'>('chat');
  const [chatUnread, setChatUnread] = useState(false);
  useEffect(() => {
    setRoomPanel('chat');
    setShareOpen(false);
    setChatUnread(false);
  }, [roomId]);
  useEffect(() => {
    if (!roomId || mode !== 'host' || session.socketStatus !== 'online' || roomContribution.state !== 'recoverable' || !trackInfo) return;
    const runtimeAddress = runtimeAddressFromTrackId(roomContribution.track);
    if (!runtimeAddress) return;

    const repairedTrack = { ...trackInfo, runtimeAddress };
    catalog.setTrackInfo(repairedTrack);
    session.socketEmit('room:track', repairedTrack);
  }, [catalog, mode, roomContribution, roomId, session, trackInfo]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)');
    const resetPeople = () => {
      if (desktop.matches) setRoomPanel(current => (current === 'people' ? 'chat' : current));
    };
    desktop.addEventListener('change', resetPeople);
    return () => desktop.removeEventListener('change', resetPeople);
  }, []);

  const { transport, status } = playback;
  const transportDuration = transport.duration || currentTrack?.duration || 0;
  const audioStartupDetail = mode === 'host' && (status === 'idle' || status === 'preparing') ? (catalog.audioStartupStatus ?? undefined) : undefined;
  const isBusy = status === 'preparing' || status === 'joining' || Boolean(audioStartupDetail);
  const isOnAir = !isBusy && transport.playing;
  const statusLabel = isOnAir ? 'ON AIR' : !roomId && status === 'ready' ? 'Ready to listen' : playbackStatusLabel(status, mode, audioStartupDetail);
  const isRoomGuest = mode === 'listener' && Boolean(roomId);
  const isManagedTrack = Boolean(selectedTrack && isPolicyManagedTrack(selectedTrack));
  const selectedTrackInactive = selectedTrack?.active === false;
  const needsTrackAccess = Boolean(!isRoomGuest && selectedTrack && isManagedTrack && !selectedTrackHasAccess);
  const showUnlockAction = Boolean(needsTrackAccess && selectedTrack && !selectedTrackInactive);
  const showWideStatus = Boolean(selectedTrack && !showUnlockAction);
  const accessStatusLabel = isRoomGuest
    ? remoteReady
      ? 'Listening with the host'
      : 'Waiting for the host'
    : selectedTrackInactive
      ? 'Release unavailable'
      : needsTrackAccess
        ? 'Listening closed'
        : effectiveAccessMode === 'classic'
          ? 'Full track opened'
          : 'Ready to listen';
  const accessPriceLabel = isRoomGuest
    ? 'Live room stream'
    : selectedTrackInactive
      ? 'Inactive release'
      : effectiveAccessMode === 'classic'
        ? needsTrackAccess
          ? effectivePaymentAmount
          : 'Full track opened'
        : effectiveAccessMode === 'free'
          ? 'Free for everyone'
          : 'Free for verified humans';
  const unlockCtaLabel = effectiveAccessMode === 'classic' ? 'Unlock listening' : 'Check access';
  const canHostSelectedTrack = Boolean(selectedTrack && !selectedTrackInactive && !needsTrackAccess && catalog.audioSource);
  const presenceCount = roomPresenceCount(listenerCount, Boolean(roomId));
  const activeListeners = listeners.filter(listener => listener.status !== 'disconnected');
  const disconnectedListeners = listeners.filter(listener => listener.status === 'disconnected');
  const visibleHostName = roomHostDisplayName(mode === 'host' ? hostName || displayName : hostName);
  const hostIsAlone = mode === 'host' && activeListeners.length === 0;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const ownSocketId = session.socketRef.current?.id;
  const showManualAudioStart = Boolean(
    mode === 'listener' && roomId && remoteReady && (status === 'autoplay-blocked' || /manual|tap play/i.test(sessionStatus))
  );
  const showAudioRetry = Boolean(mode === 'listener' && roomId && !productHostWebRtcUnavailable && (!remoteReady || status === 'no-audio'));
  const soloRoomRecoveryIsJoin = mode === 'listener' || /room closed|expired|host left/i.test(`${sessionStatus} ${error ?? ''}`);

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
        historyDismiss
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
    <section
      className={'content-grid player-view-grid' + (roomId ? ' player-room-mode' : '')}
      data-room-panel={roomPanel}
      aria-label={roomId ? 'Shared listening room' : 'Player'}
    >
      {!roomId && (
        <header className='solo-player-header'>
          <button type='button' className='icon-action' onClick={onNavigateToListen} aria-label='Back to Music' title='Back to Music'>
            <ChevronDown size={24} />
          </button>
          <span>Now playing</span>
        </header>
      )}
      {roomId && (
        <div className='room-header'>
          <button type='button' className='icon-action room-back' onClick={onNavigateToListen} aria-label='Back to Music' title='Back to Music'>
            <ChevronDown size={24} />
          </button>
          <div className='room-social-context'>
            <span className='room-live-chip' data-online={session.socketStatus === 'online'}>
              <span className='live-dot' data-online={session.socketStatus === 'online'} aria-hidden='true' />
              {session.socketStatus === 'online' ? (mode === 'host' ? 'Hosting' : 'Together') : 'Reconnecting'}
            </span>
            <span className='room-header-meta'>
              {session.socketStatus === 'online' && <AvatarStack {...roomPresencePreview(visibleHostName || '', listeners, listenerCount)} max={3} size={22} />}
              {session.socketStatus === 'online' ? `${presenceCount} here · ` : ''}
              {mode === 'host' ? 'you host' : visibleHostName ? `with ${visibleHostName}` : 'listening together'}
            </span>
          </div>
          {/* Room playback mode metadata hook (always 'full' since access model
              v2 retired the preview; kept for wire compatibility); the visible cue lives
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
          <button
            className='room-composer-done'
            type='button'
            aria-label='Finish typing'
            onPointerDown={event => event.preventDefault()}
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            }}
          >
            Done
          </button>
          <span className='sr-only' data-testid='room-code'>
            {roomId}
          </span>
          <button className='icon-action room-share-trigger' type='button' onClick={() => setShareOpen(true)} aria-label='Share room' title='Share room'>
            <Share2 size={20} />
          </button>
        </div>
      )}
      {roomId &&
        (session.socketStatus !== 'online' ||
          showManualAudioStart ||
          showAudioRetry ||
          productHostWebRtcUnavailable ||
          error ||
          /reconnecting/i.test(sessionStatus)) && (
          <div className='room-connection-note' role='status'>
            <span>
              {error ||
                (/reconnecting/i.test(sessionStatus) ? 'Reconnecting to the listening moment.' : '') ||
                (session.socketStatus !== 'online'
                  ? 'Reconnecting to the room. Your draft stays here.'
                  : productHostWebRtcUnavailable
                    ? 'Continue in your browser to hear this room.'
                    : showManualAudioStart
                      ? 'Tap to hear everyone’s listening moment.'
                      : 'The host’s audio hasn’t arrived yet.')}
            </span>
            {productHostWebRtcUnavailable ? (
              <button type='button' onClick={() => void session.openRoomInBrowser()}>
                Continue in browser
              </button>
            ) : (
              (showManualAudioStart || showAudioRetry) && (
                <button type='button' onClick={() => (showManualAudioStart ? void playback.togglePlay() : onRetryRoomAudio())}>
                  {showManualAudioStart ? 'Start audio' : 'Retry audio'}
                </button>
              )
            )}
          </div>
        )}
      {roomId && (
        <div className='room-panel-switch' role='tablist' aria-label='Room views'>
          {(['chat', 'queue', 'people'] as const).map(panel => (
            <button
              key={panel}
              type='button'
              role='tab'
              id={`room-tab-${panel}`}
              aria-controls={`room-panel-${panel}`}
              aria-selected={roomPanel === panel}
              tabIndex={roomPanel === panel ? 0 : -1}
              onClick={() => setRoomPanel(panel)}
              onKeyDown={event => {
                const tabs = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
                  tab => tab.getClientRects().length > 0
                );
                const index = tabs.indexOf(event.currentTarget);
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                tabs[next].click();
                tabs[next].focus();
              }}
            >
              {panel === 'chat' ? 'Chat' : panel === 'queue' ? 'Queue' : session.socketStatus === 'online' ? `People · ${presenceCount}` : 'People'}
              {panel === 'chat' && chatUnread && <span className='room-chat-unread' role='img' aria-label='New messages' />}
              {panel === 'queue' && session.requestQueue.length > 0 && (
                <span className='room-request-count' aria-label={`${session.requestQueue.length} requests`}>
                  {session.requestQueue.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className='player-stage'>
        <div className='player-cover-column'>
          <div className={'room-cover-glow' + (transport.playing ? ' on' : '')} aria-hidden='true' />
          <div className='cover-card'>
            <div className={`audio-stack${showUnlockAction ? ' has-unlock-action' : ''}${showWideStatus ? ' has-wide-status' : ''}`}>
              <div className='remote-state' role='status' aria-label='Playback status' data-active={transport.playing} data-busy={isBusy}>
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
              {showUnlockAction && selectedTrack && (
                <button
                  className='unlock-cover-action'
                  type='button'
                  onClick={() => {
                    onSetAccessGate(catalog.buildAccessGateInfo(selectedTrack));
                  }}
                >
                  <KeyRound size={16} />
                  {unlockCtaLabel}
                </button>
              )}
            </div>
            <div className='cover' data-live={localStreamReady || remoteReady} data-playing={transport.playing}>
              <CoverImage
                src={currentTrack?.imageRef ?? (mode === 'host' ? coverSource : undefined)}
                alt=''
                fallbackLabel={streamTitle || 'Dotify'}
                loading='eager'
                fetchPriority='high'
                sizes='(max-width: 760px) calc(100vw - 40px), 440px'
              />
              <span className='sound-bars' aria-hidden='true'>
                <i />
                <i />
                <i />
                <i />
              </span>
              {ritualKey !== 0 && <span className='unlock-ritual' key={ritualKey} aria-hidden='true' />}
            </div>
          </div>
        </div>

        <div className='player-main-column'>
          <div className='track-copy'>
            <h2>{streamTitle}</h2>
            <div className='track-attribution'>
              {streamArtist && (
                <button className='player-artist-link' type='button' onClick={() => onOpenArtist(streamArtist)} title={`View ${streamArtist}`}>
                  {streamArtist}
                </button>
              )}
              {contributionTrack && <ArtistDonationButton key={contributionTrack.id} track={contributionTrack} kind='tip' />}
              {roomId && trackInfo && roomContribution.state !== 'ready' && (
                <button
                  className='secondary-action contribution-action contribution-action-unavailable'
                  data-kind='tip'
                  type='button'
                  disabled
                  aria-label='Tip this track unavailable'
                  aria-describedby='room-tip-status'
                >
                  <Coins size={18} aria-hidden='true' />
                  <span className='contribution-action-label'>Tip this track</span>
                  <span className='contribution-action-short' aria-hidden='true'>
                    Tip
                  </span>
                </button>
              )}
            </div>
            {roomId && trackInfo && roomContribution.state !== 'ready' && (
              <p className='room-tip-status' id='room-tip-status' role='status'>
                {roomContribution.state === 'recoverable'
                  ? mode === 'host'
                    ? 'Verifying this track for room tips...'
                    : 'The host needs to refresh this track before a tip can be routed safely.'
                  : roomContribution.reason === 'ambiguous-release'
                    ? 'This track matches more than one release. Tips stay unavailable until the host refreshes it.'
                    : roomContribution.reason === 'runtime-mismatch'
                      ? 'This room does not match the verified release. Tips stay unavailable.'
                      : 'This live track has no verified contribution route.'}
              </p>
            )}
            <span className='track-room-label'>{mode === 'host' ? 'Now playing' : visibleHostName ? `With ${visibleHostName}` : 'Listening together'}</span>

            {!roomId && (
              <div className='access-badges' data-needs-access={needsTrackAccess}>
                {(selectedTrackInactive || needsTrackAccess) && (
                  <span
                    className='access-chip'
                    data-tone={needsTrackAccess ? 'locked' : 'ready'}
                    data-testid={needsTrackAccess ? 'locked-player-state' : undefined}
                  >
                    {accessStatusLabel}
                  </span>
                )}
                <span
                  className='access-chip'
                  data-testid={!needsTrackAccess && !selectedTrackInactive && effectiveAccessMode === 'classic' ? 'full-playback-state' : 'player-access-price'}
                >
                  {accessPriceLabel}
                </span>
              </div>
            )}

            {roomId && mode === 'listener' && !remoteReady && (
              <p className='room-sync-note'>
                <span className='live-dot' data-online={session.socketStatus === 'online'} aria-hidden='true' />
                {roomListenerSyncLabel(remoteReady, sessionStatus)}
              </p>
            )}
          </div>

          {accessGate && !isRoomGuest && (
            <AccessGateOverlay
              gate={accessGate}
              nativePaymentAsset={nativePaymentAsset}
              onDismiss={() => onSetAccessGate(null)}
              onPay={
                accessGate.actionType === 'payment'
                  ? () => {
                      void onPayForTrackAccess(accessGate.track);
                    }
                  : undefined
              }
              onSignIn={
                accessGate.actionType === 'signin'
                  ? () => {
                      onSetAccessGate(null);
                      onShowSupportWalletModal();
                    }
                  : undefined
              }
            />
          )}
        </div>
        <PlayerTransport
          playback={playback}
          duration={transportDuration}
          listener={isRoomGuest}
          onOpenQueue={!roomId ? () => setQueueOpen(true) : undefined}
          onOpenDetails={!roomId && selectedTrack ? () => setDetailsTrack(selectedTrack) : undefined}
        />
        {roomId && <RoomReactions key={roomId} selfId={ownSocketId} />}
        {roomId && (
          <div className='access-badges' data-needs-access={needsTrackAccess}>
            <span className='access-chip' data-tone={needsTrackAccess ? 'locked' : 'ready'} data-testid={needsTrackAccess ? 'locked-player-state' : undefined}>
              {accessStatusLabel}
            </span>
            <span className='access-chip' data-testid='player-access-price'>
              {accessPriceLabel}
            </span>
          </div>
        )}
      </div>

      {!roomId && releaseDescription && <p className='solo-release-note'>{releaseDescription}</p>}

      {!roomId && canHostSelectedTrack && (
        <div className='solo-room-invite'>
          <div>
            <span className='eyebrow'>One link away</span>
            <strong>Make this track a shared room.</strong>
            <p>Invite someone into what you’re hearing. All they need is the link.</p>
          </div>
          <button className='primary-action compact-action' type='button' onClick={onShowCreateModal}>
            <Radio size={16} />
            Open room
          </button>
        </div>
      )}

      {!roomId && error && (
        <div className='solo-session-feedback'>
          <p className='error-box' data-testid='session-error'>
            {error}
          </p>
          {productHostWebRtcUnavailable ? (
            <button className='primary-action' type='button' onClick={() => void session.openRoomInBrowser()}>
              <ExternalLink size={16} />
              Open Dotify in browser
            </button>
          ) : (
            <button className='secondary-action' type='button' onClick={soloRoomRecoveryIsJoin ? onShowJoinModal : onShowCreateModal}>
              {soloRoomRecoveryIsJoin ? 'Try another room' : 'Try opening a room again'}
            </button>
          )}
        </div>
      )}

      <div className='player-lower-grid'>
        <div className='doc-panel session-panel' id='room-panel-people' role='group' aria-label='People and room controls'>
          <PanelTitle
            icon={Radio}
            title={roomId ? 'In the room' : 'Listening room'}
            meta={roomId ? (session.socketStatus === 'online' ? `${presenceCount} here` : 'Reconnecting') : 'offline'}
          />
          {roomId && mode === 'host' && <HostContributions key={roomId} />}

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
              {sessionLink && (
                <section className='room-invite-card' data-alone={hostIsAlone || undefined} aria-label='Invite people to this room'>
                  <div className='room-invite-copy'>
                    <strong>{hostIsAlone ? 'Bring someone into this track' : 'Invite another listener'}</strong>
                    <span>{hostIsAlone ? 'Share one link. They can enter without an account.' : 'The same room link stays open while you listen.'}</span>
                  </div>
                  <div className='room-invite-actions'>
                    <button className={hostIsAlone ? 'primary-action' : 'secondary-action'} type='button' onClick={onCopySessionLink}>
                      <Copy size={16} />
                      Copy invite
                    </button>
                    {canNativeShare && (
                      <button className='secondary-action' type='button' onClick={() => void session.shareSessionLink()}>
                        <Share2 size={16} />
                        Share
                      </button>
                    )}
                    <button className='secondary-action' type='button' onClick={() => setIsQrProjectorOpen(true)}>
                      <QrCode size={16} />
                      Show QR
                    </button>
                  </div>
                </section>
              )}

              <div className='listener-list'>
                <div className='list-row'>
                  <div className='room-person-main'>
                    <Avatar name={visibleHostName ?? ''} size={34} host />
                    <div>
                      <strong>
                        {visibleHostName ?? 'This listening room'}
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
                  <Avatar name={visibleHostName ?? ''} size={34} host />
                  <div>
                    <strong>
                      {visibleHostName ?? 'This listening room'}
                      <span className='room-person-tag'>host</span>
                    </strong>
                    <span data-testid='room-listener-sync'>{roomListenerSyncLabel(remoteReady, sessionStatus)}</span>
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

              {activeListeners.length > 0 && (
                <div className='listener-list'>
                  {activeListeners.map(listener => {
                    const isSelf = listener.id === ownSocketId;
                    return (
                      <div className='list-row' key={listener.id}>
                        <div className='room-person-main'>
                          <Avatar name={listener.displayName} size={34} />
                          <div>
                            <strong>
                              {listener.displayName}
                              {isSelf && <span className='room-person-tag'>you</span>}
                            </strong>
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
                    );
                  })}
                </div>
              )}

              <form
                className='room-name-form'
                onSubmit={event => {
                  event.preventDefault();
                  onUpdateDisplayName(displayName);
                }}
              >
                <label className='create-room-label' htmlFor='room-display-name'>
                  Your room name
                </label>
                <div className='room-name-row'>
                  <input
                    id='room-display-name'
                    className='field'
                    value={displayName}
                    onChange={event => onSetDisplayName(event.target.value)}
                    maxLength={32}
                    autoComplete='nickname'
                  />
                  <button className='secondary-action icon-action' type='submit' disabled={!isChosenDisplayName(displayName)} aria-label='Update room name'>
                    <Check size={16} />
                  </button>
                </div>
              </form>

              <button className='secondary-action' type='button' onClick={onLeaveSession}>
                Leave
              </button>
            </>
          )}

          {error && roomId && (
            <p className='error-box' data-testid='session-error'>
              {error}
            </p>
          )}
        </div>

        {roomId && (
          <div className='room-social-column'>
            <div id='room-panel-chat' className='room-conversation-pane' role='tabpanel' aria-labelledby='room-tab-chat' hidden={roomPanel !== 'chat'}>
              <RoomChat key={roomId} active={roomPanel === 'chat'} onUnreadChange={setChatUnread} />
            </div>
            <div
              id='room-panel-queue'
              className='room-conversation-pane room-queue-pane'
              role='tabpanel'
              aria-labelledby='room-tab-queue'
              hidden={roomPanel !== 'queue'}
            >
              <HostLineup key={roomId} />
              <RoomRequests key={roomId} />
            </div>
          </div>
        )}

        <div className='doc-panel player-context-panel'>
          <PanelTitle
            icon={Library}
            title='Current track'
            meta={isRoomGuest ? (remoteReady ? 'Room stream' : 'Waiting for host') : needsTrackAccess ? 'Locked' : 'Ready to play'}
          />
          <div className='stack-list'>
            <EndpointRow label='Artist' value={streamArtist} />
            <EndpointRow
              label='Listen'
              value={
                isRoomGuest
                  ? 'Streamed by the host'
                  : selectedTrackInactive
                    ? 'Inactive release'
                    : effectiveAccessMode === 'classic'
                      ? needsTrackAccess
                        ? `${effectivePaymentAmount} to open`
                        : 'Access verified'
                      : 'Open in this room'
              }
            />
            <EndpointRow label='Status' value={trackInfo?.hash || selectedTrack?.metadataRef ? 'In the catalog' : 'Being prepared'} />
          </div>
          <button className='secondary-action' type='button' onClick={onNavigateToListen}>
            Browse music
          </button>
        </div>
      </div>

      {qrProjectorDialog}
      {detailsTrack && !roomId && (
        <ReleaseDetailsDialog track={detailsTrack} nativePaymentSymbol={nativePaymentAsset.symbol} onClose={() => setDetailsTrack(null)} />
      )}
      {shareOpen && roomId && sessionLink && (
        <RoomShareDialog
          roomId={roomId}
          link={sessionLink}
          status={sessionStatus}
          onCopy={onCopySessionLink}
          onShare={() => void session.shareSessionLink()}
          onProject={
            mode === 'host'
              ? () => {
                  setShareOpen(false);
                  setIsQrProjectorOpen(true);
                }
              : undefined
          }
          onClose={() => setShareOpen(false)}
        />
      )}
      {queueOpen && !roomId && <PlayerQueueDialog onClose={() => setQueueOpen(false)} />}
    </section>
  );
}
