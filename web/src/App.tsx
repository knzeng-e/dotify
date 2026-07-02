import { Link as LinkIcon } from 'lucide-react';

import { AuraBackground } from './components/AuraBackground';
import { PlayerDock } from './components/PlayerDock';
import { PersistentAudio } from './components/PersistentAudio';
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { applyAura, auraForTrack, auraForName } from './utils/aura';

import { hashFileWithBytes } from './utils/hash';
import { deployments } from './config/deployments';
import { useEffect, useState, type ChangeEvent } from 'react';
import { destroyBulletinClient } from './hooks/useBulletin';
import { uploadFileToPinata, uploadProtectedAudio } from './services/pinata';
import {
  useWalletContext,
  useUiFeedback,
  useNavigation,
  useReleaseForm,
  useCatalogContext,
  useSessionContext,
  useArtistStudio,
  usePlaybackContext
} from './app/providers';

import { Metric } from './components/ui/Metric';
import { WalletModal } from './components/WalletModal';
import { TopBar } from './components/TopBar';
import { TransactionModal } from './components/TransactionModal';

import { trackHasAccess } from './features/access/accessPolicy';
import { catalogTrackToTrackInfo, isTrackManagedByArtist } from './features/catalog/trackModel';
import { buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage } from './features/uploads/uploadModel';
import {
  artistSetupState as deriveArtistSetupState,
  artistStudioLocked as deriveArtistStudioLocked,
  canReviewRelease as deriveCanReviewRelease,
  nextReleaseStep,
  previousReleaseStep
} from './features/artist-studio/releaseForm';
import { NAV_ITEMS, VIEW_COPY } from './app/navigation';
import { BottomNav, SideRail } from './components/PrimaryNav';
import { getStoredArtistName } from './hooks/useArtistConsole';

import { ListenView } from './views/ListenView';
import { PlayerView } from './views/PlayerView';
import { RoomsView } from './views/RoomsView';
import { YouView } from './views/YouView';
import { ArtistProfileView } from './views/ArtistProfileView';
import { ArtistPortalView } from './views/ArtistPortalView';
import { ArtistConsole } from './views/artist/ArtistConsole';
import { ArtistOnboarding } from './views/artist/ArtistOnboarding';

