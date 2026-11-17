import { ArrowRight, Play } from 'lucide-react';
import { usePlaybackContext } from '../app/providers/PlaybackProvider';
import { CoverImage } from './CoverImage';
import type { CatalogTrack } from '../shared/types';

// One listening affordance for every cover. Protected releases still open their
// terms and room guests inspect details; the icon never grants access itself.
export function TrackArtworkButton({
  track,
  canPlay,
  onActivate,
  onIntent,
  target,
  accessCue
}: {
  track: CatalogTrack;
  canPlay: boolean;
  onActivate: () => void;
  onIntent?: () => void;
  target?: string;
  accessCue?: string;
}) {
  const { pausedTrackProgress } = usePlaybackContext();
  const progress = canPlay && pausedTrackProgress?.trackId === track.id ? pausedTrackProgress.percent : null;
  return (
    <button
      className='track-artwork-button'
      type='button'
      onClick={onActivate}
      onPointerEnter={onIntent}
      onPointerDown={onIntent}
      onFocus={onIntent}
      data-catalog-target={target}
      data-testid='track-artwork-action'
      aria-label={`${canPlay ? 'Play' : 'View listening options for'} ${track.title} by ${track.artist}${accessCue ? `, ${accessCue}` : ''}${progress !== null ? ', resume paused listening' : ''}`}
    >
      <CoverImage className='catalogue-cover' src={track.imageRef} alt='' fallbackLabel={track.title} loading='lazy' sizes='(max-width: 520px) 42vw, 190px' />
      {progress !== null && (
        <span className='track-artwork-progress' data-testid='track-resume-progress' aria-hidden='true'>
          <span style={{ width: `${progress}%` }} />
        </span>
      )}
      <span className='track-artwork-action' aria-hidden='true'>
        {canPlay ? <Play size={24} fill='currentColor' /> : <ArrowRight size={24} />}
      </span>
    </button>
  );
}
