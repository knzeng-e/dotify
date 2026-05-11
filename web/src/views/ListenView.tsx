import { BadgeCheck, CircleCheckBig, Library, Wallet } from 'lucide-react';
import { PanelTitle } from '../components/ui/PanelTitle';
import { catalogAccessAriaLabel, catalogAccessLabel } from '../utils/format';
import type { CatalogTrack } from '../types';

type ListenViewProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  selectedTrackId: string;
  catalogAccessByTrackId: Record<string, boolean>;
  onOpenTrack: (track: CatalogTrack) => void;
};

export function ListenView({ catalogTracks, catalogStatus, selectedTrackId, catalogAccessByTrackId, onOpenTrack }: ListenViewProps) {
  return (
    <section className='content-grid catalog-home-grid'>
      <div className='doc-panel catalogue-panel catalogue-home-panel'>
        <PanelTitle icon={Library} title='Browse catalog' meta={`${catalogTracks.length} tracks`} />
        <p className='catalogue-intro'>Choose a cover to open the player, preview the track, and unlock full access with payment or proof.</p>
        <div className='catalogue-grid'>
          {catalogTracks.length > 0 ? (
            catalogTracks.map(track => {
              const hasCatalogAccess = catalogAccessByTrackId[track.id] === true;

              return (
                <button
                  className='catalogue-card'
                  data-selected={selectedTrackId === track.id}
                  key={track.id}
                  type='button'
                  aria-label={`Open ${track.title} by ${track.artist}`}
                  onClick={() => {
                    void onOpenTrack(track);
                  }}
                >
                  <span className='catalogue-cover-frame'>
                    <img className='catalogue-cover' src={track.imageRef} alt='' crossOrigin='anonymous' />
                  </span>
                  <span className='catalogue-card-copy'>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                    <span className='catalogue-card-description'>{track.description || 'Artist-owned release on Dotify.'}</span>
                  </span>
                  <span
                    className='catalogue-access-line'
                    data-access={hasCatalogAccess ? 'granted' : 'locked'}
                    aria-label={catalogAccessAriaLabel(track, hasCatalogAccess)}
                  >
                    {hasCatalogAccess ? <CircleCheckBig size={15} /> : <Wallet size={15} />}
                    <span>{catalogAccessLabel(track)}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className='empty-state'>{catalogStatus}</div>
          )}
        </div>
      </div>

      <div className='doc-panel home-principles-panel'>
        <PanelTitle icon={BadgeCheck} title='Access culture' meta='proof, not profiles' />
        <div className='principle-list'>
          <div>
            <strong>Preview first</strong>
            <span>Every listener can discover before deciding how to unlock.</span>
          </div>
          <div>
            <strong>Pay artists directly</strong>
            <span>Classic access shows the DOT price before payment.</span>
          </div>
          <div>
            <strong>Human free</strong>
            <span>Personhood can unlock culture without turning people into ad profiles.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
