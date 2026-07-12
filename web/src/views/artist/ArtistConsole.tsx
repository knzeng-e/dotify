import type { ArtistTab, CatalogTrack } from '../../shared/types';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { getBlockscoutAddressUrl } from '../../shared/utils/explorer';
import { shorten } from '../../shared/utils/format';
import { hashFileWithBytes } from '../../shared/utils/hash';
import { deployments } from '../../shared/config/deployments';
import { protectedAudioUploadToCID, uploadFileToPinata, uploadProtectedAudio } from '../../services/pinata';
import { buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage } from '../../features/uploads/uploadModel';
import {
  artistSetupState as deriveArtistSetupState,
  artistStudioLocked as deriveArtistStudioLocked,
  canReviewRelease as deriveCanReviewRelease,
  nextReleaseStep,
  previousReleaseStep
} from '../../features/artist-studio/releaseForm';
import { isTrackManagedByArtist } from '../../features/catalog/trackModel';
import {
  useReleaseForm,
  useWalletContext,
  useUiFeedback,
  useCatalogContext,
  useSessionContext,
  useArtistStudio,
  usePlaybackContext
} from '../../app/providers';
import { OverviewTab } from './OverviewTab';
import { NewReleaseTab } from './NewReleaseTab';
import { ReleasesTab } from './ReleasesTab';
import { RoyaltiesTab } from './RoyaltiesTab';
import { AdvancedTab } from './AdvancedTab';

const artistTabs: Array<{ id: ArtistTab; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Identity and next step' },
  { id: 'new', label: 'New Release', description: 'Publish under your own terms' },
  { id: 'releases', label: 'Releases', description: 'Catalog you control' },
  { id: 'royalties', label: 'Royalties', description: 'Payments received' },
  { id: 'advanced', label: 'Advanced', description: 'Proofs, contracts, and archives' }
];

