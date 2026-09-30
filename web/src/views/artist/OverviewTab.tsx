import { ArrowRight, Disc3, RefreshCw, Upload } from 'lucide-react';
import { formatPaymentDate } from '../../shared/utils/format';
import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';
import type { ReleaseEarnings } from '../../features/artist-studio/earnings';
import { EarningsSummary, type EarningsSummaryProps } from './EarningsSummary';
import { ReleaseEarningsList } from './ReleaseEarningsList';

type OverviewTabProps = {
  artistName: string;
  artistRegistrationStatus: string;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  royaltyPayments: RoyaltyPayment[];
  earnings: EarningsSummaryProps;
  releases: ReleaseEarnings[];
  onUpdateArtistName: (name: string) => void;
  onRefreshArtistRuntime: () => void;
  onSetArtistTab: (tab: 'overview' | 'new' | 'releases' | 'royalties' | 'advanced') => void;
  onOpenRelease: (track: CatalogTrack) => void;
};

export function OverviewTab({
  artistName,
  artistRegistrationStatus,
  isRefreshingArtistRuntime,
  artistRegistrationAvailable,
  royaltyPayments,
  earnings,
  releases,
  onUpdateArtistName,
  onRefreshArtistRuntime,
  onSetArtistTab,
  onOpenRelease
}: OverviewTabProps) {
  const isNewArtist = releases.length === 0 && royaltyPayments.length === 0 && earnings.claimableWei === 0n;
  return (
    <div className='studio-overview'>
      {isNewArtist ? (
        <section className='studio-next-step' data-first-release='true'>
          <div>
            <span className='studio-next-label'>Your next step</span>
            <h2>Publish your first release</h2>
            <p>Add your music, choose its listening terms, and review the recipients before publishing.</p>
          </div>
          <button className='primary-action' type='button' onClick={() => onSetArtistTab('new')} disabled={!artistRegistrationAvailable}>
            <Upload size={18} />
            Start your first release
          </button>
        </section>
      ) : (
        <EarningsSummary {...earnings} />
      )}

      <div className='studio-overview-columns'>
        <section className='studio-works'>
          <div className='studio-section-head'>
            <h2>Your releases</h2>
            <button className='text-action' onClick={() => onSetArtistTab('releases')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          {isNewArtist ? (
            <p className='studio-empty'>Your published music will appear here.</p>
          ) : (
            <ReleaseEarningsList rows={releases.slice(0, 5)} known={earnings.updatedAt !== null} symbol={earnings.symbol} onOpen={onOpenRelease} />
          )}
        </section>
        <section className='studio-recent'>
          <div className='studio-section-head'>
            <h2>Recent payments</h2>
          </div>
          {royaltyPayments.slice(0, 4).map(payment => (
            <button className='studio-payment-preview' key={payment.id} onClick={() => onSetArtistTab('royalties')}>
              <span>
                <strong>{payment.trackTitle}</strong>
                <small>{formatPaymentDate(payment.paidAtMs)}</small>
              </span>
              <span>
                <strong>
                  {payment.amountDot} {earnings.symbol}
                </strong>
                <small>{payment.settlement === 'claimable' ? 'To claim' : 'Received'}</small>
              </span>
            </button>
          ))}
          {!royaltyPayments.length && (
            <p className='studio-empty'>
              {earnings.updatedAt
                ? 'Your next payment will appear here.'
                : earnings.historyState === 'unavailable'
                  ? 'Payment history is unavailable.'
                  : 'Checking payment history...'}
            </p>
          )}
        </section>
      </div>

      <details className='studio-technical studio-profile-settings'>
        <summary>Access and support choices</summary>
        <p>You approve release changes and choose where payments go. Each release keeps its registered recipients and listening terms.</p>
        <label>
          <span>Artist name</span>
          <input className='field' value={artistName} onChange={event => onUpdateArtistName(event.target.value)} />
        </label>
        <p className='rights-status'>{artistRegistrationStatus}</p>
        <button className='secondary-action' type='button' onClick={onRefreshArtistRuntime} disabled={isRefreshingArtistRuntime}>
          {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}Refresh status
        </button>
      </details>
    </div>
  );
}
