import { useListeningCheckpoint } from '../../features/player/useListeningCheckpoint';
import { useSystemMediaSession } from '../../features/player/useSystemMediaSession';
import { useWalletContext } from './WalletProvider';
import type { ListeningCheckpoint } from '../../features/player/listeningCheckpoint';
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

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePlayback } from '../../hooks/usePlayback';
import { PersistentAudio } from '../../components/PersistentAudio';
import { RoomCloseDialog } from '../../components/RoomCloseDialog';
import { catalogTrackToTrackInfo } from '../../features/catalog/trackModel';
import { useUiFeedback } from './UiFeedbackProvider';
import { useNavigation } from './NavigationProvider';
import { useCatalogContext } from './CatalogProvider';
import { useSessionContext } from './SessionProvider';
import type { CatalogTrack } from '../../shared/types';

type PlaybackValue = {
  playback: ReturnType<typeof usePlayback>;
  openTrack: (track: CatalogTrack) => void;
  prepareLocalStream: () => void;
  playerDismissed: boolean;
  closePlayer: () => void;
  reopenPlayer: () => void;
  requestRoomExit: () => void;
  resumeOffer: (ListeningCheckpoint & { title: string; artist: string }) | null;
  resumeListening: () => void;
  dismissResume: () => void;
};

