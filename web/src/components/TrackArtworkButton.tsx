import { Play } from 'lucide-react';
import { CoverImage } from './CoverImage';
import type { CatalogTrack } from '../shared/types';

// One listening affordance for every cover. Protected releases still open their
// terms and room guests inspect details; the icon never grants access itself.
export function TrackArtworkButton({
  track,
  canPlay,
  onActivate,
  target,
  accessCue
}: {
  track: CatalogTrack;
  canPlay: boolean;
  onActivate: () => void;
  target?: string;
  accessCue?: string;
}) {
  return (
    <button
      className='track-artwork-button'
      type='button'
      onClick={onActivate}
      data-catalog-target={target}
      data-testid='track-artwork-action'
      aria-label={`${canPlay ? 'Play' : 'View listening options for'} ${track.title} by ${track.artist}${accessCue ? `, ${accessCue}` : ''}`}
    >
      <CoverImage className='catalogue-cover' src={track.imageRef} alt='' fallbackLabel={track.title} loading='lazy' sizes='(max-width: 520px) 42vw, 190px' />
      <span className='track-artwork-action' aria-hidden='true'>
        <Play size={24} fill='currentColor' />
      </span>
    </button>
  );
}
