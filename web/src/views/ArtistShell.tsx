// Artist shell - the /artists content: the release studio (ArtistConsole) or the
// onboarding flow (ArtistOnboarding), plus the artist-only upload handlers, wizard
// step navigation, derived studio state, and the two artist-portal-gated effects
// (royalty refresh, stored-name sync on entry). Self-contained via the provider
// stack; App renders it inside the artist portal. Global artist-identity effects
// that also feed the listener account view (runtime resolution, initial name sync)
// stay in App because they must run in both shells.

import { useEffect, type ChangeEvent } from 'react';

import { hashFileWithBytes } from '../shared/utils/hash';
import { deployments } from '../shared/config/deployments';
import { uploadFileToPinata, uploadProtectedAudio } from '../services/pinata';
import { buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage } from '../features/uploads/uploadModel';
import {
  artistSetupState as deriveArtistSetupState,
  artistStudioLocked as deriveArtistStudioLocked,
  canReviewRelease as deriveCanReviewRelease,
  nextReleaseStep,
  previousReleaseStep
} from '../features/artist-studio/releaseForm';
import { isTrackManagedByArtist } from '../features/catalog/trackModel';
import { getStoredArtistName } from '../hooks/useArtistConsole';
import { useWalletContext, useUiFeedback, useReleaseForm, useCatalogContext, useSessionContext, useArtistStudio, usePlaybackContext } from '../app/providers';

import { ArtistPortalView } from './ArtistPortalView';
import { ArtistConsole } from './artist/ArtistConsole';
import { ArtistOnboarding } from './artist/ArtistOnboarding';

export function ArtistShell() {
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
  const { setShowWalletModal } = useUiFeedback();
  const { connectedWallet, activeEvmAddress, activeSubstrateAddress, ethRpcUrl, bulletinAccountIndex, setBulletinAccountIndex } = useWalletContext();
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks } = useArtistStudio();
  const { openTrack } = usePlaybackContext();

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  const artistTracks = catalog.catalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const artistRegistrationAvailable = Boolean(factoryAddress && directoryAddress);
  const hasArtistRuntime = Boolean(artistConsole.artistRuntimeAddress);
  const artistStudioLocked = deriveArtistStudioLocked(artistRegistrationAvailable, hasArtistRuntime);
  const canReviewRelease = deriveCanReviewRelease({ fileHash: catalog.fileHash, title, audioSource: catalog.audioSource });
  const artistSetupState = deriveArtistSetupState(Boolean(connectedWallet), hasArtistRuntime);

  // Refresh royalties when the royalties tab is active (the shell only mounts in
  // the artist portal, so the previous isArtistPortal guard is implicit).
  useEffect(() => {
    if (artistTab !== 'royalties') return;
    void artistConsole.refreshArtistRoyalties();
  }, [artistTab, artistConsole.artistRuntimeAddress, ethRpcUrl, catalog.catalogTracks.length, activeEvmAddress, artistName]);

  // Re-sync the stored artist name on entering the portal / switching accounts.
  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) setArtistName(storedName);
  }, [activeEvmAddress, setArtistName]);

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

  function goToPreviousReleaseStep() {
    setReleaseStep(previousReleaseStep(releaseStep));
  }

  function goToNextReleaseStep() {
    setReleaseStep(nextReleaseStep(releaseStep));
  }

  return (
    <ArtistPortalView>
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