const PlaybackContext = createContext<PlaybackValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { activeView, isArtistPortal, publicArtistName, navigateToView, clearRoomLink } = useNavigation();
  const { pushNotice } = useUiFeedback();
  const [playerDismissed, setPlayerDismissed] = useState(false);
  const [pendingExit, setPendingExit] = useState<{ roomId: string; dismissPlayer: boolean } | null>(null);
  const previousRoom = useRef('');
  const previousRoomWasGuest = useRef(false);
  const previousView = useRef(activeView);
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const wallet = useWalletContext();

  function handlePrepareLocalStream() {
    void session.prepareLocalStream(catalog.audioSource, catalog.trackInfo);
  }

  function handleOpenTrack(track: CatalogTrack) {
    const showAccessGateOnDenied = session.mode === 'host' && Boolean(session.roomId);
    setPlayerDismissed(false);
    checkpoint.clear();
    void catalog.openTrack(track, session.socketEmit, session.setLocalStreamReady, session.closeHostPeers, showAccessGateOnDenied);
  }

  const playback = usePlayback({
    mode: session.mode,
    roomId: session.roomId,
    localAudioRef: catalog.localAudioRef,
    remoteAudioRef: session.remoteAudioRef,
    audioSource: catalog.audioSource,
    audioSourceGeneration: catalog.audioSourceGeneration,
    previewOnly: catalog.selectedTrackId === 'draft-upload',
    audioContinuation: catalog.audioContinuation,
    audioRecovery: catalog.audioRecovery,
    audioStartupAttemptId: catalog.audioStartupAttemptId,
    trackSelectionPending: catalog.trackSelectionPending,
    audioSourcePending: catalog.audioSourcePending,
    onHostMediaSettled: catalog.settleTrackSelectionMedia,
    remoteReady: session.remoteReady,
    remoteStreamVersion: session.remoteStreamVersion,
    localStreamReady: session.localStreamReady,
    playerState: catalog.playerState,
    catalogTracks: catalog.catalogTracks,
    selectedTrackId: catalog.selectedTrackId,
    lineup: session.roomLineup,
    onLineupChange: session.updateRoomLineup,
    onOpenTrack: handleOpenTrack,
    onPrepareKeys: catalog.prepareQueuedContentKeys,
    onPrepareNext: catalog.prepareNextPlayback,
    onEmitPlayerState: session.emitPlayerState
  });

  const selectedTrack = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const checkpoint = useListeningCheckpoint(
    playback,
    catalog.audioSource ? selectedTrack : undefined,
    !session.roomId && !playerDismissed,
    `${wallet.connectedWallet?.evmAddress?.toLowerCase() ?? 'anonymous'}:${wallet.connectedWallet?.chainId ?? wallet.expectedChainId ?? ''}`
  );
  const resumeTrack = checkpoint.offer
    ? catalog.catalogTracks.find(track => track.id === checkpoint.offer!.trackId && track.hash === checkpoint.offer!.hash && track.active !== false)
    : null;
  useSystemMediaSession(playback, catalog.trackInfo, Boolean(catalog.trackInfo) && (!playerDismissed || Boolean(session.roomId)));

  function resumeListening() {
    if (!resumeTrack || !checkpoint.offer || session.roomId) return;
    playback.restoreListening(resumeTrack.id, checkpoint.offer.position, checkpoint.offer.queue);
    checkpoint.clear();
    setPlayerDismissed(false);
    playback.requestAutoplay();
    handleOpenTrack(resumeTrack);
  }

  function stopPlayback() {
    catalog.cancelNextPlayback();
    playback.stop();
    catalog.cancelPlaybackPreparation();
  }

  function restoreSoloMetadata() {
    const selected = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
    catalog.setTrackInfo(selected ? catalogTrackToTrackInfo(selected) : null);
  }

  function exitRoom(dismissPlayer = false) {
    // Mark an explicit exit before clearing room state so the passive closure
    // observer does not announce it again or override a leave-and-open action.
    previousRoom.current = '';
    setPendingExit(null);
    stopPlayback();
    if (dismissPlayer) {
      setPlayerDismissed(true);
      checkpoint.clear();
    }
    if (session.mode === 'listener') restoreSoloMetadata();
    session.leaveSession();
    navigateToView('listen', { replace: true, clearRoomLink: true });
  }

  const activeListenerCount = session.listeners.filter(listener => listener.status !== 'disconnected').length;
  function requestExit(dismissPlayer = false) {
    if (session.roomId && (dismissPlayer || (session.mode === 'host' && activeListenerCount > 0))) {
      setPendingExit({ roomId: session.roomId, dismissPlayer });
      return;
    }
    exitRoom(dismissPlayer);
  }

  function closePlayer() {
    if (session.roomId || session.sessionAction !== 'idle') {
      requestExit(true);
      return;
    }
    stopPlayback();
    checkpoint.clear();
    setPlayerDismissed(true);
  }

  useLayoutEffect(() => {
    const endedRoom = previousRoom.current;
    const wasGuest = previousRoomWasGuest.current;
    previousRoom.current = session.roomId;
    previousRoomWasGuest.current = session.mode === 'listener';
    if (!endedRoom || session.roomId) return;
    // A host closing a room or an expired session is a real exit too. Browsing
    // stays where it is; only an orphaned full-room player returns home.
    stopPlayback();
    setPendingExit(null);
    if (wasGuest) restoreSoloMetadata();
    pushNotice({ tone: 'info', title: 'Room ended', message: session.error || 'The room is closed. You can find another listening moment.' });
    if (activeView === 'player' && !publicArtistName && !isArtistPortal) navigateToView('listen', { replace: true, clearRoomLink: true });
    else clearRoomLink();
    // The room identity transition owns this effect, not the changing facade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.roomId]);

  useLayoutEffect(() => {
    const leftPlayer = previousView.current === 'player' && activeView !== 'player';
    previousView.current = activeView;
    if (!leftPlayer || session.roomId || session.sessionAction === 'idle') return;
    // Leaving an uncompleted join/create must cancel the operation, not open
    // a room in the background when its acknowledgement arrives later.
    stopPlayback();
    session.leaveSession();
    clearRoomLink();
    // Navigation owns cancellation; facade changes alone must not leave rooms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const value = useMemo<PlaybackValue>(
    () => ({
      playback,
      playerDismissed,
      closePlayer,
      resumeOffer:
        !catalog.audioSource && !session.roomId && resumeTrack && checkpoint.offer
          ? { ...checkpoint.offer, title: resumeTrack.title, artist: resumeTrack.artist }
          : null,
      resumeListening,
      dismissResume: checkpoint.clear,
      reopenPlayer: () => setPlayerDismissed(false),
      requestRoomExit: () => requestExit(),
      openTrack: track => {
        playback.requestAutoplay();
        handleOpenTrack(track);
      },
      prepareLocalStream: handlePrepareLocalStream
    }),
    // handleOpenTrack/handlePrepareLocalStream are
    // recreated each render (as they were in App); they read live catalog/session
    // state, so memoizing on `playback` alone keeps the value fresh without churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playback, playerDismissed, resumeTrack, checkpoint.offer]
  );

  return (
    <PlaybackContext.Provider value={value}>
      <PersistentAudio
        adoptPreparedAudio={catalog.adoptPreparedAudio}
        audioSource={catalog.audioSource}
        audioSourceGeneration={catalog.audioSourceGeneration}
        localAudioRef={catalog.localAudioRef}
        remoteAudioRef={session.remoteAudioRef}
        playback={playback}
        onPrepareLocalStream={handlePrepareLocalStream}
        onEmitPlayerState={session.emitPlayerState}
      />
      {children}
      {pendingExit && pendingExit.roomId === session.roomId && (
        <RoomCloseDialog
          isHost={session.mode === 'host'}
          listenerCount={activeListenerCount}
          onCancel={() => setPendingExit(null)}
          onConfirm={() => exitRoom(pendingExit.dismissPlayer)}
        />
      )}
    </PlaybackContext.Provider>
  );
}

export function usePlaybackContext(): PlaybackValue {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error('usePlaybackContext must be used within a PlaybackProvider.');
  return value;
}
