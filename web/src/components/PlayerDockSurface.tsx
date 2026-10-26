import { useCatalogContext } from '../app/providers/CatalogProvider';
import { useNavigation } from '../app/providers/NavigationProvider';
import { usePlaybackContext } from '../app/providers/PlaybackProvider';
import { useSessionContext } from '../app/providers/SessionProvider';
import { PlayerDock } from './PlayerDock';

/** Same transport and dismissal in the listener shell and the artist studio. */
export function PlayerDockSurface({ onStartRoom }: { onStartRoom?: () => void }) {
  const catalog = useCatalogContext();
  const session = useSessionContext();
  const { playback, playerDismissed, closePlayer } = usePlaybackContext();
  const { activeView, isArtistPortal, publicArtistName, navigateToView } = useNavigation();
  if (!isArtistPortal && activeView === 'player' && !publicArtistName) return null;
  if (!catalog.trackInfo && !session.roomId) return null;
  if (playerDismissed && !playback.transport.playing && !session.roomId) return null;
  const track = catalog.catalogTracks.find(item => item.id === catalog.selectedTrackId);
  return (
    <PlayerDock
      track={track}
      trackInfo={catalog.trackInfo}
      playback={playback}
      mode={session.mode}
      roomId={session.roomId}
      hostName={session.hostName}
      listenerCount={session.listenerCount}
      listeners={session.listeners}
      socketStatus={session.socketStatus}
      locked={Boolean(session.mode !== 'listener' && track && track.accessMode === 'classic' && catalog.catalogAccessByTrackId[track.id] !== true)}
      audioStartupStatus={catalog.audioStartupStatus}
      onOpenPlayer={() => navigateToView('player')}
      onStartRoom={onStartRoom}
      onClose={closePlayer}
    />
  );
}
