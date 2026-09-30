import { ChevronDown, Disc3, Wallet } from 'lucide-react';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { getBlockscoutAddressUrl, getBlockscoutBlockUrl, getBlockscoutTxUrl } from '../../shared/utils/explorer';
import { formatPaymentDate, formatWeiAsDot, shorten } from '../../shared/utils/format';
import type { CatalogTrack, RoyaltyPayment, RoyaltyRuntimeSummary } from '../../shared/types';
import type { ReleaseEarnings } from '../../features/artist-studio/earnings';
import { EarningsSummary, type EarningsSummaryProps } from './EarningsSummary';
import { ReleaseEarningsList } from './ReleaseEarningsList';

type RoyaltiesTabProps = {
  royaltyPayments: RoyaltyPayment[];
  royaltyStatus: string;
  claimableRoyaltyWei: bigint;
  royaltyRuntimeSummaries: RoyaltyRuntimeSummary[];
  isClaimingRoyalties: boolean;
  artistRuntimeAddress: `0x${string}` | null;
  expandedRoyaltyPaymentId: string | null;
  earnings: EarningsSummaryProps;
  releases: ReleaseEarnings[];
  onOpenRelease: (track: CatalogTrack) => void;
  nativePaymentSymbol: string;
  onSetExpandedRoyaltyPaymentId: (id: string | null) => void;
  onClaimRoyalties: () => void;
};

