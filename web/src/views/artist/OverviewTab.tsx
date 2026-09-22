import { Disc3, Heart, KeyRound, LockKeyhole, RefreshCw, Upload, UserRoundPlus } from 'lucide-react';
import { CoverImage } from '../../components/CoverImage';
import { Avatar } from '../../components/Presence';
import { catalogAccessLabel, formatPaymentDate, formatWeiAsDot, shorten } from '../../shared/utils/format';
import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';

type OverviewTabProps = {
  artistName: string;
  activeEvmAddress: `0x${string}`;
  artistRuntimeAddress: `0x${string}` | null;
  artistRegistrationStatus: string;
  isRegisteringArtist: boolean;
  isRefreshingArtistRuntime: boolean;
  artistRegistrationAvailable: boolean;
  artistTracks: CatalogTrack[];
  nativePaymentSymbol: string;
  connectedWallet: { label: string } | null;
  royaltyPayments: RoyaltyPayment[];
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  onUpdateArtistName: (name: string) => void;
  onRegisterArtist: () => void;
  onRefreshArtistRuntime: () => void;
  onSetArtistTab: (tab: 'overview' | 'new' | 'releases' | 'royalties' | 'advanced') => void;
  onShowWalletModal: () => void;
  onOpenRelease: (track: CatalogTrack) => void;
};

export function OverviewTab({
  artistName,
  artistRuntimeAddress,
  artistRegistrationStatus,
  isRegisteringArtist,
  isRefreshingArtistRuntime,
  artistRegistrationAvailable,
  artistTracks,
  nativePaymentSymbol,
  connectedWallet,
  royaltyPayments,
  totalRoyaltyWei,
  uniqueRoyaltyListeners,
  onUpdateArtistName,
  onRegisterArtist,
  onRefreshArtistRuntime,
  onSetArtistTab,
  onShowWalletModal,
  onOpenRelease
}: OverviewTabProps) {
  const earnedDot = formatWeiAsDot(totalRoyaltyWei);
  const isNewArtist = artistTracks.length === 0 && uniqueRoyaltyListeners === 0 && totalRoyaltyWei === 0n;
  function supportSettlementLabel(payment: RoyaltyPayment): string {
    switch (payment.settlement) {
      case 'paid':
        return 'settled';
      case 'claimable':
        return 'claimable';
      case 'claimed':
        return 'claimed';
      case 'legacy':
        return 'legacy access';
    }
  }

  return (
    <section className='content-grid artist-overview-grid'>
      <div className='studio-overview-main'>
        <div className='doc-panel studio-next-step' data-first-release={isNewArtist}>
          <div>
            <span className='studio-next-label'>Your next step</span>
            <h2>{isNewArtist ? 'Publish your first release' : 'Share another release'}</h2>
            <p>
              {isNewArtist
                ? 'Add your music, choose who can listen, and review where support goes before you approve anything.'
                : 'Prepare the music and its listening terms, then review everything once before publishing.'}
            </p>
          </div>
          <button className='primary-action compact-action' type='button' onClick={() => onSetArtistTab('new')} disabled={!artistRegistrationAvailable}>
            <Upload size={16} />
            {artistRegistrationAvailable ? (isNewArtist ? 'Start your first release' : 'New release') : 'Publishing paused'}
          </button>
        </div>

        {!isNewArtist && (
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
                {earnedDot} <small>{nativePaymentSymbol}</small>
              </strong>
              <span>Received</span>
            </div>
          </div>
        )}

        <div className='doc-panel studio-releases-panel'>
          <div className='studio-panel-head'>
            <p className='studio-section-title'>Your releases</p>
          </div>
          {artistTracks.length > 0 ? (
            artistTracks.map(track => (
              <button className='studio-release-row' type='button' key={track.id} onClick={() => onOpenRelease(track)}>
                <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} />
                <span className='studio-release-meta'>
                  <strong>{track.title}</strong>
                  <small>{catalogAccessLabel(track, nativePaymentSymbol)}</small>
                </span>
              </button>
            ))
          ) : (
            <div className='empty-state'>Your published music will appear here.</div>
          )}
        </div>

        <div className='doc-panel studio-support-panel'>
          <p className='studio-section-title'>Latest support</p>
          {royaltyPayments.length > 0 ? (
            royaltyPayments.slice(0, 4).map(payment => {
              const settlementLabel = supportSettlementLabel(payment);

              return (
                <div className='studio-support-row' data-settlement={payment.settlement} key={payment.id}>
                  <Avatar name={payment.listener} size={36} />
                  <div className='studio-support-meta'>
                    <strong>{shorten(payment.listener, 12)}</strong>
                    <span>
                      supported and opened {payment.trackTitle} - {settlementLabel}
                    </span>
                  </div>
                  <div className='studio-support-amount'>
                    <strong>
                      {payment.settlement === 'paid' || payment.settlement === 'claimed' ? '+' : ''}
                      {payment.amountDot} {nativePaymentSymbol}
                    </strong>
                    <small>{formatPaymentDate(payment.paidAtMs)}</small>
                  </div>
                </div>
              );
            })
          ) : (
            <div className='empty-state'>No paid support recorded yet.</div>
          )}
        </div>
      </div>

      <aside className='doc-panel sovereign-card'>
        <h3>Your music, your choices</h3>
        <p className='sovereign-lede'>The connected artist account is the only one that can approve changes to these releases.</p>
        <div className='sov-item'>
          <span className='sov-ic'>
            <KeyRound size={16} />
          </span>
          <div>
            <strong>You approve changes</strong>
            <span>You choose when a release is active and how listeners can open it.</span>
          </div>
        </div>
        <div className='sov-item'>
          <span className='sov-ic'>
            <LockKeyhole size={16} />
          </span>
          <div>
            <strong>You choose listening access</strong>
            <span>Free for everyone, free with human verification, or opened through direct support in {nativePaymentSymbol}.</span>
          </div>
        </div>
        <div className='sov-item'>
          <span className='sov-ic'>
            <Heart size={16} />
          </span>
          <div>
            <strong>You choose where support goes</strong>
            <span>Your release names each recipient and share. Any network fee is shown before approval.</span>
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
              Use my account
            </button>
          ) : !artistRuntimeAddress ? (
            <button className='primary-action wide' type='button' onClick={onRegisterArtist} disabled={isRegisteringArtist || !artistRegistrationAvailable}>
              {isRegisteringArtist ? <Disc3 size={16} className='spin' /> : <UserRoundPlus size={16} />}
              Create artist profile
            </button>
          ) : null}
          <button
            className='secondary-action'
            type='button'
            onClick={onRefreshArtistRuntime}
            disabled={isRefreshingArtistRuntime || (!artistRegistrationAvailable && !artistRuntimeAddress)}
          >
            {isRefreshingArtistRuntime ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
            {isRefreshingArtistRuntime ? 'Refreshing...' : 'Refresh status'}
          </button>
        </div>
      </aside>
    </section>
  );
}
