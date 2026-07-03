// Listener shell - the full listener-facing render tree (top bar, nav rail,
// page views, player dock, room modals) plus the listener-only UI state and
// handlers. It is self-contained: everything it needs comes from the provider
// stack, so App.tsx renders it with no props. The artist portal is the other
// shell (see ArtistPortalView); App switches between the two.

import { Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

import { AuraBackground } from '../components/AuraBackground';
import { PersistentAudio } from '../components/PersistentAudio';
import { PlayerDock } from '../components/PlayerDock';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { JoinRoomModal } from '../components/JoinRoomModal';
import { TopBar } from '../components/TopBar';
import { AccountWalletModal } from '../components/AccountWalletModal';
import { TransactionModal } from '../components/TransactionModal';
import { BottomNav, SideRail } from '../components/PrimaryNav';
import { Metric } from '../shared/ui/Metric';

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
import { NAV_ITEMS, VIEW_COPY } from '../app/navigation';
import { catalogTrackToTrackInfo, isTrackManagedByArtist } from '../features/catalog/trackModel';
import { deriveSupportSummary } from '../features/wallet/supportSummary';
import { getStoredArtistName } from '../hooks/useArtistConsole';
import type { CatalogTrack, RoomPlaybackMode, View } from '../shared/types';

const DEFAULT_ARTIST_NAME = 'Dotify Artist';

export function ListenerShell() {
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { playback, openTrack, prepareLocalStream, enforcePreviewCutoff } = usePlaybackContext();
  const { activeView, publicArtistName, setPublicArtistName, railCollapsed, setRailCollapsed, navigateToView, openArtistStudio } = useNavigation();
  const { walletState, activeEvmAddress, disconnect: disconnectWallet } = useWalletContext();
  const { setShowWalletModal } = useUiFeedback();
  const { artistName } = useReleaseForm();
  const { artistConsole, totalRoyaltyWei } = useArtistStudio();

  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [joinRoomOpen, setJoinRoomOpen] = useState(false);
  const [pendingArtistTrack, setPendingArtistTrack] = useState<CatalogTrack | null>(null);

  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const artistTracks = catalog.catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const activeListeners = session.listeners.filter(listener => listener.status === 'connected').length;
  const currentPage = VIEW_COPY[activeView];
  const { paidTracks, supportedArtists } = deriveSupportSummary(catalog.catalogTracks, catalog.catalogPaidAccessByTrackId);

  function handleOpenArtistProfile(name: string) {
    setPublicArtistName(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Opens the room after the user has confirmed their display name in the modal.
  async function executeArtistRoom(track: CatalogTrack) {
    const playbackMode = await catalog.openTrack(track).catch((): RoomPlaybackMode => {
      catalog.previewOnlyRef.current = true;
      return 'preview';
    });
    session.createSession(catalogTrackToTrackInfo(track), playbackMode);
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
    session.joinRoom(roomId);
  }

  // Shared navigation model: rendered as a bottom tab bar on mobile and a
  // collapsible left rail on desktop.
  function handleNavSelect(view: View) {
    navigateToView(view);
    if (view === 'rooms') session.requestOpenRooms(true);
  }
  const navItems = NAV_ITEMS.map(item => ({ ...item, onSelect: () => handleNavSelect(item.view) }));

  return (
    <>
      <AuraBackground />
      <PersistentAudio
        audioSource={catalog.audioSource}
        localAudioRef={catalog.localAudioRef}
        remoteAudioRef={session.remoteAudioRef}
        playback={playback}
        onPrepareLocalStream={prepareLocalStream}
        onSetupPreviewLimit={catalog.setupPreviewLimit}
        onEnforcePreviewCutoff={enforcePreviewCutoff}
        onEmitPlayerState={session.emitPlayerState}
      />
      <div className='app-shell'>
        <TopBar brandHref='#top' brandAriaLabel='Dotify' onBrandClick={() => setPublicArtistName(null)} navAriaLabel='Navigation' />

        <AccountWalletModal />

        <SideRail items={navItems} activeView={activeView} collapsed={railCollapsed} onToggleCollapsed={() => setRailCollapsed(value => !value)} />

        <div className='app-content' id='top'>
          <main className={`content content-${activeView}`}>
            {publicArtistName ? (
              <ArtistProfileView
                artistName={publicArtistName}
                catalogTracks={catalog.catalogTracks}
                openRooms={session.openRooms}
                catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                onBack={() => setPublicArtistName(null)}
                onOpenTrack={openTrack}
                onOpenArtistRoom={handleOpenArtistRoom}
                onJoinRoom={handleJoinRoomFromProfile}
              />
            ) : (
              <>
                <section className='page-head'>
                  <div className='page-copy'>
                    <p className='eyebrow'>{currentPage.eyebrow}</p>
                    <h1>{currentPage.title}</h1>
                  </div>
                  <div className='head-metrics'>
                    <Metric label='tracks' value={catalog.catalogTracks.length.toString()} />
                    <Metric label='rooms' value={session.openRooms.length.toString()} />
                    <Metric label='listeners' value={`${activeListeners}/${session.listenerCount}`} />
                  </div>
                </section>

                {activeView === 'listen' && (
                  <ListenView
                    catalogTracks={catalog.catalogTracks}
                    catalogStatus={catalog.catalogStatus}
                    openRooms={session.openRooms}
                    selectedTrackId={catalog.selectedTrackId}
                    catalogAccessByTrackId={catalog.catalogAccessByTrackId}
                    onOpenTrack={openTrack}
                    onOpenArtist={handleOpenArtistProfile}
                    onJoinRoom={session.joinRoom}
                    onStartRoom={() => setCreateRoomOpen(true)}
                  />
                )}

                {activeView === 'player' && <PlayerView onShowCreateModal={() => setCreateRoomOpen(true)} onShowJoinModal={() => setJoinRoomOpen(true)} />}

                {activeView === 'rooms' && (
                  <RoomsView
                    openRooms={session.openRooms}
                    joinCode={session.joinCode}
                    sessionAction={session.sessionAction}
                    isRefreshingRooms={session.isRefreshingRooms}
                    onSetJoinCode={session.setJoinCode}
                    onJoinRoom={session.joinRoom}
                    onJoinSession={session.joinSession}
                    onRefreshRooms={() => session.requestOpenRooms(true)}
                    onStartRoom={() => setCreateRoomOpen(true)}
                  />
                )}

                {activeView === 'you' && (
                  <YouView
                    walletState={walletState}
                    artistName={artistName || getStoredArtistName(activeEvmAddress) || DEFAULT_ARTIST_NAME}
                    artistRuntimeAddress={artistConsole.artistRuntimeAddress}
                    artistReleaseCount={artistTracks.length}
                    totalRoyaltyWei={totalRoyaltyWei}
                    unlockedTrackCount={paidTracks.length}
                    supportedArtistCount={supportedArtists.length}
                    supportedArtists={supportedArtists}
                    unlockedTracks={paidTracks.map(track => ({
                      id: track.id,
                      title: track.title,
                      artist: track.artist,
                      priceDot: track.priceDot,
                      hash: track.hash
                    }))}
                    onOpenArtistStudio={openArtistStudio}
                    onShowWalletModal={() => setShowWalletModal(true)}
                    onDisconnectWallet={disconnectWallet}
                  />
                )}
              </>
            )}

            {session.sessionLink && (
              <a className='floating-link' href={session.sessionLink}>
                <LinkIcon size={15} />
                {session.roomId}
              </a>
            )}

            <TransactionModal />
          </main>
        </div>

        {activeView !== 'player' && !publicArtistName && (selectedTrack || catalog.trackInfo || session.roomId) && (
          <PlayerDock
            track={selectedTrack}
            trackInfo={catalog.trackInfo}
            playback={playback}
            mode={session.mode}
            roomId={session.roomId}
            locked={Boolean(selectedTrack && selectedTrack.accessMode === 'classic' && catalog.catalogAccessByTrackId[selectedTrack.id] !== true)}
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
            sessionAction={session.sessionAction}
            onSetDisplayName={session.setDisplayName}
            onSetJoinCode={session.setJoinCode}
            onJoin={code => {
              setJoinRoomOpen(false);
              session.joinRoom(code);
            }}
            onClose={() => setJoinRoomOpen(false)}
          />
        )}

        <BottomNav items={navItems} activeView={activeView} />
      </div>
    </>
  );
}
