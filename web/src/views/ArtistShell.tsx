// Artist shell - the /artists mount point. Both children (ArtistConsole,
// ArtistOnboarding) are self-contained via context, so this shell is just the
// portal-gated effects (royalty refresh, stored-name sync on entry) and the
// console-vs-onboarding switch. Global artist-identity effects that also feed the
// listener account view (runtime resolution, initial name sync) live in App.

import { useEffect } from 'react';
import { useVisibleRefresh } from '../hooks/useVisibleRefresh';
import { getStoredArtistName } from '../hooks/useArtistConsole';
import { useReleaseForm, useWalletContext, useArtistStudio } from '../app/providers';
import { ArtistPortalView } from './ArtistPortalView';
import { ArtistConsole } from './artist/ArtistConsole';
import { ArtistOnboarding } from './artist/ArtistOnboarding';

export function ArtistShell() {
  const { setArtistName } = useReleaseForm();
  const { connectedWallet, activeEvmAddress } = useWalletContext();
  const { artistConsole } = useArtistStudio();
  useVisibleRefresh(() => artistConsole.refreshArtistRoyalties(), connectedWallet ? artistConsole.royaltyScope : null);

  // Re-sync the stored artist name on entering the portal / switching accounts.
  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) setArtistName(storedName);
  }, [activeEvmAddress, setArtistName]);

  const showConsole = Boolean(connectedWallet && (artistConsole.artistRuntimeAddress || artistConsole.hasKnownRoyaltyRuntime));

  // The console is shorter than the onboarding form: without this, a freshly
  // registered artist lands mid-page with the studio tabs under the top bar.
  useEffect(() => {
    if (showConsole) window.scrollTo({ top: 0 });
  }, [showConsole]);

  return <ArtistPortalView>{showConsole ? <ArtistConsole /> : <ArtistOnboarding />}</ArtistPortalView>;
}
