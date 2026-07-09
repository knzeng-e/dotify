// Artist shell - the /artists mount point. Both children (ArtistConsole,
// ArtistOnboarding) are self-contained via context, so this shell is just the
// portal-gated effects (royalty refresh, stored-name sync on entry) and the
// console-vs-onboarding switch. Global artist-identity effects that also feed the
// listener account view (runtime resolution, initial name sync) live in App.

import { useEffect } from 'react';
import { getStoredArtistName } from '../hooks/useArtistConsole';
import { useReleaseForm, useWalletContext, useArtistStudio, useCatalogContext } from '../app/providers';
import { ArtistPortalView } from './ArtistPortalView';
import { ArtistConsole } from './artist/ArtistConsole';
import { ArtistOnboarding } from './artist/ArtistOnboarding';

export function ArtistShell() {
  const { artistName, setArtistName, artistTab } = useReleaseForm();
  const { connectedWallet, activeEvmAddress, ethRpcUrl } = useWalletContext();
  const { artistConsole } = useArtistStudio();
  const catalog = useCatalogContext();

  // Refresh royalties when the royalties tab is active (this shell only mounts in
  // the artist portal, so the previous isArtistPortal guard is implicit).
  useEffect(() => {
    if (artistTab !== 'royalties') return;
    void artistConsole.refreshArtistRoyalties();
  }, [artistTab, artistConsole.artistRuntimeAddress, ethRpcUrl, catalog.allCatalogTracks.length, activeEvmAddress, artistName]);

  // Re-sync the stored artist name on entering the portal / switching accounts.
  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) setArtistName(storedName);
  }, [activeEvmAddress, setArtistName]);

  return <ArtistPortalView>{connectedWallet && artistConsole.artistRuntimeAddress ? <ArtistConsole /> : <ArtistOnboarding />}</ArtistPortalView>;
}
