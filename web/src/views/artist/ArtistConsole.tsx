import type { ArtistTab, CatalogTrack } from '../../shared/types';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { hashFileWithBytes } from '../../shared/utils/hash';
import { deployments } from '../../shared/config/deployments';
import { isBackendConfigured, protectedAudioUploadToCID, uploadFileToPinata, uploadProtectedAudio, type BackendUploadIdentity } from '../../services/pinata';
import { buildDraftTrackInfo, nextTitleFromUpload, uploadStatusMessage } from '../../features/uploads/uploadModel';
import {
  artistStudioLocked as deriveArtistStudioLocked,
  canReviewRelease as deriveCanReviewRelease,
  nextReleaseStep,
  previousReleaseStep
} from '../../features/artist-studio/releaseForm';
import { isTrackManagedByArtist } from '../../features/catalog/trackModel';
import { useReleaseForm, useWalletContext, useCatalogContext, useSessionContext, useArtistStudio, usePlaybackContext } from '../../app/providers';
import { OverviewTab } from './OverviewTab';
import { NewReleaseTab } from './NewReleaseTab';
import { ReleasesTab } from './ReleasesTab';
import { ArtistEarnings } from './ArtistEarnings';
import { AdvancedTab } from './AdvancedTab';
import { Plus } from 'lucide-react';
import { ContributionPolicyEditor } from './ContributionPolicyEditor';
import { CoverImage } from '../../components/CoverImage';
import { summarizeReleaseEarnings } from '../../features/artist-studio/earnings';
import { useContributionHistory } from '../../features/donations/useContributionHistory';
import { addReleaseTips, artistActivity } from '../../features/artist-studio/dashboard';
import type { EarningsSummaryProps } from './EarningsSummary';

