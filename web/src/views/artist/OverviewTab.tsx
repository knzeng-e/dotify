import { useState } from 'react';
import { ArrowRight, Disc3, RefreshCw, Upload, UserRoundPlus } from 'lucide-react';
import { formatPaymentDate } from '../../shared/utils/format';
import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';
import type { ReleaseEarnings } from '../../features/artist-studio/earnings';
import { EarningsSummary, type EarningsSummaryProps } from './EarningsSummary';
import { ReleaseEarningsList } from './ReleaseEarningsList';

type OverviewTabProps = {
  artistName: string;
  artistRuntimeAddress: `0x${string}` | null;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  royaltyPayments: RoyaltyPayment[];
  earnings: EarningsSummaryProps;
  releases: ReleaseEarnings[];
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onSetArtistTab: (tab: 'overview' | 'new' | 'releases' | 'royalties' | 'advanced') => void;
  onOpenRelease: (track: CatalogTrack) => void;
};

export function OverviewTab({
  artistName,
  artistRuntimeAddress,
  artistRegistrationStatus,
  isRegisteringArtist,
  isRefreshingArtistRuntime,
  artistRegistrationAvailable,
  royaltyPayments,
  earnings,
  releases,
  onUpdateArtistName,
  onRegisterArtist,
  onRefreshArtistRuntime,
  onSetArtistTab,
  onOpenRelease
}: OverviewTabProps) {
  const [registrationConsented, setRegistrationConsented] = useState(false);
  const needsArtistProfile = !artistRuntimeAddress;
  const isNewArtist = !needsArtistProfile && releases.length === 0;
  const hasEarningsActivity = royaltyPayments.length > 0 || earnings.generatedWei > 0n || earnings.claimableWei > 0n;
  const canRegisterProfile = artistRegistrationAvailable && artistName.trim().length > 0 && registrationConsented && !isRegisteringArtist;
  return (
    <div className='studio-overview'>
      {needsArtistProfile && (
        <section className='studio-profile-setup' aria-labelledby='studio-profile-setup-title'>
          <div>
            <span className='studio-next-label'>Your own releases</span>
            <h2 id='studio-profile-setup-title'>Create your artist space</h2>
            <p>This account can receive collaborator support already. Create your own space when you are ready to publish music under this account.</p>
          </div>
          <div className='studio-profile-setup-form'>
            <label>
              <span>Artist name</span>
              <input className='field' value={artistName} onChange={event => onUpdateArtistName(event.target.value)} placeholder='Your artist name' />
            </label>
            <label className='consent-row'>
              <input
                type='checkbox'
                className='consent-checkbox'
                checked={registrationConsented}
                onChange={event => setRegistrationConsented(event.target.checked)}
              />
              <span>I understand and consent to shared listening on Dotify.</span>
            </label>
            <button className='primary-action compact-action' type='button' onClick={onRegisterArtist} disabled={!canRegisterProfile}>
              {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <UserRoundPlus size={16} />}
              {isRegisteringArtist ? 'Creating...' : 'Create artist profile'}
            </button>
            {!artistRegistrationAvailable && <p className='registration-guidance'>{artistRegistrationStatus}</p>}
          </div>
        </section>
      )}
      {isNewArtist && (
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
      )}
      {(!isNewArtist || hasEarningsActivity) && <EarningsSummary {...earnings} />}

      <div className='studio-overview-columns'>
        <section className='studio-works'>
          <div className='studio-section-head'>
            <h2>Your releases</h2>
            {releases.length > 0 && (
              <button className='text-action' onClick={() => onSetArtistTab('releases')}>
                View all <ArrowRight size={16} />
              </button>
            )}
          </div>
          {releases.length === 0 ? (
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
