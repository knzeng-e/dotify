import { applyAura, auraForTrack, auraForName } from './shared/utils/aura';

import { hashFileWithBytes } from './shared/utils/hash';
import { deployments } from './shared/config/deployments';
import { useEffect, type ChangeEvent } from 'react';
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

import { WalletModal } from './components/WalletModal';
import { TransactionModal } from './components/TransactionModal';

import { isTrackManagedByArtist } from './features/catalog/trackModel';
import { buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage } from './features/uploads/uploadModel';
import {
  artistSetupState as deriveArtistSetupState,
  artistStudioLocked as deriveArtistStudioLocked,
  canReviewRelease as deriveCanReviewRelease,
  nextReleaseStep,
  previousReleaseStep
} from './features/artist-studio/releaseForm';
import { getStoredArtistName } from './hooks/useArtistConsole';

import { ArtistPortalView } from './views/ArtistPortalView';
import { ListenerShell } from './views/ListenerShell';
import { ArtistConsole } from './views/artist/ArtistConsole';
import { ArtistOnboarding } from './views/artist/ArtistOnboarding';
import { deriveSupportSummary } from './features/wallet/supportSummary';

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
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
  const { connectedWallet, activeEvmAddress, activeSubstrateAddress, ethRpcUrl, bulletinAccountIndex, setBulletinAccountIndex } = useWalletContext();
  const activeArtistDefaultName = 'Dotify Artist';

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  // ── Navigation (provider-owned) ───────────────────────────────────────────────
  // Route/view state and history integration now live in NavigationProvider.
  const { activeView, isArtistPortal, publicArtistName, navigateToView } = useNavigation();

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
  const { openTrack } = usePlaybackContext();

  // ── Derived values (artist portal) ────────────────────────────────────────────
  const artistTracks = catalog.catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const hasArtistRuntime = Boolean(artistConsole.artistRuntimeAddress);
  const artistStudioLocked = deriveArtistStudioLocked(artistRegistrationAvailable, hasArtistRuntime);
  const canReviewRelease = deriveCanReviewRelease({ fileHash: catalog.fileHash, title, audioSource: catalog.audioSource });
  const artistSetupState = deriveArtistSetupState(Boolean(connectedWallet), hasArtistRuntime);

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

  // ── Render ────────────────────────────────────────────────────────────────────
  // The wallet modal in the artist portal shows the same "artists backed /
  // tracks unlocked" rollup as the listener shell.
  const { paidTracks, supportedArtists } = deriveSupportSummary(catalog.catalogTracks, catalog.catalogPaidAccessByTrackId);

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

  return <ListenerShell />;
}
