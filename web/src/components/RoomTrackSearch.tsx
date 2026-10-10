import { Music2, Plus, Search } from 'lucide-react';
import { useId, useMemo } from 'react';
import type { CatalogTrack } from '../shared/types';
import { searchRoomCatalog } from '../features/rooms/roomCatalogSearch';
import { CoverImage } from './CoverImage';

export function RoomTrackSearch({
  tracks,
  query,
  onQueryChange,
  onPick,
  label,
  action,
  disabled = false,
  selected = false
}: {
  tracks: CatalogTrack[];
  query: string;
  onQueryChange: (value: string) => void;
  onPick: (track: CatalogTrack) => void;
  label: string;
  action: string;
  disabled?: boolean;
  selected?: boolean;
}) {
  const id = useId();
  const matches = useMemo(() => searchRoomCatalog(tracks, query), [tracks, query]);
  return (
    <div className='room-track-search'>
      <label className='sr-only' htmlFor={id}>
        {label}
      </label>
      <div className='room-track-search-field'>
        <Search size={18} aria-hidden='true' />
        <input
          id={id}
          className='field'
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={label}
          autoComplete='off'
          disabled={disabled}
        />
      </div>
      {!selected && (
        <>
          <ul className='room-track-results' aria-label={`${label} results`}>
            {matches.slice(0, 6).map(track => (
              <li key={track.id}>
                <button type='button' disabled={disabled} onClick={() => onPick(track)} aria-label={`${action} ${track.title} by ${track.artist}`}>
                  <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} sizes='40px' />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                  {action === 'Add to queue' ? <Plus size={17} aria-hidden='true' /> : <Music2 size={17} aria-hidden='true' />}
                </button>
              </li>
            ))}
          </ul>
          <p className='room-track-search-hint' role='status'>
            {matches.length === 0
              ? 'No matching track in the available catalog. Try another title or artist.'
              : matches.length > 6
                ? `Showing 6 of ${matches.length} tracks. Type a title or artist to narrow the list.`
                : 'Choose a track from the catalog.'}
          </p>
        </>
      )}
    </div>
  );
}
