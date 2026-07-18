// Playback provider - wraps the usePlayback hook (media elements + transport
// state that survives tab changes) and owns the three cross-domain handlers it
// and PersistentAudio need: open a track (catalog select/open + route to the
// player) and prepare the local host stream. Those
// coordinate catalog + session + navigation, so they live here below all three.
// Fail closed: the accessor throws outside the provider.
//
// The transport (currentTime/duration) is exposed together with the actions for
// now. Splitting it into a separate fast-ticking context is a deferred
// optimization: worth doing only if profiling shows the ~4x/sec transport updates
// are re-rendering the tree wastefully.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePlayback } from '../../hooks/usePlayback';
import { historyStateObject } from '../routing';
import { useNavigation } from './NavigationProvider';
import { useCatalogContext } from './CatalogProvider';
import { useSessionContext } from './SessionProvider';
import type { CatalogTrack } from '../../shared/types';

type PlaybackValue = {
  playback: ReturnType<typeof usePlayback>;
  openTrack: (track: CatalogTrack) => void;
  prepareLocalStream: () => void;
};

const PlaybackContext = createContext<PlaybackValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { setActiveView, setIsArtistPortal, setPublicArtistName, isArtistPortal } = useNavigation();
  const catalog = useCatalogContext();
  const session = useSessionContext();

  function handlePrepareLocalStream() {
    void session.prepareLocalStream(catalog.audioSource, catalog.trackInfo);
  }

  function handleOpenTrack(track: CatalogTrack) {
    setPublicArtistName(null);
    if (isArtistPortal) {
      const nextState = { ...historyStateObject(window.history.state), dotifyView: 'player' };
      setIsArtistPortal(false);
      setActiveView('player');
      window.history.pushState(nextState, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      void catalog.selectTrack(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
      return;
    }

    void catalog.openTrack(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers);
  }

  const playback = usePlayback({
    mode: session.mode,
    localAudioRef: catalog.localAudioRef,
    remoteAudioRef: session.remoteAudioRef,
    audioSource: catalog.audioSource,
    remoteReady: session.remoteReady,
    remoteStreamVersion: session.remoteStreamVersion,
    localStreamReady: session.localStreamReady,
    playerState: catalog.playerState,
    catalogTracks: catalog.catalogTracks,
    selectedTrackId: catalog.selectedTrackId,
    onOpenTrack: handleOpenTrack,
    onEmitPlayerState: session.emitPlayerState
  });

  const value = useMemo<PlaybackValue>(
    () => ({ playback, openTrack: handleOpenTrack, prepareLocalStream: handlePrepareLocalStream }),
    // handleOpenTrack/handlePrepareLocalStream are
    // recreated each render (as they were in App); they read live catalog/session
    // state, so memoizing on `playback` alone keeps the value fresh without churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playback]
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlaybackContext(): PlaybackValue {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error('usePlaybackContext must be used within a PlaybackProvider.');
  return value;
}
