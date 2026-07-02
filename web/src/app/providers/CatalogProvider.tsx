// Catalog provider - wraps the useCatalog hook and publishes it to the tree. The
// hook keeps its dependency-injection signature untouched; the wiring App.tsx used
// to do (sourcing wallet identity, UI feedback, navigation, and release-form
// setters) now happens here, and the two catalog-owned effects (load the on-chain
// catalog, keep per-track access in sync with the wallet) move in with it. Fail
// closed: the accessor throws outside the provider.

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { deployments } from '../../shared/config/deployments';
import { useWalletContext } from './WalletProvider';
import { useUiFeedback } from './UiFeedbackProvider';
import { useNavigation } from './NavigationProvider';
import { useReleaseForm } from './ReleaseFormProvider';

type CatalogValue = ReturnType<typeof useCatalog>;

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { ethRpcUrl, listenerEvmAddress, connectedWallet, getActiveWalletClient } = useWalletContext();
  const { setShowWalletModal, setTransactionFeedback } = useUiFeedback();
  const { navigateToView } = useNavigation();
  const { setTitle, setAccessMode, setPriceDot, setPersonhoodLevel, setArtistName, setDescription, bulletinManifestRef } = useReleaseForm();
  const directoryAddress = deployments.directory;

  const catalog = useCatalog({
    ethRpcUrl,
    listenerEvmAddress,
    connectedWallet,
    directoryAddress,
    setShowWalletModal,
    setTransactionFeedback,
    setTitle,
    navigateToView,
    getActiveWalletClient,
    setBulletinManifestRef: ref => {
      bulletinManifestRef.current = ref;
    },
    setAccessMode,
    setPriceDot,
    setPersonhoodLevel,
    setArtistName,
    setDescription
  });

  // Load the on-chain catalog when the registry/RPC changes. `catalog` is
  // intentionally excluded: including it would re-run this every render.
  useEffect(() => {
    void catalog.refreshCatalogFromRegistry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryAddress, ethRpcUrl]);

  // Recompute per-track access + paid access whenever the catalog or the active
  // listener changes. Fails closed to empty maps when the catalog is empty.
  useEffect(() => {
    let cancelled = false;
    async function refreshCatalogAccess() {
      if (catalog.catalogTracks.length === 0) {
        catalog.setCatalogAccessByTrackId({});
        catalog.setCatalogPaidAccessByTrackId({});
        return;
      }
      const [accessEntries, paidEntries] = await Promise.all([
        Promise.all(catalog.catalogTracks.map(async track => [track.id, await catalog.checkTrackAccess(track, listenerEvmAddress)] as const)),
        Promise.all(catalog.catalogTracks.map(async track => [track.id, await catalog.checkTrackPaidAccess(track, listenerEvmAddress)] as const))
      ]);
      if (!cancelled) {
        catalog.setCatalogAccessByTrackId(Object.fromEntries(accessEntries));
        catalog.setCatalogPaidAccessByTrackId(Object.fromEntries(paidEntries));
      }
    }
    void refreshCatalogAccess();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.catalogTracks, ethRpcUrl, listenerEvmAddress]);

  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalogContext(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalogContext must be used within a CatalogProvider.');
  return value;
}
