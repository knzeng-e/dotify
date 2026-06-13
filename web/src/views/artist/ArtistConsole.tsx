import type { ArtistTab, CatalogTrack, RoyaltyPayment, TrackInfo } from '../../types';
import type { AccessMode, AssetAction, PersonhoodLevel, ReleaseStep } from '../../types';
import type { ChangeEvent, CSSProperties } from 'react';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { shorten } from '../../utils/format';
import { auraForName } from '../../utils/aura';
import { OverviewTab } from './OverviewTab';
import { NewReleaseTab } from './NewReleaseTab';
import { ReleasesTab } from './ReleasesTab';
import { RoyaltiesTab } from './RoyaltiesTab';
import { AdvancedTab } from './AdvancedTab';

const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';

function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

const artistTabs: Array<{ id: ArtistTab; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Identity and next step' },
  { id: 'new', label: 'New Release', description: 'Publish under your own terms' },
  { id: 'releases', label: 'Releases', description: 'Catalog you control' },
  { id: 'royalties', label: 'Royalties', description: 'Payments received' },
  { id: 'advanced', label: 'Advanced', description: 'Proofs, contracts, and archives' }
];

type ArtistConsoleProps = {
  artistTab: ArtistTab;
  onSetArtistTab: (tab: ArtistTab) => void;

  // OverviewTab
  artistName: string;
  activeEvmAddress: `0x${string}`;
  artistRuntimeAddress: `0x${string}` | null;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  artistSetupState: string;
  artistTracks: CatalogTrack[];
  connectedWallet: { label: string } | null;
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onShowWalletModal: () => void;

  // NewReleaseTab
  releaseStep: ReleaseStep;
  artistStudioLocked: boolean;
  assetAction: AssetAction;
  audioSource: string | null;
  fileHash: `0x${string}` | '';
  coverSource: string;
  coverCID: string;
  title: string;
  description: string;
  accessMode: AccessMode;
  personhoodLevel: PersonhoodLevel;
  priceDot: string;
  royaltyBps: number;
  uploadToBulletinEnabled: boolean;
  rightsStatus: string;
  isRegistering: boolean;
  canReviewRelease: boolean;
  activeSubstrateAddress: string | null;
  bulletinAccountIndex: number;
  onSetReleaseStep: (step: ReleaseStep) => void;
  onGoToPreviousStep: () => void;
  onGoToNextStep: () => void;
  onHandleAudioFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleCoverFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSetTitle: (title: string) => void;
  onSetDescription: (desc: string) => void;
  onSetAccessMode: (mode: AccessMode) => void;
  onSetPersonhoodLevel: (level: PersonhoodLevel) => void;
  onSetPriceDot: (price: string) => void;
  onSetRoyaltyBps: (bps: number) => void;
  onSetUploadToBulletinEnabled: (enabled: boolean) => void;
  onSetBulletinAccountIndex: (index: number) => void;
  onRegisterRights: () => void;

  // ReleasesTab
  onOpenTrack: (track: CatalogTrack) => void;

  // RoyaltiesTab
  royaltyPayments: RoyaltyPayment[];
  royaltyStatus: string;
  isRefreshingRoyalties: boolean;
  expandedRoyaltyPaymentId: string | null;
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  paidRoyaltyTracks: number;
  onSetExpandedRoyaltyPaymentId: (id: string | null) => void;
  onRefreshRoyalties: () => void;

  // AdvancedTab
  factoryAddress: `0x${string}` | undefined;
  directoryAddress: `0x${string}` | undefined;
  audioCID: string;
  bulletinManifestRef: string;
  trackInfo: TrackInfo | null;
};

export function ArtistConsole(props: ArtistConsoleProps) {
  const {
    artistTab,
    onSetArtistTab,
    artistName,
    activeEvmAddress,
    artistRuntimeAddress,
    artistRegistrationStatus,
    isRegisteringArtist,
    isRefreshingArtistRuntime,
    artistRegistrationAvailable,
    artistSetupState,
    artistTracks,
    connectedWallet,
    onUpdateArtistName,
    onRegisterArtist,
    onRefreshArtistRuntime,
    onShowWalletModal,
    releaseStep,
    artistStudioLocked,
    assetAction,
    audioSource,
    fileHash,
    coverSource,
    coverCID,
    title,
    description,
    accessMode,
    personhoodLevel,
    priceDot,
    royaltyBps,
    uploadToBulletinEnabled,
    rightsStatus,
    isRegistering,
    canReviewRelease,
    activeSubstrateAddress,
    bulletinAccountIndex,
    onSetReleaseStep,
    onGoToPreviousStep,
    onGoToNextStep,
    onHandleAudioFile,
    onHandleCoverFile,
    onSetTitle,
    onSetDescription,
    onSetAccessMode,
    onSetPersonhoodLevel,
    onSetPriceDot,
    onSetRoyaltyBps,
    onSetUploadToBulletinEnabled,
    onSetBulletinAccountIndex,
    onRegisterRights,
    onOpenTrack,
    royaltyPayments,
    royaltyStatus,
    isRefreshingRoyalties,
    expandedRoyaltyPaymentId,
    totalRoyaltyWei,
    uniqueRoyaltyListeners,
    paidRoyaltyTracks,
    onSetExpandedRoyaltyPaymentId,
    onRefreshRoyalties,
    factoryAddress,
    directoryAddress,
    audioCID,
    bulletinManifestRef,
    trackInfo
  } = props;

  const studioAura = auraForName(artistName);
  const studioHandle = artistName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'artist';

  return (
    <section className='artist-console'>
      <header className='studio-head'>
        <span
          className='studio-avatar'
          aria-hidden='true'
          style={{ '--aura-a': studioAura.a, '--aura-b': studioAura.b, '--aura-accent': studioAura.accent } as CSSProperties}
        />
        <div className='studio-id'>
          <h1>
            {artistName}
            <BadgeCheck size={22} aria-label='Verified artist-owned runtime' />
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
            <span>{artistTracks.length} release{artistTracks.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </header>

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
          onOpenTrack={onOpenTrack}
        />
      )}

      {artistTab === 'new' && (
        <NewReleaseTab
          releaseStep={releaseStep}
          artistStudioLocked={artistStudioLocked}
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
        <ReleasesTab artistTracks={artistTracks} onOpenTrack={onOpenTrack} />
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
