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
  const { activeEvmAddress, connectedWallet, ethRpcUrl, activeSubstrateAddress, activeSubstrateSigner } = useWalletContext();
  const { setTransactionFeedback } = useUiFeedback();
  const { title, artistName, description, accessMode, priceDot, personhoodLevel, royaltyBps, coverFile, uploadToBulletinEnabled } = useReleaseForm();
  const catalog = useCatalogContext();

  const artistConsole = useArtistConsole({
    activeEvmAddress,
    connectedWallet,
    ethRpcUrl,
    factoryAddress: deployments.factory,
    directoryAddress: deployments.directory,
    fileHash: catalog.fileHash,
    title,
    artistName,
    description,
    accessMode,
    priceDot,
    personhoodLevel,
    royaltyBps,
    audioSource: catalog.audioSource,
    coverFile,
    audioCID: catalog.audioCID,
    coverCID: catalog.coverCID,
    coverSource: catalog.coverSource,
    activeSubstrateAddress,
    activeSubstrateSigner,
    artistTracks: catalog.allCatalogTracks,
    setTransactionFeedback,
    refreshCatalogFromRegistry: catalog.refreshCatalogFromRegistry,
    setAudioCID: catalog.setAudioCID,
    setCoverCID: catalog.setCoverCID,
    uploadToBulletinEnabled,
    audioUploadRef: catalog.audioUploadRef,
    coverUploadRef: catalog.coverUploadRef
  });

  const totalRoyaltyWei = artistConsole.royaltyPayments.reduce((total, payment) => total + payment.amountWei, 0n);
  const uniqueRoyaltyListeners = new Set(artistConsole.royaltyPayments.map(payment => payment.listener.toLowerCase())).size;
  const paidRoyaltyTracks = new Set(artistConsole.royaltyPayments.map(payment => payment.trackHash.toLowerCase())).size;

  const value = useMemo<ArtistStudioValue>(
    () => ({ artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks }),
    [artistConsole, totalRoyaltyWei, uniqueRoyaltyListeners, paidRoyaltyTracks]
  );

  return <ArtistStudioContext.Provider value={value}>{children}</ArtistStudioContext.Provider>;
}

export function useArtistStudio(): ArtistStudioValue {
  const value = useContext(ArtistStudioContext);
  if (!value) throw new Error('useArtistStudio must be used within an ArtistStudioProvider.');
  return value;
}
