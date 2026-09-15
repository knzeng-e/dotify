import { ArrowRight, Play } from 'lucide-react';
import { CoverImage } from './CoverImage';
import type { CatalogTrack } from '../shared/types';

// Play means playable here. Locked releases and room guests open the existing
// listening options instead; this affordance never grants access itself.
export function TrackArtworkButton({ track, canPlay, onActivate, target }: { track: CatalogTrack; canPlay: boolean; onActivate: () => void; target?: string }) {
  return (
    <button
      className='track-artwork-button'
      type='button'
      onClick={onActivate}
      data-catalog-target={target}
      data-testid='track-artwork-action'
      aria-label={`${canPlay ? 'Play' : 'View listening options for'} ${track.title} by ${track.artist}`}
    >
      <CoverImage className='catalogue-cover' src={track.imageRef} alt='' fallbackLabel={track.title} />
      <span className='track-artwork-action' aria-hidden='true'>
        {canPlay ? <Play size={24} fill='currentColor' /> : <ArrowRight size={24} />}
      </span>
    </button>
  );
}
