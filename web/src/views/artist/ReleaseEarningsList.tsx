import { ChevronRight } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import type { ReleaseEarnings } from '../../features/artist-studio/earnings';
import { formatWeiAsDot } from '../../shared/utils/format';
import type { CatalogTrack } from '../../shared/types';

export function ReleaseEarningsList({
  rows,
  known,
  symbol,
  onOpen
}: {
  rows: ReleaseEarnings[];
  known: boolean;
  symbol: string;
  onOpen: (track: CatalogTrack) => void;
}) {
  return (
    <div className='earnings-release-list'>
      <div className='earnings-release-columns' aria-hidden='true'>
        <span>Release</span>
        <span>Generated</span>
        <span>Your receipts</span>
        <span />
      </div>
      {rows.map(row => (
        <button className='earnings-release-row' type='button' key={row.track.id} onClick={() => onOpen(row.track)}>
          <span className='earnings-release-title'>
            <CoverImage src={row.track.imageRef} alt='' fallbackLabel={row.track.title} />
            <span>
              <strong>{row.track.title}</strong>
              <small>
                {row.track.active === false ? 'Inactive' : 'Published'}
                {known ? ` · ${row.payments} payment${row.payments === 1 ? '' : 's'}` : ''}
              </small>
            </span>
          </span>
          <span className='earnings-release-amount'>
            <small>Generated</small>
            {known ? `${formatWeiAsDot(row.generatedWei)} ${symbol}` : 'Unavailable'}
          </span>
          <span className='earnings-release-amount'>
            <small>Your receipts</small>
            {known ? `${formatWeiAsDot(row.receivedWei)} ${symbol}` : 'Unavailable'}
          </span>
          <ChevronRight size={17} aria-hidden='true' />
        </button>
      ))}
    </div>
  );
}
