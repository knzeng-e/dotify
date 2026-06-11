import { BadgeCheck, Disc3, Heart, KeyRound, LockKeyhole, RefreshCw, Upload } from 'lucide-react';
import { Avatar } from '../../components/Presence';
import { catalogAccessLabel, formatPaymentDate, formatWeiAsDot, shorten } from '../../utils/format';
import type { CatalogTrack, RoyaltyPayment } from '../../types';

type OverviewTabProps = {
  artistName: string;
  activeEvmAddress: `0x${string}`;
  artistRuntimeAddress: `0x${string}` | null;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  artistSetupState: string;
  artistTracks: CatalogTrack[];
  connectedWallet: { label: string } | null;
  royaltyPayments: RoyaltyPayment[];
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onSetArtistTab: (tab: 'overview' | 'new' | 'releases' | 'royalties' | 'advanced') => void;
  onShowWalletModal: () => void;
  onOpenTrack: (track: CatalogTrack) => void;
};

export function OverviewTab({
  artistName,
  artistRuntimeAddress,
  artistRegistrationStatus,
  isRegisteringArtist,
  isRefreshingArtistRuntime,
  artistRegistrationAvailable,
  artistTracks,
  connectedWallet,
  royaltyPayments,
  totalRoyaltyWei,
  uniqueRoyaltyListeners,
  onUpdateArtistName,
  onRegisterArtist,
  onRefreshArtistRuntime,
  onSetArtistTab,
  onShowWalletModal
}: OverviewTabProps) {
  const earnedDot = formatWeiAsDot(totalRoyaltyWei);

  return (
    <section className='content-grid artist-overview-grid'>
      <div className='studio-overview-main'>
        <div className='studio-metric-row'>
          <div className='studio-metric doc-panel'>
            <strong className='tnum'>{artistTracks.length}</strong>
            <span>Releases</span>
          </div>
          <div className='studio-metric doc-panel'>
            <strong className='tnum'>{uniqueRoyaltyListeners}</strong>
            <span>Supporters</span>
          </div>
          <div className='studio-metric doc-panel'>
            <strong className='tnum'>
              {earnedDot} <small>DOT</small>
            </strong>
            <span>Earned - paid direct</span>
          </div>
        </div>

        <div className='doc-panel studio-releases-panel'>
          <div className='studio-panel-head'>
            <p className='studio-section-title'>Your releases</p>
            <button className='secondary-action compact-action' type='button' onClick={() => onSetArtistTab('new')}>
              <Upload size={15} />
              New release
            </button>
          </div>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => (
              <button className='studio-release-row' type='button' key={track.id} onClick={() => onSetArtistTab('releases')}>
                <img src={track.imageRef} alt='' crossOrigin='anonymous' />
                <span className='studio-release-meta'>
                  <strong>{track.title}</strong>
                  <small>{catalogAccessLabel(track)}</small>
                </span>
              </button>
            ))
          ) : (
            <div className='empty-state'>No release yet. Publish your first track to your runtime.</div>
          )}
        </div>

        <div className='doc-panel studio-support-panel'>
          <p className='studio-section-title'>Latest support</p>
          {royaltyPayments.length > 0 ? (
            royaltyPayments.slice(0, 4).map(payment => (
              <div className='studio-support-row' key={payment.id}>
                <Avatar name={payment.listener} size={36} />
                <div className='studio-support-meta'>
                  <strong>{shorten(payment.listener, 12)}</strong>
                  <span>unlocked {payment.trackTitle}</span>
                </div>
                <div className='studio-support-amount'>
                  <strong>+{payment.amountDot} DOT</strong>
                  <small>{formatPaymentDate(payment.paidAtMs)}</small>
                </div>
              </div>
            ))
          ) : (
            <div className='empty-state'>No paid unlock recorded yet.</div>
          )}
        </div>
      </div>

      <aside className='doc-panel sovereign-card'>
        <h3>You own this space</h3>
        <p className='sovereign-lede'>Not a profile on a platform - a runtime that is yours.</p>
        <div className='sov-item'>
          <span className='sov-ic'>
            <KeyRound size={16} />
          </span>
          <div>
            <strong>You hold the keys</strong>
            <span>Your catalog cannot be quietly taken down or re-listed without you.</span>
          </div>
        </div>
        <div className='sov-item'>
          <span className='sov-ic'>
            <LockKeyhole size={16} />
          </span>
          <div>
            <strong>You set the access</strong>
            <span>Free for verified humans, or a price in DOT - per track, your call.</span>
          </div>
        </div>
        <div className='sov-item'>
          <span className='sov-ic'>
            <Heart size={16} />
          </span>
          <div>
            <strong>Value flows to you</strong>
            <span>Payments land in your wallet directly, split how you define. No middle cut.</span>
          </div>
        </div>

        <div className='sovereign-settings'>
          <label>
            <span>Artist name</span>
            <input className='field' value={artistName} onChange={event => onUpdateArtistName(event.target.value)} />
          </label>
          <p className='rights-status'>{artistRegistrationStatus}</p>
          {!connectedWallet ? (
            <button className='primary-action wide' type='button' onClick={onShowWalletModal}>
              <LockKeyhole size={16} />
              Use my wallet
            </button>
          ) : artistRuntimeAddress ? (
            <button className='primary-action wide' type='button' onClick={() => onSetArtistTab('new')}>
              <Upload size={16} />
              Publish a release
            </button>
          ) : (
            <button
              className='primary-action wide'
              type='button'
              onClick={onRegisterArtist}
              disabled={isRegisteringArtist || !artistRegistrationAvailable}
            >
              {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <BadgeCheck size={16} />}
              Create artist profile
            </button>
          )}
          <button
            className='secondary-action'
            type='button'
            onClick={onRefreshArtistRuntime}
            disabled={isRefreshingArtistRuntime || !artistRegistrationAvailable}
          >
            {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
            {isRefreshingArtistRuntime ? 'Refreshing...' : 'Refresh status'}
          </button>
        </div>
      </aside>
    </section>
  );
}