export function RoyaltiesTab({
  royaltyPayments,
  royaltyStatus,
  claimableRoyaltyWei,
  royaltyRuntimeSummaries,
  isClaimingRoyalties,
  artistRuntimeAddress,
  expandedRoyaltyPaymentId,
  earnings,
  releases,
  onOpenRelease,
  nativePaymentSymbol,
  onSetExpandedRoyaltyPaymentId,
  onClaimRoyalties
}: RoyaltiesTabProps) {
  const unavailableBalanceCount = royaltyRuntimeSummaries.filter(summary => summary.claimableWei === null).length;
  const hasRoyaltyRuntime = Boolean(artistRuntimeAddress || royaltyRuntimeSummaries.length > 0);

  function settlementLabel(payment: RoyaltyPayment): string {
    switch (payment.settlement) {
      case 'paid':
        return 'Paid';
      case 'claimable':
        return 'Claimable';
      case 'claimed':
        return 'Claimed';
      case 'legacy':
        return 'Legacy access';
    }
  }

  function eventDateLabel(payment: RoyaltyPayment): string {
    switch (payment.settlement) {
      case 'paid':
        return 'Paid at';
      case 'legacy':
        return 'Access paid at';
      default:
        return 'Accrued at';
    }
  }

  return (
    <section className='studio-earnings-page'>
      <EarningsSummary {...earnings} />
      {releases.length > 0 && (
        <section>
          <div className='studio-section-head'>
            <h2>By release</h2>
            <span>{releases.length} releases</span>
          </div>
          <ReleaseEarningsList rows={releases} known={earnings.updatedAt !== null} symbol={nativePaymentSymbol} onOpen={onOpenRelease} />
        </section>
      )}
      <section className='royalties-panel'>
        <div className='royalty-toolbar'>
          <h2>Payment history</h2>
          <div className='royalty-toolbar-actions'>
            <button
              className='secondary-action compact-action'
              type='button'
              onClick={onClaimRoyalties}
              disabled={isClaimingRoyalties || (claimableRoyaltyWei <= 0n && unavailableBalanceCount === 0)}
            >
              {isClaimingRoyalties ? <Disc3 size={16} className='spin' /> : <Wallet size={16} />}
              {isClaimingRoyalties ? 'Claiming...' : unavailableBalanceCount > 0 ? 'Check and claim' : 'Claim pending'}
            </button>
          </div>
        </div>

        {royaltyRuntimeSummaries.length > 0 && (
          <details className='studio-technical royalty-runtime-list'>
            <summary>Balance sources and verification</summary>
            <p>{royaltyStatus}</p>
            {royaltyRuntimeSummaries.map(summary => (
              <div className='royalty-runtime-row' key={summary.runtimeAddress}>
                <div>
                  <strong>{summary.artistName}</strong>
                  <span>
                    {summary.trackCount} release{summary.trackCount === 1 ? '' : 's'} - runtime {shorten(summary.runtimeAddress, 10)}
                  </span>
                </div>
                <a className='verify-link' href={getBlockscoutAddressUrl(summary.runtimeAddress)} target='_blank' rel='noreferrer'>
                  {summary.claimableWei === null ? 'Balance unavailable' : `${formatWeiAsDot(summary.claimableWei)} ${nativePaymentSymbol}`}
                </a>
              </div>
            ))}
          </details>
        )}

        <div className='royalty-ledger-list'>
          {royaltyPayments.length > 0 ? (
            royaltyPayments.map(payment => {
              const isExpanded = expandedRoyaltyPaymentId === payment.id;
              const label = settlementLabel(payment);

              return (
                <article className='royalty-entry' data-expanded={isExpanded} data-settlement={payment.settlement} key={payment.id}>
                  <button
                    className='royalty-row'
                    type='button'
                    aria-expanded={isExpanded}
                    aria-controls={`royalty-details-${payment.id}`}
                    onClick={() => onSetExpandedRoyaltyPaymentId(isExpanded ? null : payment.id)}
                  >
                    <div className='royalty-row-main'>
                      <strong>{payment.trackTitle}</strong>
                      <span>{formatPaymentDate(payment.paidAtMs)}</span>
                    </div>
                    <div className='royalty-row-side'>
                      <strong>
                        {payment.settlement === 'paid' || payment.settlement === 'claimed' ? '+' : ''}
                        {payment.amountDot} {nativePaymentSymbol}
                      </strong>
                      <span>
                        {label}
                        <ChevronDown size={15} />
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className='royalty-details' id={`royalty-details-${payment.id}`}>
                      <EndpointRow label={eventDateLabel(payment)} value={formatPaymentDate(payment.paidAtMs)} />
                      <EndpointRow label='Settlement' value={label} />
                      <EndpointRow
                        label='Listener wallet'
                        value={
                          <a className='verify-link' href={getBlockscoutAddressUrl(payment.listener)} target='_blank' rel='noreferrer'>
                            {shorten(payment.listener, 14)}
                          </a>
                        }
                      />
                      <EndpointRow
                        label='Recipient wallet'
                        value={
                          <a className='verify-link' href={getBlockscoutAddressUrl(payment.recipient)} target='_blank' rel='noreferrer'>
                            {shorten(payment.recipient, 14)}
                          </a>
                        }
                      />
                      {payment.settlement === 'claimable' && payment.pendingTotalWei !== undefined && (
                        <EndpointRow label='Pending total' value={`${formatWeiAsDot(payment.pendingTotalWei)} ${nativePaymentSymbol}`} />
                      )}
                      {payment.settlement === 'claimed' && payment.claimedAtMs !== undefined && (
                        <EndpointRow label='Claimed at' value={formatPaymentDate(payment.claimedAtMs)} />
                      )}
                      <EndpointRow
                        label='Block'
                        value={
                          <a className='verify-link' href={getBlockscoutBlockUrl(payment.blockNumber)} target='_blank' rel='noreferrer'>
                            {payment.blockNumber.toString()}
                          </a>
                        }
                      />
                      <EndpointRow
                        label='Track hash'
                        value={
                          <div className='endpoint-link-stack'>
                            <code>{shorten(payment.trackHash, 18)}</code>
                            <a className='verify-link' href={getBlockscoutTxUrl(payment.transactionHash)} target='_blank' rel='noreferrer'>
                              Source event
                            </a>
                          </div>
                        }
                      />
                      <EndpointRow
                        label='Transaction receipt'
                        value={
                          <a className='verify-link' href={getBlockscoutTxUrl(payment.transactionHash)} target='_blank' rel='noreferrer'>
                            {shorten(payment.transactionHash, 14)}
                          </a>
                        }
                      />
                      <EndpointRow
                        label='Artist runtime'
                        value={
                          <a className='verify-link' href={getBlockscoutAddressUrl(payment.runtimeAddress)} target='_blank' rel='noreferrer'>
                            {shorten(payment.runtimeAddress, 14)}
                          </a>
                        }
                      />
                      {payment.claimTransactionHash && (
                        <EndpointRow
                          label='Claim receipt'
                          value={
                            <a className='verify-link' href={getBlockscoutTxUrl(payment.claimTransactionHash)} target='_blank' rel='noreferrer'>
                              {shorten(payment.claimTransactionHash, 14)}
                            </a>
                          }
                        />
                      )}
                      <EndpointRow label='Log index' value={payment.logIndex.toString()} />
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className='studio-empty'>
              {!hasRoyaltyRuntime
                ? 'Create an artist profile before tracking payments.'
                : earnings.updatedAt
                  ? 'No payments to this account recorded yet.'
                  : earnings.historyState === 'unavailable'
                    ? 'Payment history is unavailable. Refresh to try again.'
                    : 'Checking payment history...'}
            </div>
          )}
        </div>
      </section>

      <details className='studio-technical royalties-context-panel'>
        <summary>How unsettled support is recovered</summary>
        <div className='principle-list'>
          <div>
            <strong>Recipient isolation</strong>
            <span>A recipient that rejects native transfers cannot block a listener from opening the release.</span>
          </div>
          <div>
            <strong>Claimable balance</strong>
            <span>Failed recipient payouts stay in the runtime until the recipient claims them successfully.</span>
          </div>
          <div>
            <strong>Open accounting</strong>
            <span>Settled and claimable amounts are separate receipts, each linked back to Blockscout.</span>
          </div>
        </div>
      </details>
    </section>
  );
}
