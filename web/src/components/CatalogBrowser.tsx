import { ArrowLeft, ArrowRight, Library, Search, X } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { TrackArtworkButton } from './TrackArtworkButton';
import { DotBirth } from './DotBirth';
import { auraStyleForTrack } from '../shared/utils/aura';
import { catalogAccessAriaLabel, normalizeDisplayText } from '../shared/utils/format';
import type { CatalogTrack } from '../shared/types';

// In-memory navigation state only. No listening/search history is persisted.
export type CatalogJourney = { query: string; showAll: boolean; left: number; top: number; target: string | null };
export const emptyCatalogJourney = (): CatalogJourney => ({ query: '', showAll: false, left: 0, top: 0, target: null });

type CatalogBrowserProps = {
  journey: MutableRefObject<CatalogJourney>;
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  nativePaymentSymbol: string;
  onOpenTrack: (track: CatalogTrack) => void;
  onPlayTrack: (track: CatalogTrack) => void;
  onTrackIntent: (track: CatalogTrack) => void;
  roomGuest: boolean;
  onOpenArtist: (artist: string) => void;
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function CatalogBrowser({
  journey,
  catalogTracks,
  catalogStatus,
  selectedTrackId,
  catalogAccessByTrackId,
  nativePaymentSymbol,
  onOpenTrack,
  onPlayTrack,
  onTrackIntent,
  roomGuest,
  onOpenArtist
}: CatalogBrowserProps) {
  const [query, setQueryState] = useState(journey.current.query);
  const [showAll, setShowAll] = useState(journey.current.showAll);
  const previousLayout = useRef<string | null>(null);
  const setQuery = (value: string) => {
    journey.current.query = value;
    journey.current.target = null;
    setQueryState(value);
  };
  const rememberTarget = (target: string) => {
    journey.current.target = target;
    journey.current.top = window.scrollY;
  };
  const [edges, setEdges] = useState({ start: true, end: true });
  const listRef = useRef<HTMLDivElement>(null);
  const tracks = useMemo(() => {
    const term = fold(query.trim());
    return catalogTracks.filter(track => fold(`${track.title} ${track.artist}`).includes(term));
  }, [catalogTracks, query]);
  const trackIds = tracks.map(track => track.id).join('|');
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const layout = `${showAll}:${trackIds}`;
    if (previousLayout.current === null || previousLayout.current === layout) {
      list.scrollLeft = journey.current.left;
      const target = Array.from(list.querySelectorAll<HTMLElement>('[data-catalog-target]')).find(
        element => element.dataset.catalogTarget === journey.current.target
      );
      target?.focus({ preventScroll: true });
      window.scrollTo({ top: journey.current.top, behavior: 'instant' });
    } else {
      list.scrollLeft = 0;
    }
    previousLayout.current = layout;
    const rememberScroll = () => {
      journey.current.top = window.scrollY;
    };
    const measure = () => {
      journey.current.left = list.scrollLeft;
      const next = { start: list.scrollLeft <= 2, end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 2 };
      setEdges(previous => (previous.start === next.start && previous.end === next.end ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('scroll', rememberScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', rememberScroll);
      list.removeEventListener('scroll', measure);
    };
  }, [trackIds, showAll, journey]);
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
          <button
            className='catalog-view-toggle'
            type='button'
            aria-pressed={showAll}
            onClick={() => {
              journey.current.showAll = !showAll;
              journey.current.target = null;
              setShowAll(!showAll);
            }}
          >
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
      <p className='catalog-results-count' role='status' hidden={!query}>
        {query ? `${tracks.length} matching tracks` : null}
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
            const title = normalizeDisplayText(track.title);
            const artist = normalizeDisplayText(track.artist);
            const accessDescription = catalogAccessAriaLabel(track, accessGranted, nativePaymentSymbol);

            return (
              <article
                className='catalogue-card'
                data-selected={selectedTrackId === track.id}
                data-testid='track-card'
                key={track.id}
                style={auraStyleForTrack(track) as CSSProperties}
              >
                <TrackArtworkButton
                  track={track}
                  canPlay={accessGranted && !roomGuest}
                  accessCue={accessDescription}
                  target={`cover:${track.id}`}
                  onIntent={() => onTrackIntent(track)}
                  onActivate={() => {
                    rememberTarget(`cover:${track.id}`);
                    if (accessGranted && !roomGuest) onPlayTrack(track);
                    else onOpenTrack(track);
                  }}
                />
                <div className='catalogue-card-copy'>
                  <button
                    className='catalogue-card-open'
                    type='button'
                    data-testid='track-card-open'
                    data-catalog-target={`track:${track.id}`}
                    aria-label={`Open ${title} by ${artist}, ${accessDescription}`}
                    onClick={() => {
                      rememberTarget(`track:${track.id}`);
                      void onOpenTrack(track);
                    }}
                  >
                    {title}
                  </button>
                  <button
                    className='artist-text-button'
                    type='button'
                    data-catalog-target={`artist:${track.id}`}
                    onClick={() => {
                      rememberTarget(`artist:${track.id}`);
                      onOpenArtist(track.artist);
                    }}
                  >
                    {artist}
                  </button>
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
