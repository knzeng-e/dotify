import { Pause, Play } from 'lucide-react';
import { useCatalogContext } from '../app/providers/CatalogProvider';
import { usePlaybackContext } from '../app/providers/PlaybackProvider';
import { useSessionContext } from '../app/providers/SessionProvider';
import { playbackTrack } from '../features/player/playbackPresentation';
import { transportProgressPercent } from '../features/player/playbackStatus';
import { formatTime } from '../shared/utils/format';
import { CoverImage } from './CoverImage';

/** One stable listening anchor inside discovery sheets; never owns an audio source. */
export function ListeningNowPlaying() {
  const catalog = useCatalogContext();
  const { playback, playerDismissed } = usePlaybackContext();
  const session = useSessionContext();
  const selected = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const track = playbackTrack(session.mode, catalog.trackInfo, selected);
  if (!track || playerDismissed || (!session.roomId && !catalog.audioSource)) return null;
  const duration = playback.transport.duration || track.duration || 0;
  const guest = session.mode === 'listener' && Boolean(session.roomId);
  return (
    <aside className='listening-now-playing' aria-label='Current listening'>
      <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} sizes='44px' />
      <div className='listening-now-copy'>
        <small>{session.roomId ? 'Listening together' : playback.repeatEnabled ? 'Repeating' : 'Now playing'}</small>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
      <button
        className='icon-action'
        type='button'
        disabled={!playback.canUseTransport}
        onClick={() => void playback.togglePlay()}
        aria-label={
          guest
            ? playback.transport.playing
              ? 'Pause for me'
              : 'Resume room audio'
            : playback.transport.playing
              ? 'Pause current track'
              : 'Play current track'
        }
      >
        {playback.transport.playing ? <Pause size={22} /> : <Play size={22} />}
      </button>
      <progress
        max={100}
        value={transportProgressPercent(playback.transport.currentTime, duration)}
        aria-label='Listening progress'
        aria-valuetext={`${formatTime(playback.transport.currentTime)} of ${formatTime(duration)}`}
      />
    </aside>
  );
}
