import { ChevronDown, ChevronLeft, ChevronRight, Music2, Plus, Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { CatalogTrack } from '../shared/types';
import { searchRoomCatalog } from '../features/rooms/roomCatalogSearch';
import { CoverImage } from './CoverImage';

const PAGE_SIZE = 6;

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
  const [expanded, setExpanded] = useState(() => Boolean(query.trim()));
  const [page, setPage] = useState(0);
  const showResults = !selected && expanded;
  const matches = useMemo(() => (showResults ? searchRoomCatalog(tracks, query) : []), [tracks, query, showResults]);
  const lastPage = Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const first = currentPage * PAGE_SIZE;
  const pageTracks = matches.slice(first, first + PAGE_SIZE);
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
          onChange={event => {
            setPage(0);
            setExpanded(Boolean(event.target.value.trim()));
            onQueryChange(event.target.value);
          }}
          placeholder={label}
          autoComplete='off'
          disabled={disabled}
        />
        <button
          type='button'
          className='quiet-action room-track-browse'
          disabled={disabled}
          aria-label='Browse catalog'
          aria-expanded={showResults}
          aria-controls={showResults ? `${id}-results` : undefined}
          onClick={() => {
            setPage(0);
            if (selected) onQueryChange('');
            setExpanded(!showResults);
          }}
        >
          <ChevronDown size={18} aria-hidden='true' />
        </button>
      </div>
      {showResults && (
        <>
          <ul id={`${id}-results`} className='room-track-results' key={currentPage} aria-label={`${label} results`}>
            {pageTracks.map(track => (
              <li key={track.id}>
                <button
                  type='button'
                  disabled={disabled}
                  onClick={() => {
                    setPage(0);
                    setExpanded(false);
                    onPick(track);
                  }}
                  aria-label={`${action} ${track.title} by ${track.artist}`}
                >
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
          <div className='room-search-footer'>
            <p className='room-track-search-hint' role='status'>
              {matches.length
                ? `${first + 1}–${first + pageTracks.length} of ${matches.length} ${matches.length === 1 ? 'track' : 'tracks'}`
                : 'No matching track in the available catalog. Try another title or artist.'}
            </p>
            {lastPage > 0 && (
              <div className='room-search-pages' role='group' aria-label='Catalog result pages'>
                <button type='button' disabled={disabled || currentPage === 0} aria-label='Previous results' onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft size={18} aria-hidden='true' />
                </button>
                <button type='button' disabled={disabled || currentPage === lastPage} aria-label='Next results' onClick={() => setPage(currentPage + 1)}>
                  <ChevronRight size={18} aria-hidden='true' />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
