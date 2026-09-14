import { ArrowLeft, ArrowRight, CircleCheckBig, Headphones, KeyRound, Library, Search, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CoverImage } from './CoverImage';
import { DotBirth } from './DotBirth';
import { auraStyleForTrack } from '../shared/utils/aura';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../shared/utils/format';
import type { CatalogTrack } from '../shared/types';

type CatalogBrowserProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  nativePaymentSymbol: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onOpenArtist: (artist: string) => void;
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

export function CatalogBrowser({
  catalogTracks,
  catalogStatus,
  selectedTrackId,
  catalogAccessByTrackId,
  nativePaymentSymbol,
  onOpenTrack,
  onOpenArtist
}: CatalogBrowserProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });
  const listRef = useRef<HTMLDivElement>(null);
  const tracks = useMemo(() => {
    const term = fold(query.trim());
    return catalogTracks.filter(track => fold(`${track.title} ${track.artist}`).includes(term));
  }, [catalogTracks, query]);
  const trackIds = tracks.map(track => track.id).join('|');
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollLeft = 0;
    const measure = () => {
      const next = { start: list.scrollLeft <= 2, end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 2 };
      setEdges(previous => (previous.start === next.start && previous.end === next.end ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', measure);
    };
  }, [trackIds, showAll]);
  const move = (direction: number) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * list.clientWidth * 0.85,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  };
  return (
    <div className='catalog-browser'>
      <div className='catalog-browser-tools'>
        <div className='catalog-search'>
          <Search size={18} aria-hidden='true' />
          <input
            className='field'
            type='search'
            aria-label='Find a track or artist'
            placeholder='Find a track or artist'
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          {query && (
            <button type='button' aria-label='Clear music search' onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className='catalog-browse-actions'>
          <button className='catalog-view-toggle' type='button' aria-pressed={showAll} onClick={() => setShowAll(value => !value)}>
            {showAll ? 'Show as a row' : 'Show all tracks'}
          </button>
          {!showAll && (
            <div className='catalog-row-controls' aria-label='Browse tracks'>
              <button type='button' aria-label='Previous tracks' disabled={edges.start} onClick={() => move(-1)}>
                <ArrowLeft size={18} />
              </button>
              <button type='button' aria-label='Next tracks' disabled={edges.end} onClick={() => move(1)}>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className='catalog-results-count' role='status'>
        {query ? `${tracks.length} matching tracks` : 'Find your next listening moment.'}
      </p>
      <div
        ref={listRef}
        className='catalogue-grid'
        data-layout={showAll ? 'grid' : 'row'}
        role='region'
        aria-label='Music catalog'
        tabIndex={showAll ? undefined : 0}
        onKeyDown={event => {
          if (showAll || event.target !== event.currentTarget) return;
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            move(event.key === 'ArrowRight' ? 1 : -1);
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            event.currentTarget.scrollLeft = event.key === 'Home' ? 0 : event.currentTarget.scrollWidth;
          }
        }}
      >
        {tracks.length > 0 ? (
          tracks.map(track => {
            const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;
            const accessGranted = track.active !== false && (track.accessMode === 'free' || hasCatalogAccess);

            return (
              <article
                className='catalogue-card'
                data-selected={selectedTrackId === track.id}
                data-testid='track-card'
                key={track.id}
                style={auraStyleForTrack(track) as CSSProperties}
              >
                <span className='catalogue-cover-frame'>
                  <CoverImage className='catalogue-cover' src={track.imageRef} alt='' fallbackLabel={track.title} />
                  <span className='catalogue-card-action' aria-hidden='true'>
                    <Headphones size={18} />
                  </span>
                </span>
                <div className='catalogue-card-copy'>
                  <button
                    className='catalogue-card-open'
                    type='button'
                    data-testid='track-card-open'
                    aria-label={`Open ${track.title} by ${track.artist}`}
                    onClick={() => void onOpenTrack(track)}
                  >
                    {track.title}
                  </button>
                  <button className='artist-text-button' type='button' onClick={() => onOpenArtist(track.artist)}>
                    {track.artist}
                  </button>
                  <p className='catalogue-card-description'>{track.description || 'A track ready for listening, rooms, and direct artist support.'}</p>
                </div>
                <div
                  className='catalogue-access-line'
                  data-access={accessGranted ? 'granted' : 'locked'}
                  aria-label={catalogAccessAriaLabel(track, hasCatalogAccess, nativePaymentSymbol)}
                >
                  <span>
                    {accessGranted ? <CircleCheckBig size={15} /> : track.accessMode === 'classic' ? <Wallet size={15} /> : <KeyRound size={15} />}
                    {catalogAccessLabel(track, nativePaymentSymbol)}
                  </span>
                  <ArrowRight size={15} aria-hidden='true' />
                </div>
              </article>
            );
          })
        ) : query ? (
          <div className='catalogue-empty'>
            <Search size={20} />
            <span>No tracks match “{query}”. Try another title or artist.</span>
          </div>
        ) : catalogStatus === 'Loading registry catalog' ? (
          <DotBirth size='panel' label='Finding the music…' />
        ) : (
          <div className='catalogue-empty'>
            <Library size={20} />
            <span>{catalogStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
