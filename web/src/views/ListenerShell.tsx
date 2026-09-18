import { useRoomViewport } from '../features/rooms/useRoomViewport';
// Listener shell - the full listener-facing render tree (top bar, nav rail,
// page views, player dock, room modals) plus the listener-only UI state and
// handlers. It is self-contained: everything it needs comes from the provider
// stack, so App.tsx renders it with no props. The artist portal is the other
// shell (see ArtistPortalView); App switches between the two.

import { Link as LinkIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { emptyCatalogJourney } from '../components/CatalogBrowser';
import { AuraBackground } from '../components/AuraBackground';
import { PersistentAudio } from '../components/PersistentAudio';
import { PlayerDock } from '../components/PlayerDock';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { JoinRoomModal } from '../components/JoinRoomModal';
import { RoomReleaseDialog } from '../components/RoomReleaseDialog';
import { TopBar } from '../components/TopBar';
import { AccountWalletModal } from '../components/AccountWalletModal';
import { TransactionModal } from '../components/TransactionModal';
import { ToastRegion } from '../components/ToastRegion';
import { BottomNav, DesktopNav } from '../components/PrimaryNav';

import { ListenView } from './ListenView';
import { PlayerView } from './PlayerView';
import { RoomsView } from './RoomsView';
import { YouView } from './YouView';
import { ArtistProfileView } from './ArtistProfileView';

import {
  useCatalogContext,
  useSessionContext,
  usePlaybackContext,
  useNavigation,
  useWalletContext,
  useUiFeedback,
  useReleaseForm,
  useArtistStudio
} from '../app/providers';
import { NAV_ITEMS } from '../app/navigation';
import { catalogTrackToTrackInfo, isTrackManagedByArtist } from '../features/catalog/trackModel';
import { getStoredDisplayName, isChosenDisplayName } from '../features/identity/walletIdentity';
import { isProductionReadinessPanelEnabled } from '../features/observability/productionReadiness';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { getInitialRoomCode } from '../features/rooms/roomState';
import { resolveRoomEntryState } from '../features/rooms/roomEntryState';
import { deriveSupportSummary } from '../features/wallet/supportSummary';
import { getStoredArtistName } from '../hooks/useArtistConsole';
import { normalizeRoomCode } from '../shared/utils/format';
import type { CatalogTrack, View } from '../shared/types';

const productHostConfig = resolveProductHostConfig(import.meta.env);
const runtimeAdapterConfig = resolveRuntimeAdapterConfig(import.meta.env);
const apiConfigured = Boolean((import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.trim());

export function ListenerShell() {
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { playback, openTrack, prepareLocalStream } = usePlaybackContext();
  const { activeView, publicArtistName, setPublicArtistName, navigateToView, openArtistStudio } = useNavigation();
  const {
    walletState,
    activeEvmAddress,
    listenerEvmAddress,
    ethRpcUrl,
    expectedChainId,
    disconnect: disconnectWallet,
    productHostMode,
    productHostStatus
  } = useWalletContext();
  const { openWalletModal } = useUiFeedback();
  const { artistName } = useReleaseForm();
  const { artistConsole, totalRoyaltyWei } = useArtistStudio();

  const catalogJourney = useRef(emptyCatalogJourney());
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [joinRoomOpen, setJoinRoomOpen] = useState(false);
  const [pendingArtistTrack, setPendingArtistTrack] = useState<CatalogTrack | null>(null);
  const promptedInitialRoomRef = useRef(false);
  const [inspectedRoomTrack, setInspectedRoomTrack] = useState<CatalogTrack | null>(null);
  const pendingSoloTrackRef = useRef<CatalogTrack | null>(null);

  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const artistTracks = catalog.allCatalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const { paidTracks, supportedArtists } = deriveSupportSummary(catalog.catalogTracks, catalog.catalogPaidAccessByTrackId);
  const roomId = session.roomId;
  const setSessionDisplayName = session.setDisplayName;
  const initialRoomCode = getInitialRoomCode();
  const targetRoomCode = initialRoomCode || normalizeRoomCode(session.joinCode);
  const thresholdRoom = session.openRooms.find(room => room.roomId === targetRoomCode);
  const thresholdState = resolveRoomEntryState({
    initialRoomCode,
    joinedRoomId: roomId,
    openRooms: session.openRooms,
    socketStatus: session.socketStatus,
    isRefreshingRooms: session.isRefreshingRooms
  });
  const isRoomGuest = session.mode === 'listener' && Boolean(roomId);
  const soloTrackHash = playback.transport.playing && !roomId ? (selectedTrack?.hash ?? null) : null;
  const showProductionReadinessPanel = isProductionReadinessPanelEnabled({ VITE_DOTIFY_DEBUG_PANEL: import.meta.env.VITE_DOTIFY_DEBUG_PANEL });
  const connectedWallet = walletState.status === 'connected' ? walletState.wallet : null;
  const nativePaymentSymbol = catalog.nativeRuntimePaymentAsset.symbol;

  useEffect(() => {
    session.setSoloListeningTrack(soloTrackHash);
    // The session facade owns reconnect replay for this ephemeral declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloTrackHash]);

  useEffect(
    () => () => {
      session.setSoloListeningTrack(null);
    },
    // Unmount cleanup only; the current declaration is updated above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // `Now` and room share links need real live metadata before the person takes
  // an action. Connecting here is read-only: it lists public room summaries and
  // never touches a wallet, key route, or protected source.
  useEffect(() => {
    // SessionProvider owns remembered-name auto-join. Let that connection win
    // on share links instead of racing it with a second discovery request
    // during React StrictMode's mount replay.
    if (getInitialRoomCode() && getStoredDisplayName(listenerEvmAddress)) return;
    session.requestOpenRooms(true);
    // The session facade owns socket lifecycle; this initial discovery should
    // run once per mounted listener shell, not whenever the facade object moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initialRoomCode = getInitialRoomCode();
    if (promptedInitialRoomRef.current || !initialRoomCode || roomId) return;
    if (getStoredDisplayName(listenerEvmAddress)) return;
    promptedInitialRoomRef.current = true;
    setSessionDisplayName('');
    setJoinRoomOpen(true);
  }, [listenerEvmAddress, roomId, setSessionDisplayName]);

  const handlePlayTrack = useCallback(
    (track: CatalogTrack) => {
      // Resume an already loaded source without reselecting (which pauses it).
      // New sources continue through the catalog's authoritative access check.
      if (session.mode !== 'listener' && track.id === catalog.selectedTrackId && catalog.audioSource && !catalog.accessGate) {
        setPublicArtistName(null);
        navigateToView('player');
        if (!playback.transport.playing) void playback.togglePlay();
        return;
      }
      openTrack(track);
    },
    [session.mode, catalog, playback, setPublicArtistName, navigateToView, openTrack]
  );

  function handleInspectTrack(track: CatalogTrack) {
    if (isRoomGuest) setInspectedRoomTrack(track);
    else openTrack(track);
  }

  useEffect(() => {
    if (!isRoomGuest) setInspectedRoomTrack(null);
  }, [isRoomGuest]);

  // Wait for room cleanup to restore local transport before consuming an
  // explicit leave-and-open choice. Browsing alone never selects a source.
  useEffect(() => {
    const pendingTrack = pendingSoloTrackRef.current;
    if (!pendingTrack || roomId || session.mode !== 'host') return;
    // Consume before catalog/navigation updates can trigger another render.
    pendingSoloTrackRef.current = null;
    handlePlayTrack(pendingTrack);
  }, [roomId, session.mode, handlePlayTrack]);

  function handleOpenArtistProfile(name: string) {
    setPublicArtistName(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Opens the room after the user has confirmed their display name in the modal.
  // Access model v2: rooms always carry the full track; a host who cannot play
  // the chosen track opens the room without a stream and sees the access gate.
  async function executeArtistRoom(track: CatalogTrack) {
    const trackInfo = catalogTrackToTrackInfo(track);
    const isCurrentReadyTrack = track.id === catalog.selectedTrackId && Boolean(catalog.audioSource);
    if (isCurrentReadyTrack) {
      if (!playback.transport.playing) void playback.togglePlay();
      prepareLocalStream();
      session.createSession(trackInfo, 'full', undefined, { audioSourceHint: catalog.audioSource });
      return;
    }

    const selection = await catalog.openTrack(track, undefined, undefined, undefined, true).catch(() => null);
    session.createSession(trackInfo, 'full', undefined, { audioSourceHint: selection?.audioSource ?? null });
  }

  // Entry point from artist profile / room cards - opens CreateRoomModal so the
  // host can set their display name before the room is created.
  function handleOpenArtistRoom(track: CatalogTrack) {
    setPublicArtistName(null);
    setPendingArtistTrack(track);
    setCreateRoomOpen(true);
  }

  function handleJoinRoomFromProfile(roomId: string) {
    setPublicArtistName(null);
    handleJoinRoomRequest(roomId);
  }

  function handleJoinRoomRequest(roomId: string) {
    if (roomId === session.roomId) {
      navigateToView('player');
      return;
    }
    session.setJoinCode(roomId);
    if (isChosenDisplayName(session.displayName)) {
      session.joinRoom(roomId);
      return;
    }

    session.setDisplayName('');
    setJoinRoomOpen(true);
  }

  function handleJoinSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleJoinRoomRequest(session.joinCode);
  }

  // Shared navigation model: rendered as a bottom tab bar on mobile and a
  // collapsible left rail on desktop.
  function handleNavSelect(view: View) {
    navigateToView(view);
    if (view === 'rooms') session.requestOpenRooms(true);
  }
  const navItems = NAV_ITEMS.map(item => ({ ...item, onSelect: () => handleNavSelect(item.view) }));
  const roomFocused = activeView === 'player' && Boolean(session.roomId) && !publicArtistName;
  const roomShellRef = useRoomViewport(roomFocused);

  return (
    <>
      <PersistentAudio
        audioSource={catalog.audioSource}
        localAudioRef={catalog.localAudioRef}
        remoteAudioRef={session.remoteAudioRef}
        playback={playback}
        onPrepareLocalStream={prepareLocalStream}
        onEmitPlayerState={session.emitPlayerState}
      />
      <AuraBackground />
      <div className='app-shell' ref={roomShellRef} data-room-focus={roomFocused}>
        <a className='skip-link' href='#main-content'>
          Skip to content
        </a>
        <TopBar brandHref='#main-content' brandAriaLabel='Dotify home' onBrandClick={() => handleNavSelect('listen')} navAriaLabel='Primary navigation'>
          <DesktopNav items={navItems} activeView={activeView} />
        </TopBar>

        {inspectedRoomTrack && isRoomGuest && (
          <RoomReleaseDialog
            track={inspectedRoomTrack}
            hostName={session.hostName}
            nativePaymentSymbol={nativePaymentSymbol}
            onClose={() => setInspectedRoomTrack(null)}
            onLeaveAndOpen={() => {
              pendingSoloTrackRef.current = inspectedRoomTrack;
              setInspectedRoomTrack(null);
              session.leaveSession();
            }}
          />
        )}
        <AccountWalletModal />

        <div className='app-content'>
          <main className={`content content-${activeView}`} id='main-content'>
            {publicArtistName ? (
              <ArtistProfileView
                socketStatus={session.socketStatus}
                artistName={publicArtistName}
                catalogTracks={catalog.catalogTracks}
                openRooms={session.openRooms}
                catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                nativePaymentSymbol={nativePaymentSymbol}
                onBack={() => setPublicArtistName(null)}
                onOpenTrack={handleInspectTrack}
                onPlayTrack={handlePlayTrack}
                roomGuest={isRoomGuest}
                onOpenArtistRoom={handleOpenArtistRoom}
                onJoinRoom={handleJoinRoomFromProfile}
              />
            ) : (
              <>
                {activeView === 'listen' && (
                  <ListenView
                    catalogTracks={catalog.catalogTracks}
                    catalogStatus={catalog.catalogStatus}
                    openRooms={session.openRooms}
                    journey={catalogJourney}
                    selectedTrackId={catalog.trackInfo ? catalog.selectedTrackId : ''}
                    catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                    nativePaymentSymbol={nativePaymentSymbol}
                    onOpenTrack={handleInspectTrack}
                    onPlayTrack={handlePlayTrack}
                    roomGuest={isRoomGuest}
                    onOpenArtist={handleOpenArtistProfile}
                    onJoinRoom={handleJoinRoomRequest}
                    onStartRoom={track => {
                      setPendingArtistTrack(track ?? null);
                      setCreateRoomOpen(true);
                    }}
                  />
                )}

                {activeView === 'player' && <PlayerView onShowCreateModal={() => setCreateRoomOpen(true)} onShowJoinModal={() => setJoinRoomOpen(true)} />}

                {activeView === 'rooms' && (
                  <RoomsView
                    openRooms={session.openRooms}
                    joinCode={session.joinCode}
                    sessionAction={session.sessionAction}
                    socketStatus={session.socketStatus}
                    isRefreshingRooms={session.isRefreshingRooms}
                    onSetJoinCode={session.setJoinCode}
                    onJoinRoom={handleJoinRoomRequest}
                    onJoinSession={handleJoinSession}
                    onRefreshRooms={() => session.requestOpenRooms(true)}
                    onStartRoom={() => setCreateRoomOpen(true)}
                  />
                )}

                {activeView === 'you' && (
                  <YouView
                    walletState={walletState}
                    artistName={artistName || getStoredArtistName(activeEvmAddress) || 'Your artist space'}
                    artistRuntimeAddress={artistConsole.artistRuntimeAddress}
                    artistReleaseCount={artistTracks.length}
                    totalRoyaltyWei={totalRoyaltyWei}
                    unlockedTrackCount={paidTracks.length}
                    supportedArtistCount={supportedArtists.length}
                    supportedArtists={supportedArtists}
                    nativePaymentSymbol={nativePaymentSymbol}
                    unlockedTracks={paidTracks.map(track => ({
                      id: track.id,
                      title: track.title,
                      artist: track.artist
                    }))}
                    productionReadiness={
                      showProductionReadinessPanel
                        ? {
                            catalogTracks: catalog.catalogTracks,
                            catalogStatus: catalog.catalogStatus,
                            ethRpcUrl,
                            expectedChainId,
                            walletChainId: connectedWallet?.chainId,
                            productCdmHostSmoke: {
                              buildSha: (import.meta.env.VITE_DOTIFY_BUILD_SHA as string | undefined) ?? null,
                              productAppVersion: (import.meta.env.VITE_DOTIFY_PRODUCT_APP_VERSION as string | undefined) ?? null,
                              deployedCid: null,
                              productId: productHostConfig.productId,
                              publicAppUrl: (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? null,
                              cdmRegistry: (import.meta.env.VITE_DOTIFY_CDM_REGISTRY as string | undefined) ?? null,
                              productHostMode,
                              productHostStatus,
                              runtimeAdapterKind: runtimeAdapterConfig.kind,
                              walletMethod: connectedWallet?.method ?? null,
                              listenerAddress: listenerEvmAddress,
                              substrateAddress: connectedWallet?.substrateAddress ?? null,
                              productPublicKey:
                                connectedWallet?.keyRequestSigner && 'productPublicKey' in connectedWallet.keyRequestSigner
                                  ? connectedWallet.keyRequestSigner.productPublicKey
                                  : null,
                              expectedChainId,
                              apiConfigured
                            }
                          }
                        : null
                    }
                    onOpenArtistStudio={openArtistStudio}
                    onShowWalletModal={() => openWalletModal('account')}
                    onDisconnectWallet={disconnectWallet}
                  />
                )}
              </>
            )}

            {session.sessionLink && (
              <button hidden={roomFocused} className='floating-link' type='button' aria-label='Return to your room' onClick={() => navigateToView('player')}>
                <LinkIcon size={15} />
                {session.roomId}
              </button>
            )}

            <TransactionModal />
            <ToastRegion />
          </main>
        </div>

        {(activeView !== 'player' || publicArtistName) && (catalog.trackInfo || session.roomId) && (
          <PlayerDock
            track={selectedTrack}
            trackInfo={catalog.trackInfo}
            playback={playback}
            mode={session.mode}
            roomId={session.roomId}
            locked={Boolean(
              !isRoomGuest && selectedTrack && selectedTrack.accessMode === 'classic' && catalog.catalogAccessByTrackId[selectedTrack.id] !== true
            )}
            audioStartupStatus={catalog.audioStartupStatus}
            onOpenPlayer={() => navigateToView('player')}
            onOpenArtist={handleOpenArtistProfile}
            onStartRoom={() => setCreateRoomOpen(true)}
          />
        )}

        {createRoomOpen && (
          <CreateRoomModal
            tracks={catalog.catalogTracks}
            initialTrack={pendingArtistTrack ?? selectedTrack ?? catalog.catalogTracks[0]}
            displayName={session.displayName}
            onSetDisplayName={session.setDisplayName}
            onClose={() => {
              setCreateRoomOpen(false);
              setPendingArtistTrack(null);
            }}
            onOpenRoom={track => {
              setCreateRoomOpen(false);
              setPendingArtistTrack(null);
              void executeArtistRoom(track);
            }}
          />
        )}

        {joinRoomOpen && (
          <JoinRoomModal
            displayName={session.displayName}
            joinCode={session.joinCode}
            room={thresholdRoom}
            thresholdState={thresholdState}
            sessionAction={session.sessionAction}
            onSetDisplayName={session.setDisplayName}
            onSetJoinCode={session.setJoinCode}
            onJoin={code => {
              setJoinRoomOpen(false);
              session.joinRoom(code);
            }}
            onRetry={() => session.requestOpenRooms(true)}
            onClose={() => setJoinRoomOpen(false)}
          />
        )}

        <BottomNav items={navItems} activeView={activeView} />
      </div>
    </>
  );
}
