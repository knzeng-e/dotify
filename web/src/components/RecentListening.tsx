import { Play, X } from 'lucide-react';
import { CoverImage } from './CoverImage';
import { trackHasAccess } from '../features/access/accessPolicy';
import type { CatalogTrack } from '../shared/types';

export function RecentListening({
  tracks,
  access,
  roomGuest,
  onPlay,
  onOpen,
  onClear
}: {
  tracks: CatalogTrack[];
  access: Record<string, boolean>;
  roomGuest: boolean;
  onPlay: (track: CatalogTrack) => void;
  onOpen: (track: CatalogTrack) => void;
  onClear: () => void;
}) {
  if (!tracks.length) return null;
  return (
    <section className='recent-listening' aria-labelledby='recent-listening-title'>
      <div className='section-heading'>
        <h2 id='recent-listening-title'>Recently played</h2>
        <button className='icon-action' type='button' onClick={onClear} aria-label='Clear recent listening' title='Clear recent listening'>
          <X size={18} />
        </button>
      </div>
      <div className='recent-listening-rail' role='region' aria-label='Recent listening' tabIndex={0}>
        {tracks.map(track => (
          <button
            key={track.id}
            className='recent-listening-track'
            type='button'
            aria-label={`${!roomGuest && trackHasAccess(track, access) ? 'Replay' : 'Open listening options for'} ${track.title} by ${track.artist}`}
            onClick={() => {
              if (!roomGuest && trackHasAccess(track, access)) onPlay(track);
              else onOpen(track);
            }}
          >
            <span className='recent-listening-art'>
              <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} />
              <Play size={24} fill='currentColor' />
            </span>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
