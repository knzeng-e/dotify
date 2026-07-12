import { useEffect } from 'react';

import { applyAura, auraForTrack, auraForName } from './shared/utils/aura';
import { deployments } from './shared/config/deployments';
import { destroyBulletinClient } from './hooks/useBulletin';
import { getStoredArtistName } from './hooks/useArtistConsole';
import { useNavigation, useCatalogContext, useSessionContext, useArtistStudio, useWalletContext, useReleaseForm } from './app/providers';

import { ListenerShell } from './views/ListenerShell';
import { ArtistShell } from './views/ArtistShell';

// ── App ────────────────────────────────────────────────────────────────────────
// App is the shell switch: the provider stack (app/providers) owns all state, and
// the two shells (ListenerShell, ArtistShell) own their render trees. App only
// picks the shell and runs the handful of effects that span both shells.

const DEFAULT_ARTIST_NAME = 'Dotify Artist';

export default function App() {
  const { isArtistPortal, publicArtistName } = useNavigation();
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { artistConsole } = useArtistStudio();
  const { activeEvmAddress, ethRpcUrl } = useWalletContext();
  const { setArtistName } = useReleaseForm();
  const directoryAddress = deployments.directory;

  // Tear down the room, revoke object URLs, and close the Bulletin client on exit.
  useEffect(() => {
    return () => {
      session.destroySession();
      catalog.clearObjectUrls();
      destroyBulletinClient();
    };
  }, []);

  // Thresholds direction: a warm editorial commons where a work opens a space.
  // The aura variables still carry real track identity, but no longer render a
  // permanent galaxy/console backdrop.
  useEffect(() => {
    document.body.classList.add('dotify-thresholds');
    return () => document.body.classList.remove('dotify-thresholds');
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

  // Seed the artist identity from storage on wallet change. This runs in both
  // shells: the listener account view shows the artist name/runtime too.
  useEffect(() => {
    const storedName = getStoredArtistName(activeEvmAddress);
    if (storedName) {
      setArtistName(storedName);
      return;
    }
    setArtistName(previous => (previous.trim() && previous !== 'Dotify Artist' ? previous : DEFAULT_ARTIST_NAME));
  }, [activeEvmAddress, setArtistName]);

  useEffect(() => {
    void artistConsole.refreshArtistRuntime();
  }, [activeEvmAddress, directoryAddress, ethRpcUrl]);

  return isArtistPortal ? <ArtistShell /> : <ListenerShell />;
}