// The console reads the release draft, wallet, catalog, artist studio, and
// playback from context and owns the upload handlers + studio derivations. Its
// subtabs stay presentational: the same local names are bound here and passed down.
export function ArtistConsole() {
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
  const { connectedWallet, activeEvmAddress, activeSubstrateAddress, bulletinAccountIndex, setBulletinAccountIndex } = useWalletContext();
  const { setShowWalletModal } = useUiFeedback();
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks } = useArtistStudio();
  const { openTrack } = usePlaybackContext();

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  // Bind the names the render body + subtabs read.
  const onSetArtistTab = setArtistTab;
  const artistRuntimeAddress = artistConsole.artistRuntimeAddress;
  const artistRegistrationStatus = artistConsole.artistRegistrationStatus;
  const isRegisteringArtist = artistConsole.isRegisteringArtist;
  const isRefreshingArtistRuntime = artistConsole.isRefreshingArtistRuntime;
  const rightsStatus = artistConsole.rightsStatus;
  const isRegistering = artistConsole.isRegistering;
  const royaltyPayments = artistConsole.royaltyPayments;
  const royaltyStatus = artistConsole.royaltyStatus;
  const isRefreshingRoyalties = artistConsole.isRefreshingRoyalties;
  const expandedRoyaltyPaymentId = artistConsole.expandedRoyaltyPaymentId;
  const bulletinManifestRef = artistConsole.bulletinManifestRef;
  const audioSource = catalog.audioSource;
  const fileHash = catalog.fileHash;
  const coverSource = catalog.coverSource;
  const coverCID = catalog.coverCID;
  const audioCID = catalog.audioCID;
  const trackInfo = catalog.trackInfo;

  const artistTracks = catalog.allCatalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const artistRegistrationAvailable = artistConsole.artistRegistrationAvailable;
  const artistPublicationQuarantined = artistConsole.artistPublicationQuarantined;
  const hasArtistRuntime = Boolean(artistConsole.artistRuntimeAddress);
  const artistStudioLocked = artistPublicationQuarantined || deriveArtistStudioLocked(artistRegistrationAvailable, hasArtistRuntime);
  const canReviewRelease = deriveCanReviewRelease({ fileHash, title, audioSource });
  const artistSetupState = deriveArtistSetupState(Boolean(connectedWallet), hasArtistRuntime);

  const onOpenTrack = openTrack;
  const onSetReleaseStep = setReleaseStep;
  const onSetTitle = setTitle;
  const onSetDescription = setDescription;
  const onSetAccessMode = setAccessMode;
  const onSetPersonhoodLevel = setPersonhoodLevel;
  const onSetPriceDot = setPriceDot;
  const onSetRoyaltyBps = setRoyaltyBps;
  const onSetUploadToBulletinEnabled = setUploadToBulletinEnabled;
  const onSetBulletinAccountIndex = setBulletinAccountIndex;
  const onUpdateArtistName = (name: string) => artistConsole.updateArtistName(name, setArtistName);
  const onRegisterArtist = artistConsole.registerArtist;
  const onRefreshArtistRuntime = () => {
    void artistConsole.refreshArtistRuntime(true);
  };
  const onShowWalletModal = () => setShowWalletModal(true);
  const onRegisterRights = artistConsole.registerRights;
  const onUpdateReleaseAccessMode = artistConsole.updateReleaseAccessMode;
  const onSetReleaseActive = artistConsole.setReleaseActive;
  const onSetExpandedRoyaltyPaymentId = artistConsole.setExpandedRoyaltyPaymentId;
  const onRefreshRoyalties = () => {
    void artistConsole.refreshArtistRoyalties(true);
  };

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
        .then(audioUpload => {
          catalog.setAudioCID(protectedAudioUploadToCID(audioUpload));
          artistConsole.setRightsStatus(uploadStatusMessage('audio', 'uploaded'));
          return audioUpload;
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

  const onHandleAudioFile = handleAudioFile;
  const onHandleCoverFile = handleCoverFile;
  const onGoToPreviousStep = () => setReleaseStep(previousReleaseStep(releaseStep));
  const onGoToNextStep = () => setReleaseStep(nextReleaseStep(releaseStep));

  const studioHandle =
    artistName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'artist';
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(artistTracks[0]?.id ?? null);

  // Into orbit (Constellation phase C): when a new release id appears in the
  // artist's on-chain catalog while the console is open, its card plays a
  // one-shot arrival. Structural id diff, never status-string matching; the
  // first observation only seeds the known set so nothing animates on mount.
  const [arrivedReleaseId, setArrivedReleaseId] = useState<string | null>(null);
  const knownReleaseIdsRef = useRef<Set<string> | null>(null);
  const releaseIdsKey = artistTracks.map(track => track.id).join('|');
  useEffect(() => {
    const known = knownReleaseIdsRef.current;
    knownReleaseIdsRef.current = new Set(artistTracks.map(track => track.id));
    if (!known) return;
    const fresh = artistTracks.find(track => !known.has(track.id));
    if (!fresh) return;
    setArrivedReleaseId(fresh.id);
    const timer = window.setTimeout(() => setArrivedReleaseId(null), 1600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseIdsKey]);

  useEffect(() => {
    if (artistTracks.length === 0) {
      setSelectedReleaseId(null);
      return;
    }

    setSelectedReleaseId(current => (current && artistTracks.some(track => track.id === current) ? current : artistTracks[0].id));
  }, [artistTracks]);

  function openReleaseDetails(track: CatalogTrack) {
    setSelectedReleaseId(track.id);
    onSetArtistTab('releases');
  }

  return (
    <section className='artist-console'>
      <header className='studio-head'>
        <span className='studio-avatar' aria-hidden='true' />
        <div className='studio-id'>
          <h1>
            {artistName}
            <BadgeCheck size={22} aria-label='Verified artist space' />
          </h1>
          <div className='studio-id-sub'>
            <span>@{studioHandle}</span>
            <a className='studio-id-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
              wallet {shorten(activeEvmAddress, 10)}
              <ExternalLink size={12} />
            </a>
            {artistRuntimeAddress && (
              <a className='studio-id-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                runtime {shorten(artistRuntimeAddress, 10)}
                <ExternalLink size={12} />
              </a>
            )}
            <span>
              {artistTracks.length} release{artistTracks.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </header>

      {artistPublicationQuarantined && (
        <div className='artist-publication-quarantine' role='status'>
          <strong>New artist profiles and releases are paused.</strong>
          <span>{artistConsole.artistPublicationQuarantineReason}</span>
        </div>
      )}

      <div className='console-tabs' role='tablist' aria-label='Artist console'>
        {artistTabs.map(tab => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            aria-selected={artistTab === tab.id}
            data-active={artistTab === tab.id}
            onClick={() => onSetArtistTab(tab.id)}
          >
            <strong>{tab.label}</strong>
            <span>{tab.description}</span>
          </button>
        ))}
      </div>

      {artistTab === 'overview' && (
        <OverviewTab
          artistName={artistName}
          activeEvmAddress={activeEvmAddress}
          artistRuntimeAddress={artistRuntimeAddress}
          artistRegistrationStatus={artistRegistrationStatus}
          isRegisteringArtist={isRegisteringArtist}
          isRefreshingArtistRuntime={isRefreshingArtistRuntime}
          artistRegistrationAvailable={artistRegistrationAvailable}
          artistSetupState={artistSetupState}
          artistTracks={artistTracks}
          connectedWallet={connectedWallet}
          royaltyPayments={royaltyPayments}
          totalRoyaltyWei={totalRoyaltyWei}
          uniqueRoyaltyListeners={uniqueRoyaltyListeners}
          onUpdateArtistName={onUpdateArtistName}
          onRegisterArtist={onRegisterArtist}
          onRefreshArtistRuntime={onRefreshArtistRuntime}
          onSetArtistTab={onSetArtistTab}
          onShowWalletModal={onShowWalletModal}
          onOpenRelease={openReleaseDetails}
        />
      )}

      {artistTab === 'new' && (
        <NewReleaseTab
          releaseStep={releaseStep}
          artistStudioLocked={artistStudioLocked}
          publicationQuarantined={artistPublicationQuarantined}
          assetAction={assetAction}
          audioSource={audioSource}
          fileHash={fileHash}
          coverSource={coverSource}
          coverCID={coverCID}
          title={title}
          description={description}
          accessMode={accessMode}
          personhoodLevel={personhoodLevel}
          priceDot={priceDot}
          royaltyBps={royaltyBps}
          uploadToBulletinEnabled={uploadToBulletinEnabled}
          rightsStatus={rightsStatus}
          isRegistering={isRegistering}
          canReviewRelease={canReviewRelease}
          artistName={artistName}
          connectedWallet={connectedWallet}
          activeSubstrateAddress={activeSubstrateAddress}
          bulletinAccountIndex={bulletinAccountIndex}
          onSetReleaseStep={onSetReleaseStep}
          onGoToPreviousStep={onGoToPreviousStep}
          onGoToNextStep={onGoToNextStep}
          onHandleAudioFile={onHandleAudioFile}
          onHandleCoverFile={onHandleCoverFile}
          onSetTitle={onSetTitle}
          onSetDescription={onSetDescription}
          onSetAccessMode={onSetAccessMode}
          onSetPersonhoodLevel={onSetPersonhoodLevel}
          onSetPriceDot={onSetPriceDot}
          onSetRoyaltyBps={onSetRoyaltyBps}
          onSetUploadToBulletinEnabled={onSetUploadToBulletinEnabled}
          onSetBulletinAccountIndex={onSetBulletinAccountIndex}
          onRegisterRights={onRegisterRights}
        />
      )}

      {artistTab === 'releases' && (
        <ReleasesTab
          artistTracks={artistTracks}
          selectedReleaseId={selectedReleaseId}
          onSelectRelease={setSelectedReleaseId}
          onOpenTrack={onOpenTrack}
          onUpdateReleaseAccessMode={onUpdateReleaseAccessMode}
          onSetReleaseActive={onSetReleaseActive}
          releaseActionId={artistConsole.releaseActionId}
          arrivedReleaseId={arrivedReleaseId}
        />
      )}

      {artistTab === 'royalties' && (
        <RoyaltiesTab
          royaltyPayments={royaltyPayments}
          royaltyStatus={royaltyStatus}
          isRefreshingRoyalties={isRefreshingRoyalties}
          artistRuntimeAddress={artistRuntimeAddress}
          expandedRoyaltyPaymentId={expandedRoyaltyPaymentId}
          totalRoyaltyWei={totalRoyaltyWei}
          uniqueRoyaltyListeners={uniqueRoyaltyListeners}
          paidRoyaltyTracks={paidRoyaltyTracks}
          onSetExpandedRoyaltyPaymentId={onSetExpandedRoyaltyPaymentId}
          onRefreshRoyalties={onRefreshRoyalties}
        />
      )}

      {artistTab === 'advanced' && (
        <AdvancedTab
          factoryAddress={factoryAddress}
          directoryAddress={directoryAddress}
          activeEvmAddress={activeEvmAddress}
          artistRuntimeAddress={artistRuntimeAddress}
          fileHash={fileHash}
          audioCID={audioCID}
          coverCID={coverCID}
          bulletinManifestRef={bulletinManifestRef}
          trackInfo={trackInfo}
          uploadToBulletinEnabled={uploadToBulletinEnabled}
          activeSubstrateAddress={activeSubstrateAddress}
        />
      )}
    </section>
  );
}