import type { CatalogTrack, RoomPlaybackMode, View } from './types';

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Modal + wizard state ──────────────────────────────────────────────────────
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [joinRoomOpen, setJoinRoomOpen] = useState(false);
  const [pendingArtistTrack, setPendingArtistTrack] = useState<CatalogTrack | null>(null);

  // ── Release form + identity (provider-owned) ─────────────────────────────────
  // The release draft and shared identity fields live in ReleaseFormProvider;
  // App reads what the views and its remaining handlers/effects need.
  const {
    title,
    setTitle,
    description,
    setDescription,
    artistName,
    setArtistName,
    priceDot,
    setPriceDot,
    royaltyBps,
    setRoyaltyBps,
    accessMode,
    setAccessMode,
    personhoodLevel,
    setPersonhoodLevel,
    setCoverFile,
    uploadToBulletinEnabled,
    setUploadToBulletinEnabled,
    assetAction,
    setAssetAction,
    artistTab,
    setArtistTab,
    releaseStep,
    setReleaseStep
  } = useReleaseForm();

  // ── Wallet + UI feedback (provider-owned) ─────────────────────────────────────
  // Wallet identity and the transaction/wallet-modal state live in the provider
  // stack (see app/providers). App reads only what its views and effects need.
  const { setShowWalletModal } = useUiFeedback();
  const {
    walletState,
    connectedWallet,
    activeEvmAddress,
    activeSubstrateAddress,
    ethRpcUrl,
    bulletinAccountIndex,
    setBulletinAccountIndex,
    disconnect: disconnectWallet
  } = useWalletContext();
  const activeArtistDefaultName = 'Dotify Artist';

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  // ── Navigation (provider-owned) ───────────────────────────────────────────────
  // Route/view state and history integration now live in NavigationProvider.
  const { activeView, isArtistPortal, publicArtistName, setPublicArtistName, railCollapsed, setRailCollapsed, navigateToView, openArtistStudio } =
    useNavigation();

  // ── Catalog + session (provider-owned) ────────────────────────────────────────
  // useCatalog and useSession now live in CatalogProvider/SessionProvider, which
  // do the wiring App used to do. App reads their values here.
  const catalog = useCatalogContext();
  const session = useSessionContext();

  // ── Artist studio + playback (provider-owned) ─────────────────────────────────
  // useArtistConsole and usePlayback now live in ArtistStudioProvider/
  // PlaybackProvider, which also owns the royalty summary and the open-track /
  // prepare-stream / preview-cutoff handlers. App reads their values here.
  const { artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks } = useArtistStudio();
  const { playback, openTrack, prepareLocalStream, enforcePreviewCutoff } = usePlaybackContext();

  // ── Derived values ────────────────────────────────────────────────────────────
  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const selectedTrackHasAccess = selectedTrack ? trackHasAccess(selectedTrack, catalog.catalogAccessByTrackId) : false;
  const artistTracks = catalog.catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const streamTitle = catalog.trackInfo?.title || selectedTrack?.title || title;
  const streamArtist = catalog.trackInfo?.artist || selectedTrack?.artist || artistName;
  const activeListeners = session.listeners.filter(listener => listener.status === 'connected').length;
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const hasArtistRuntime = Boolean(artistConsole.artistRuntimeAddress);
  const artistStudioLocked = deriveArtistStudioLocked(artistRegistrationAvailable, hasArtistRuntime);
  const canReviewRelease = deriveCanReviewRelease({ fileHash: catalog.fileHash, title, audioSource: catalog.audioSource });
  const artistSetupState = deriveArtistSetupState(Boolean(connectedWallet), hasArtistRuntime);
  const currentPage = VIEW_COPY[activeView];

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      session.destroySession();
      catalog.clearObjectUrls();
      destroyBulletinClient();
    };
  }, []);

  // Locked Living Light direction: aurora ambient + lights-down listening.
  useEffect(() => {
    document.body.classList.add('ambient-aurora', 'lights-down');
    return () => document.body.classList.remove('ambient-aurora', 'lights-down');
  }, []);

  // Aura engine: paint the whole field with the active track (or artist) light.
  useEffect(() => {
    if (publicArtistName) {
      applyAura(auraForName(publicArtistName));
      return;
    }
    const activeTrack = catalog.trackInfo ?? catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId) ?? null;
    applyAura(auraForTrack(activeTrack));
  }, [publicArtistName, catalog.trackInfo, catalog.selectedTrackId, catalog.catalogTracks]);

  useEffect(() => {
    if (!isArtistPortal || artistTab !== 'royalties') return;
    void artistConsole.refreshArtistRoyalties();
  }, [activeView, isArtistPortal, artistTab, artistConsole.artistRuntimeAddress, ethRpcUrl, catalog.catalogTracks.length, activeEvmAddress, artistName]);

  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) {
      setArtistName(storedName);
      return;
    }
    setArtistName(previous => (previous.trim() && previous !== 'Dotify Artist' ? previous : activeArtistDefaultName));
  }, [activeArtistDefaultName, activeEvmAddress, setArtistName]);

  useEffect(() => {
    if (!isArtistPortal) return;
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) setArtistName(storedName);
  }, [activeView, isArtistPortal, activeEvmAddress, setArtistName]);

  useEffect(() => {
    void artistConsole.refreshArtistRuntime();
  }, [activeEvmAddress, directoryAddress, ethRpcUrl]);

  // ── File handlers ─────────────────────────────────────────────────────────────
  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAssetAction('audio');
    artistConsole.setRightsStatus(uploadStatusMessage('audio', 'preparing'));
    catalog.setAudioCID('');
    catalog.audioUploadRef.current = null;

    try {
      const result = await hashFileWithBytes(file);
      const nextTitle = nextTitleFromUpload(title, file.name);
      const nextUrl = URL.createObjectURL(file);
      catalog.objectUrlsRef.current.add(nextUrl);

      catalog.setAudioSource(nextUrl);
      catalog.setFileHash(result.hash);
      setTitle(nextTitle);
      catalog.setSelectedTrackId('draft-upload');
      artistConsole.setRightsStatus(uploadStatusMessage('audio', 'uploading'));

      const trackInfoObj = buildDraftTrackInfo({
        title: nextTitle,
        artist: artistName,
        hash: result.hash,
        imageRef: catalog.coverSource,
        description,
        accessMode,
        priceDot,
        personhoodLevel
      });
      catalog.setTrackInfo(trackInfoObj);
      session.socketEmit('room:track', trackInfoObj);

      // Production: raw audio goes to the backend, which encrypts server-side
      // with the master-secret-derived key. Demo: browser-side encryption.
      const uploadPromise = uploadProtectedAudio({ bytes: result.bytes, name: file.name, mime: file.type }, result.hash)
        .then(cid => {
          catalog.setAudioCID(cid);
          artistConsole.setRightsStatus(uploadStatusMessage('audio', 'uploaded'));
          return cid;
        })
        .catch(() => {
          artistConsole.setRightsStatus(uploadStatusMessage('audio', 'failed'));
          return '';
        });
      catalog.audioUploadRef.current = uploadPromise;
    } catch (audioError) {
      artistConsole.setRightsStatus(audioError instanceof Error ? audioError.message : 'Audio preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAssetAction('cover');
    artistConsole.setRightsStatus(uploadStatusMessage('cover', 'preparing'));
    catalog.setCoverCID('');
    catalog.coverUploadRef.current = null;

    try {
      const nextUrl = URL.createObjectURL(file);
      catalog.objectUrlsRef.current.add(nextUrl);
      catalog.setCoverSource(nextUrl);
      setCoverFile(file);
      artistConsole.setRightsStatus(uploadStatusMessage('cover', 'uploading'));

      const uploadPromise = uploadFileToPinata(file, file.name, { app: 'dotify', type: 'cover' })
        .then(cid => {
          catalog.setCoverCID(cid);
          artistConsole.setRightsStatus(uploadStatusMessage('cover', 'uploaded'));
          return cid;
        })
        .catch(() => {
          artistConsole.setRightsStatus(uploadStatusMessage('cover', 'failed'));
          return '';
        });
      catalog.coverUploadRef.current = uploadPromise;
    } catch (coverError) {
      artistConsole.setRightsStatus(coverError instanceof Error ? coverError.message : 'Cover preparation failed');
    } finally {
      setAssetAction('idle');
      event.target.value = '';
    }
  }

  // ── Step navigation ───────────────────────────────────────────────────────────
  function goToPreviousReleaseStep() {
    setReleaseStep(previousReleaseStep(releaseStep));
  }

  function goToNextReleaseStep() {
    setReleaseStep(nextReleaseStep(releaseStep));
  }

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

  // Entry point from artist profile / room cards — opens CreateRoomModal so the
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

  // ── Render ────────────────────────────────────────────────────────────────────
  const paidTrackIds = Object.entries(catalog.catalogPaidAccessByTrackId)
    .filter(([, granted]) => granted)
    .map(([id]) => id);
  const paidTracks = paidTrackIds.map(id => catalog.catalogTracks.find(track => track.id === id)).filter((track): track is CatalogTrack => Boolean(track));
  const supportedArtists = Array.from(
    paidTracks
      .reduce((artistsByKey, track) => {
        const key = track.artistAddress?.toLowerCase() ?? track.artist.toLowerCase();
        const existing = artistsByKey.get(key);
        artistsByKey.set(key, {
          artist: track.artist,
          artistAddress: track.artistAddress,
          trackCount: (existing?.trackCount ?? 0) + 1
        });
        return artistsByKey;
      }, new Map<string, { artist: string; artistAddress?: `0x${string}`; trackCount: number }>())
      .values()
  );

  // Connection state, actions, and visibility come from context; App supplies
  // only the catalog-derived support summary and the account-details nav jump.
  // Both modals self-gate on their provider state, so they render unconditionally.
  const walletModal = (
    <WalletModal
      supportingCount={supportedArtists.length}
      unlockedCount={paidTracks.length}
      supportedArtists={supportedArtists}
      paidTracks={paidTracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artistAddress: track.artistAddress,
        priceDot: track.priceDot,
        hash: track.hash
      }))}
      onOpenAccountDetails={() => {
        setShowWalletModal(false);
        navigateToView('you');
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            document.getElementById('account-dashboard-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          });
        });
      }}
    />
  );

  const transactionModal = <TransactionModal />;

  // Shared navigation model: rendered as a bottom tab bar on mobile and a
  // collapsible left rail on desktop. Static entries live in app/navigation;
  // the handler is attached here since it closes over navigation + session.
  function handleNavSelect(view: View) {
    navigateToView(view);
    if (view === 'rooms') session.requestOpenRooms(true);
  }
  const navItems = NAV_ITEMS.map(item => ({ ...item, onSelect: () => handleNavSelect(item.view) }));

  if (isArtistPortal) {
    return (
      <ArtistPortalView walletModal={walletModal} transactionModal={transactionModal}>
        {connectedWallet && artistConsole.artistRuntimeAddress ? (
          <ArtistConsole
            artistTab={artistTab}
            onSetArtistTab={setArtistTab}
            artistName={artistName}
            activeEvmAddress={activeEvmAddress}
            artistRuntimeAddress={artistConsole.artistRuntimeAddress}
            artistRegistrationStatus={artistConsole.artistRegistrationStatus}
            isRegisteringArtist={artistConsole.isRegisteringArtist}
            isRefreshingArtistRuntime={artistConsole.isRefreshingArtistRuntime}
            artistRegistrationAvailable={artistRegistrationAvailable}
            artistSetupState={artistSetupState}
            artistTracks={artistTracks}
            connectedWallet={connectedWallet}
            onUpdateArtistName={name => artistConsole.updateArtistName(name, setArtistName)}
            onRegisterArtist={artistConsole.registerArtist}
            onRefreshArtistRuntime={() => {
              void artistConsole.refreshArtistRuntime(true);
            }}
            onShowWalletModal={() => setShowWalletModal(true)}
            releaseStep={releaseStep}
            artistStudioLocked={artistStudioLocked}
            assetAction={assetAction}
            audioSource={catalog.audioSource}
            fileHash={catalog.fileHash}
            coverSource={catalog.coverSource}
            coverCID={catalog.coverCID}
            title={title}
            description={description}
            accessMode={accessMode}
            personhoodLevel={personhoodLevel}
            priceDot={priceDot}
            royaltyBps={royaltyBps}
            uploadToBulletinEnabled={uploadToBulletinEnabled}
            rightsStatus={artistConsole.rightsStatus}
            isRegistering={artistConsole.isRegistering}
            canReviewRelease={canReviewRelease}
            activeSubstrateAddress={activeSubstrateAddress}
            bulletinAccountIndex={bulletinAccountIndex}
            onSetReleaseStep={setReleaseStep}
            onGoToPreviousStep={goToPreviousReleaseStep}
            onGoToNextStep={goToNextReleaseStep}
            onHandleAudioFile={handleAudioFile}
            onHandleCoverFile={handleCoverFile}
            onSetTitle={setTitle}
            onSetDescription={setDescription}
            onSetAccessMode={setAccessMode}
            onSetPersonhoodLevel={setPersonhoodLevel}
            onSetPriceDot={setPriceDot}
            onSetRoyaltyBps={setRoyaltyBps}
            onSetUploadToBulletinEnabled={setUploadToBulletinEnabled}
            onSetBulletinAccountIndex={setBulletinAccountIndex}
            onRegisterRights={artistConsole.registerRights}
            onOpenTrack={openTrack}
            royaltyPayments={artistConsole.royaltyPayments}
            royaltyStatus={artistConsole.royaltyStatus}
            isRefreshingRoyalties={artistConsole.isRefreshingRoyalties}
            expandedRoyaltyPaymentId={artistConsole.expandedRoyaltyPaymentId}
            totalRoyaltyWei={totalRoyaltyWei}
            uniqueRoyaltyListeners={uniqueRoyaltyListeners}
            paidRoyaltyTracks={paidRoyaltyTracks}
            onSetExpandedRoyaltyPaymentId={artistConsole.setExpandedRoyaltyPaymentId}
            onRefreshRoyalties={() => {
              void artistConsole.refreshArtistRoyalties(true);
            }}
            factoryAddress={factoryAddress}
            directoryAddress={directoryAddress}
            audioCID={catalog.audioCID}
            bulletinManifestRef={artistConsole.bulletinManifestRef}
            trackInfo={catalog.trackInfo}
          />
        ) : (
          <ArtistOnboarding
            activeEvmAddress={activeEvmAddress}
            artistName={artistName}
            artistRegistrationStatus={artistConsole.artistRegistrationStatus}
            isRegisteringArtist={artistConsole.isRegisteringArtist}
            isRefreshingArtistRuntime={artistConsole.isRefreshingArtistRuntime}
            artistRegistrationAvailable={artistRegistrationAvailable}
            connectedWallet={connectedWallet}
            onUpdateArtistName={name => artistConsole.updateArtistName(name, setArtistName)}
            onRegisterArtist={artistConsole.registerArtist}
            onRefreshArtistRuntime={() => {
              void artistConsole.refreshArtistRuntime(true);
            }}
            onShowWalletModal={() => setShowWalletModal(true)}
            artistTracks={connectedWallet ? artistTracks : []}
          />
        )}
      </ArtistPortalView>
    );
  }

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

        {walletModal}

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

                {activeView === 'player' && (
                  <PlayerView
                    trackInfo={catalog.trackInfo}
                    selectedTrack={selectedTrack}
                    coverSource={catalog.coverSource}
                    accessGate={catalog.accessGate}
                    playback={playback}
                    mode={session.mode}
                    hostName={session.hostName}
                    roomId={session.roomId}
                    sessionLink={session.sessionLink}
                    sessionAction={session.sessionAction}
                    sessionStatus={session.sessionStatus}
                    listenerCount={session.listenerCount}
                    listeners={session.listeners}
                    remoteReady={session.remoteReady}
                    localStreamReady={session.localStreamReady}
                    roomPlaybackMode={session.roomPlaybackMode}
                    error={session.error}
                    streamTitle={streamTitle}
                    streamArtist={streamArtist}
                    selectedTrackHasAccess={selectedTrackHasAccess}
                    accessMode={accessMode}
                    priceDot={priceDot}
                    onShowCreateModal={() => setCreateRoomOpen(true)}
                    onShowJoinModal={() => setJoinRoomOpen(true)}
                    onLeaveSession={session.leaveSession}
                    onRetryRoomAudio={session.requestRoomAudio}
                    onCopySessionLink={session.copySessionLink}
                    onSetAccessGate={catalog.setAccessGate}
                    onPayForTrackAccess={track => {
                      void catalog.payForTrackAccess(track);
                    }}
                    onShowWalletModal={() => setShowWalletModal(true)}
                    onNavigateToListen={() => navigateToView('listen')}
                    onOpenArtist={handleOpenArtistProfile}
                  />
                )}

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
                    artistName={artistName || getStoredArtistName(activeEvmAddress) || activeArtistDefaultName}
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

            {transactionModal}
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
