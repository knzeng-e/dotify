import { PreparedReleaseReview } from '../../components/PreparedReleaseReview';
import { preparedReleaseForm } from '../../features/artist-studio/preparedReleaseRecovery';
import { usePreparedReleaseRecovery } from '../../features/artist-studio/usePreparedReleaseRecovery';
// Artist-studio provider - wraps the useArtistConsole hook (runtime registration,
// rights, royalties) and the royalty summary derivations. The hook keeps its
// dependency-injection signature; the wiring App.tsx used to do (wallet identity,
// catalog assets, release-form draft, UI feedback) moves here. App reads the
// console and derivations from context and forwards them to the artist views.
// Fail closed: the accessor throws outside the provider.
//
// Note: this mounts in the shared stack (same as today's behavior, where
// useArtistConsole runs for every session). Mounting it only inside
// ArtistPortalView - so listener sessions skip the runtime/royalty work - is a
// follow-up that first needs ArtistConsole to consume this context directly
// instead of receiving ~50 props from App.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useArtistConsole } from '../../hooks/useArtistConsole';
import { deployments } from '../../shared/config/deployments';
import { useWalletContext } from './WalletProvider';
import { useUiFeedback } from './UiFeedbackProvider';
import { useReleaseForm } from './ReleaseFormProvider';
import { useCatalogContext } from './CatalogProvider';

type ArtistStudioValue = {
  artistConsole: ReturnType<typeof useArtistConsole>;
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  paidRoyaltyTracks: number;
};

const ArtistStudioContext = createContext<ArtistStudioValue | null>(null);

export function ArtistStudioProvider({ children }: { children: ReactNode }) {
  const { activeEvmAddress, connectedWallet, ethRpcUrl, expectedChainId } = useWalletContext();
  const { setTransactionFeedback, transactionFeedback } = useUiFeedback();
  const releaseForm = useReleaseForm();
  const {
    title,
    artistName,
    description,
    releaseMetadata,
    durationSeconds,
    accessMode,
    priceDot,
    personhoodLevel,
    royaltyBps,
    additionalRoyaltySplits,
    coverFile,
    setArtistTab
  } = releaseForm;
  const catalog = useCatalogContext();

  const artistConsole = useArtistConsole({
    onReviewPreparedRelease: release => recovery.review(release),
    activeEvmAddress,
    connectedWallet,
    ethRpcUrl,
    currentChainId: expectedChainId,
    factoryAddress: deployments.factory,
    directoryAddress: deployments.directory,
    fileHash: catalog.fileHash,
    title,
    artistName,
    description,
    releaseMetadata,
    durationSeconds,
    accessMode,
    priceDot,
    personhoodLevel,
    royaltyBps,
    additionalRoyaltySplits,
    audioSource: catalog.audioSource,
    coverFile,
    audioCID: catalog.audioCID,
    coverCID: catalog.coverCID,
    coverSource: catalog.coverSource,
    artistTracks: catalog.allCatalogTracks,
    setTransactionFeedback,
    transactionFeedback,
    onReleasePublished: account => {
      // Public confirmation can finish after a disconnect or account switch.
      // Only leave this account's editor, never another artist's current task.
      if (!connectedWallet || account.toLowerCase() !== activeEvmAddress.toLowerCase()) return;
      setArtistTab(current => (current === 'new' ? 'releases' : current));
    },
    refreshCatalogFromRegistry: catalog.refreshCatalogFromRegistry,
    setAudioCID: catalog.setAudioCID,
    setCoverCID: catalog.setCoverCID,
    audioUploadRef: catalog.audioUploadRef,
    coverUploadRef: catalog.coverUploadRef
  });

  const recovery = usePreparedReleaseRecovery(
    {
      owner: activeEvmAddress,
      runtimeAddress: artistConsole.artistRuntimeAddress,
      chainId: connectedWallet?.chainId ?? expectedChainId,
      contentHash: catalog.fileHash,
      connected: Boolean(connectedWallet)
    },
    release => {
      const saved = preparedReleaseForm(release);
      releaseForm.setTitle(saved.title);
      releaseForm.setArtistName(saved.artistName);
      releaseForm.setDescription(saved.description);
      releaseForm.setDurationSeconds(saved.durationSeconds);
      releaseForm.setReleaseMetadata(saved.releaseMetadata);
      releaseForm.setAccessMode(saved.accessMode);
      releaseForm.setPriceDot(saved.priceDot);
      releaseForm.setPersonhoodLevel(saved.personhoodLevel);
      releaseForm.setRoyaltyBps(saved.royaltyBps);
      releaseForm.setAdditionalRoyaltySplits(saved.additionalRoyaltySplits);
      releaseForm.setCoverFile(null);
      catalog.coverUploadRef.current = Promise.resolve(release.manifest.assets.coverCID);
      catalog.setCoverCID(release.manifest.assets.coverCID);
      catalog.setCoverSource(release.manifest.assets.coverCID);
      catalog.setTrackInfo(previous =>
        previous
          ? {
              ...previous,
              title: saved.title,
              artist: saved.artistName,
              description: saved.description,
              imageRef: release.manifest.assets.coverCID,
              priceDot: saved.priceDot,
              accessMode: saved.accessMode,
              duration: saved.durationSeconds ?? 0
            }
          : previous
      );
      releaseForm.setArtistTab('new');
      releaseForm.setReleaseStep('review');
      artistConsole.setRightsStatus('Prepared release restored. Review it before publishing.');
    },
    () => setTransactionFeedback(null)
  );

  const settledRoyaltyPayments = artistConsole.royaltyPayments.filter(payment => payment.settlement === 'paid' || payment.settlement === 'claimed');
  const totalRoyaltyWei = settledRoyaltyPayments.reduce((total, payment) => total + payment.amountWei, 0n);
  const uniqueRoyaltyListeners = new Set(artistConsole.royaltyPayments.map(payment => payment.listener.toLowerCase())).size;
  const paidRoyaltyTracks = new Set(settledRoyaltyPayments.map(payment => payment.trackHash.toLowerCase())).size;

  const value = useMemo<ArtistStudioValue>(
    () => ({ artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks }),
    [artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks]
  );

  return (
    <ArtistStudioContext.Provider value={value}>
      {children}
      {recovery.candidate && (
        <PreparedReleaseReview
          release={recovery.candidate}
          symbol={catalog.nativeRuntimePaymentAsset.symbol}
          onCancel={recovery.cancel}
          onConfirm={recovery.confirm}
        />
      )}
    </ArtistStudioContext.Provider>
  );
}

export function useArtistStudio(): ArtistStudioValue {
  const value = useContext(ArtistStudioContext);
  if (!value) throw new Error('useArtistStudio must be used within an ArtistStudioProvider.');
  return value;
}
