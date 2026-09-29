import { Play, X } from 'lucide-react';
import { useCatalogContext, usePlaybackContext } from '../app/providers';
import { catalogAccessAriaLabel } from '../shared/utils/format';
import { CoverImage } from './CoverImage';
import { Dialog } from './Dialog';

// This is the controller's next selection, not a separate queue or autoplay
// policy. Opening any release still uses the normal access-checked path.
export function PlayerQueueDialog({ onClose }: { onClose: () => void }) {
  const catalog = useCatalogContext();
  const { playback, openTrack } = usePlaybackContext();
  const next = playback.repeatEnabled ? undefined : catalog.catalogTracks.find(track => track.id === playback.nextTrackId);
  const current = catalog.catalogTracks.find(track => track.id === catalog.selectedTrackId);
  const tracks = catalog.catalogTracks.filter(track => track.id !== current?.id && track.id !== next?.id);
  const choices = next ? [next, ...tracks] : tracks;
  return (
    <Dialog labelledBy='player-queue-title' className='player-queue-dialog' onClose={onClose}>
      <div className='modal-header'>
        <h2 id='player-queue-title'>Queue</h2>
        <button className='modal-close' type='button' onClick={onClose} aria-label='Close queue'>
          <X size={18} />
        </button>
      </div>
      {current && (
        <p className='queue-current'>
          {playback.repeatEnabled ? 'Repeating' : 'Now playing'}: {current.title}
        </p>
      )}
      <ul className='player-queue-list'>
        {choices.map((track, index) => (
          <li key={track.id}>
            {index === (next ? 1 : 0) && <h3>More music</h3>}
            <button
              type='button'
              onClick={() => {
                onClose();
                openTrack(track);
              }}
              onPointerEnter={() => catalog.prefetchTrackAudio(track)}
              onPointerDown={() => catalog.prefetchTrackAudio(track)}
              onFocus={() => catalog.prefetchTrackAudio(track)}
              aria-label={`Open ${track.title}, ${catalogAccessAriaLabel(track, catalog.catalogAccessByTrackId[track.id] === true, catalog.nativeRuntimePaymentAsset.symbol)}`}
            >
              <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} sizes='48px' />
              <span>
                {track.id === next?.id && <small>{playback.shuffleEnabled ? 'Next shuffled track' : 'Up next'}</small>}
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </span>
              <Play size={18} aria-hidden='true' />
            </button>
          </li>
        ))}
      </ul>
      {!choices.length && <p>No other tracks available.</p>}
    </Dialog>
  );
}