function nextRoyaltySplitId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `split-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const artistTabs: Array<{ id: ArtistTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'releases', label: 'Releases' },
  { id: 'royalties', label: 'Earnings' },
  { id: 'rights', label: 'Rights & support' }
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
    additionalRoyaltySplits,
    setAdditionalRoyaltySplits,
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
  const { connectedWallet, activeEvmAddress, activeSubstrateAddress, expectedChainId, getActiveWalletClient, bulletinAccountIndex, setBulletinAccountIndex } =
    useWalletContext();
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { artistConsole, totalRoyaltyWei } = useArtistStudio();
  const { openTrack } = usePlaybackContext();

  const factoryAddress = deployments.factory;
  const directoryAddress = deployments.directory;

  // Bind the names the render body + subtabs read.
  const onSetArtistTab = setArtistTab;
  const currentSection = artistTab === 'new' ? 'releases' : artistTab === 'advanced' ? 'rights' : artistTab;
  const artistRuntimeAddress = artistConsole.artistRuntimeAddress;
  const artistRegistrationStatus = artistConsole.artistRegistrationStatus;
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
  const nativePaymentSymbol = catalog.nativeRuntimePaymentAsset.symbol;

  const artistTracks = catalog.allCatalogTracks.filter(track => isTrackManagedByArtist(track, activeEvmAddress, artistName));
  const history = useContributionHistory(artistRuntimeAddress);
  const listeningReleaseEarnings = summarizeReleaseEarnings(artistTracks, artistConsole.allRoyaltyPayments, activeEvmAddress);
  const earningsSummary: EarningsSummaryProps = {
    generatedWei: listeningReleaseEarnings.reduce((total, row) => total + row.generatedWei, 0n),
    receivedWei: totalRoyaltyWei,
    claimableWei: artistConsole.claimableRoyaltyWei,
    claimableKnown: artistConsole.royaltyRuntimeSummaries.length > 0 && artistConsole.royaltyRuntimeSummaries.every(row => row.claimableWei !== null),
    historyState: artistConsole.royaltyHistoryState,
    updatedAt: artistConsole.royaltyUpdatedAt,
    refreshing: isRefreshingRoyalties,
    symbol: nativePaymentSymbol,
    onRefresh: () => {
      void artistConsole.refreshArtistRoyalties(true);
    }
  };
  const releaseEarnings = addReleaseTips(listeningReleaseEarnings, history.rows, activeEvmAddress);
  const activity = artistActivity(royaltyPayments, history.rows, catalog.allCatalogTracks, activeEvmAddress, artistRuntimeAddress);
  const artistRegistrationAvailable = artistConsole.artistRegistrationAvailable;
  const artistPublicationQuarantined = artistConsole.artistPublicationQuarantined;
  const hasArtistRuntime = Boolean(artistConsole.artistRuntimeAddress);
  const artistStudioLocked = artistPublicationQuarantined || deriveArtistStudioLocked(artistRegistrationAvailable, hasArtistRuntime);
  const canReviewRelease = deriveCanReviewRelease({ fileHash, title, audioSource });

  const onOpenTrack = openTrack;
  const onSetReleaseStep = setReleaseStep;
  const onSetTitle = setTitle;
  const onSetDescription = setDescription;
  const onSetAccessMode = setAccessMode;
  const onSetPersonhoodLevel = setPersonhoodLevel;
  const onSetPriceDot = setPriceDot;
  const onSetRoyaltyBps = setRoyaltyBps;
  const onAddRoyaltySplit = () =>
    setAdditionalRoyaltySplits(current => [
      ...current,
      {
        id: nextRoyaltySplitId(),
        label: `Rights holder ${current.length + 1}`,
        recipient: '',
        bps: 0
      }
    ]);
  const onUpdateRoyaltySplit = (id: string, patch: Partial<(typeof additionalRoyaltySplits)[number]>) => {
    setAdditionalRoyaltySplits(current => current.map(split => (split.id === id ? { ...split, ...patch } : split)));
  };
  const onRemoveRoyaltySplit = (id: string) => {
    setAdditionalRoyaltySplits(current => current.filter(split => split.id !== id));
  };
  const onSetUploadToBulletinEnabled = setUploadToBulletinEnabled;
  const onSetBulletinAccountIndex = setBulletinAccountIndex;
  const onUpdateArtistName = (name: string) => artistConsole.updateArtistName(name, setArtistName);
  const onRefreshArtistRuntime = () => {
    void artistConsole.refreshArtistRuntime(true);
  };
  const onRegisterRights = artistConsole.registerRights;
  const onUpdateReleaseAccessMode = artistConsole.updateReleaseAccessMode;
  const onSetReleaseActive = artistConsole.setReleaseActive;
  const onSetExpandedRoyaltyPaymentId = artistConsole.setExpandedRoyaltyPaymentId;

  async function getUploadIdentity(): Promise<BackendUploadIdentity | undefined> {
    if (!isBackendConfigured()) return undefined;
    if (!connectedWallet) throw new Error('Connect your artist account before uploading release assets.');
    const chainId = expectedChainId ?? connectedWallet.chainId;
    if (!chainId) throw new Error('Confirm the artist network before uploading release assets.');
    if (connectedWallet.keyRequestSigner) return { chainId, signer: connectedWallet.keyRequestSigner };
    return { chainId, walletClient: await getActiveWalletClient() };
  }

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
      const uploadIdentity = await getUploadIdentity();

      // Production: raw audio goes to the backend, which encrypts server-side
      // with the master-secret-derived key. Demo: browser-side encryption.
      const uploadPromise = uploadProtectedAudio({ bytes: result.bytes, name: file.name, mime: file.type }, result.hash, uploadIdentity)
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

  async function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
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
      const uploadIdentity = await getUploadIdentity();

      const uploadPromise = uploadFileToPinata(file, file.name, { app: 'dotify', type: 'cover' }, uploadIdentity)
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
        <div className='studio-portrait' aria-hidden='true'>
          <CoverImage src={artistTracks[0]?.imageRef ?? ''} alt='' fallbackLabel={artistName || 'Artist'} />
        </div>
        <div className='studio-id'>
          <p className='studio-kicker'>Artist space</p>
          <h1>{artistName.trim() || 'Your music'}</h1>
          <div className='studio-id-sub'>
            <span>
              {artistTracks.length} release{artistTracks.length === 1 ? '' : 's'}
            </span>
            <span>{connectedWallet?.label ?? 'Artist account'}</span>
          </div>
        </div>
        {artistRuntimeAddress && (artistTracks.length > 0 || artistTab !== 'overview') && artistTab !== 'new' && (
          <button className='primary-action studio-publish' type='button' onClick={() => onSetArtistTab('new')} disabled={artistStudioLocked}>
            <Plus size={18} />
            New release
          </button>
        )}
      </header>

      {artistPublicationQuarantined && (
        <div className='artist-publication-quarantine' role='status'>
          <strong>New artist profiles and releases are paused.</strong>
          <span>{artistConsole.artistPublicationQuarantineReason}</span>
        </div>
      )}

      <div className='console-tabs-shell'>
        <div className='console-tabs' role='tablist' aria-label='Artist workspace'>
          {artistTabs.map(tab => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              id={`artist-tab-${tab.id}`}
              aria-controls='artist-task-panel'
              aria-selected={currentSection === tab.id}
              tabIndex={currentSection === tab.id ? 0 : -1}
              data-active={currentSection === tab.id}
              onClick={() => onSetArtistTab(tab.id)}
              onKeyDown={event => {
                const index = artistTabs.findIndex(item => item.id === tab.id);
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % artistTabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + artistTabs.length - 1) % artistTabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? artistTabs.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                onSetArtistTab(artistTabs[next].id);
                document.getElementById(`artist-tab-${artistTabs[next].id}`)?.focus();
              }}
            >
              <strong>{tab.label}</strong>
            </button>
          ))}
        </div>
      </div>
      <div id='artist-task-panel' role='tabpanel' aria-labelledby={`artist-tab-${currentSection}`}>
        {artistTab === 'overview' && (
          <OverviewTab
            artistName={artistName}
            artistRuntimeAddress={artistRuntimeAddress}
            artistRegistrationStatus={artistRegistrationStatus}
            isRegisteringArtist={artistConsole.isRegisteringArtist}
            isRefreshingArtistRuntime={isRefreshingArtistRuntime}
            artistRegistrationAvailable={artistRegistrationAvailable}
            history={history}
            activity={activity}
            earnings={earningsSummary}
            releases={releaseEarnings}
            onUpdateArtistName={onUpdateArtistName}
            onRegisterArtist={artistConsole.registerArtist}
            onRefreshArtistRuntime={onRefreshArtistRuntime}
            onSetArtistTab={onSetArtistTab}
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
            nativePaymentSymbol={nativePaymentSymbol}
            royaltyBps={royaltyBps}
            additionalRoyaltySplits={additionalRoyaltySplits}
            uploadToBulletinEnabled={uploadToBulletinEnabled}
            rightsStatus={rightsStatus}
            isRegistering={isRegistering}
            canReviewRelease={canReviewRelease}
            artistName={artistName}
            connectedWallet={connectedWallet}
            activeEvmAddress={activeEvmAddress}
            artistRuntimeAddress={artistRuntimeAddress}
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
            onAddRoyaltySplit={onAddRoyaltySplit}
            onUpdateRoyaltySplit={onUpdateRoyaltySplit}
            onRemoveRoyaltySplit={onRemoveRoyaltySplit}
            onSetUploadToBulletinEnabled={onSetUploadToBulletinEnabled}
            onSetBulletinAccountIndex={onSetBulletinAccountIndex}
            onRegisterRights={onRegisterRights}
          />
        )}

        {(artistTab === 'releases' || artistTab === 'rights') && (
          <ReleasesTab
            mode={artistTab === 'rights' ? 'rights' : 'releases'}
            onManageRights={() => onSetArtistTab('rights')}
            artistTracks={artistTracks}
            selectedReleaseId={selectedReleaseId}
            onSelectRelease={setSelectedReleaseId}
            onOpenTrack={onOpenTrack}
            onUpdateReleaseAccessMode={onUpdateReleaseAccessMode}
            onSetReleaseActive={onSetReleaseActive}
            releaseActionId={artistConsole.releaseActionId}
            arrivedReleaseId={arrivedReleaseId}
            nativePaymentSymbol={nativePaymentSymbol}
            earnings={releaseEarnings}
            earningsKnown={artistConsole.royaltyUpdatedAt !== null && history.known}
            earningsStale={artistConsole.royaltyHistoryState === 'stale'}
          />
        )}

        {artistTab === 'rights' && artistRuntimeAddress && (
          <ContributionPolicyEditor key={artistRuntimeAddress} runtime={artistRuntimeAddress} tracks={artistTracks} />
        )}
        {artistTab === 'royalties' && (
          <ArtistEarnings
            history={history}
            royaltyPayments={royaltyPayments}
            royaltyStatus={royaltyStatus}
            claimableRoyaltyWei={artistConsole.claimableRoyaltyWei}
            royaltyRuntimeSummaries={artistConsole.royaltyRuntimeSummaries}
            isClaimingRoyalties={artistConsole.isClaimingRoyalties}
            artistRuntimeAddress={artistRuntimeAddress}
            expandedRoyaltyPaymentId={expandedRoyaltyPaymentId}
            earnings={earningsSummary}
            releases={listeningReleaseEarnings}
            onOpenRelease={openReleaseDetails}
            nativePaymentSymbol={nativePaymentSymbol}
            onSetExpandedRoyaltyPaymentId={onSetExpandedRoyaltyPaymentId}
            onClaimRoyalties={artistConsole.claimRoyalties}
          />
        )}

        {(artistTab === 'advanced' || artistTab === 'rights') && (
          <details className='studio-technical' open={artistTab === 'advanced' || undefined}>
            <summary>Technical records</summary>
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
          </details>
        )}
      </div>
    </section>
  );
}
