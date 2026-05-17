import { Library } from 'lucide-react';
import { PanelTitle } from '../../components/ui/PanelTitle';
import { accessModeLabel } from '../../utils/format';
import type { CatalogTrack } from '../../types';

type ReleasesTabProps = {
  artistTracks: CatalogTrack[];
  onOpenTrack: (track: CatalogTrack) => void;
};

export function ReleasesTab({ artistTracks, onOpenTrack }: ReleasesTabProps) {
  return (
    <section className='content-grid releases-grid'>
      <div className='doc-panel releases-panel'>
        <PanelTitle icon={Library} title='My releases' meta={`${artistTracks.length} releases`} />
        <div className='catalogue-table release-table'>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => (
              <button
                className='catalogue-row'
                key={track.hash}
                type='button'
                onClick={() => {
                  void onOpenTrack(track);
                }}
              >
                <img className='track-thumb' src={track.imageRef} alt='' crossOrigin='anonymous' />
                <span>
                  <strong>{track.title}</strong>
                  <small>
                    {track.artist} / {accessModeLabel(track)} / {track.durationLabel}
                  </small>
                </span>
                <code>{track.accessMode === 'classic' ? `${track.priceDot} DOT` : track.personhoodLevel}</code>
              </button>
            ))
          ) : (
            <div className='empty-state'>No releases registered for this artist wallet yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
