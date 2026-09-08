import { ChevronDown, CircleCheckBig, Disc3, RefreshCw, Wallet } from 'lucide-react';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { Metric } from '../../shared/ui/Metric';
import { getBlockscoutAddressUrl, getBlockscoutBlockUrl, getBlockscoutTxUrl } from '../../shared/utils/explorer';
import { formatPaymentDate, formatWeiAsDot, shorten } from '../../shared/utils/format';
import type { RoyaltyPayment, RoyaltyRuntimeSummary } from '../../shared/types';

type RoyaltiesTabProps = {
  royaltyPayments: RoyaltyPayment[];
  royaltyStatus: string;
  isRefreshingRoyalties: boolean;
  claimableRoyaltyWei: bigint;
  royaltyRuntimeSummaries: RoyaltyRuntimeSummary[];
  isClaimingRoyalties: boolean;
  artistRuntimeAddress: `0x${string}` | null;
  expandedRoyaltyPaymentId: string | null;
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  paidRoyaltyTracks: number;
  nativePaymentSymbol: string;
  onSetExpandedRoyaltyPaymentId: (id: string | null) => void;
  onRefreshRoyalties: () => void;
  onClaimRoyalties: () => void;
};

export function RoyaltiesTab({
  royaltyPayments,
  royaltyStatus,
  isRefreshingRoyalties,
  claimableRoyaltyWei,
  royaltyRuntimeSummaries,
  isClaimingRoyalties,
  artistRuntimeAddress,
  expandedRoyaltyPaymentId,
  totalRoyaltyWei,
  uniqueRoyaltyListeners,
  paidRoyaltyTracks,
  nativePaymentSymbol,
  onSetExpandedRoyaltyPaymentId,
  onRefreshRoyalties,
  onClaimRoyalties
}: RoyaltiesTabProps) {
  const claimableDot = formatWeiAsDot(claimableRoyaltyWei);
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
    <section className='content-grid royalties-grid'>
      <div className='doc-panel royalties-panel'>
        <PanelTitle icon={Wallet} title='Royalty ledger' meta={hasRoyaltyRuntime ? 'on-chain settlement' : 'profile needed'} />
        <div className='royalty-summary-grid'>
          <Metric label='settled' value={`${formatWeiAsDot(totalRoyaltyWei)} ${nativePaymentSymbol}`} />
          <Metric label='claimable' value={`${claimableDot} ${nativePaymentSymbol}`} />
          <Metric label='listeners' value={uniqueRoyaltyListeners.toString()} />
          <Metric label='tracks settled' value={paidRoyaltyTracks.toString()} />
        </div>
        <div className='royalty-toolbar'>
          <p className='rights-status'>{royaltyStatus}</p>
          <div className='royalty-toolbar-actions'>
            <button
              className='secondary-action compact-action'
              type='button'
              onClick={onClaimRoyalties}
              disabled={isClaimingRoyalties || claimableRoyaltyWei <= 0n}
            >
              {isClaimingRoyalties ? <Disc3 size={16} className='spin' /> : <Wallet size={16} />}
              {isClaimingRoyalties ? 'Claiming...' : 'Claim pending'}
            </button>
            <button className='secondary-action compact-action' type='button' onClick={onRefreshRoyalties} disabled={isRefreshingRoyalties}>
              {isRefreshingRoyalties ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
              {isRefreshingRoyalties ? 'Refreshing...' : 'Refresh ledger'}
            </button>
          </div>
        </div>

        {royaltyRuntimeSummaries.length > 0 && (
          <div className='royalty-runtime-list' aria-label='Royalty runtime balances'>
            {royaltyRuntimeSummaries.map(summary => (
              <div className='royalty-runtime-row' key={summary.runtimeAddress}>
                <div>
                  <strong>{summary.artistName}</strong>
                  <span>
                    {summary.trackCount} release{summary.trackCount === 1 ? '' : 's'} - runtime {shorten(summary.runtimeAddress, 10)}
                  </span>
                </div>
                <a className='verify-link' href={getBlockscoutAddressUrl(summary.runtimeAddress)} target='_blank' rel='noreferrer'>
                  {formatWeiAsDot(summary.claimableWei)} {nativePaymentSymbol}
                </a>
              </div>
            ))}
          </div>
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
            <div className='empty-state'>{hasRoyaltyRuntime ? 'No paid support recorded yet.' : 'Create an artist profile before tracking payments.'}</div>
          )}
        </div>
      </div>

      <div className='doc-panel royalties-context-panel'>
        <PanelTitle icon={CircleCheckBig} title='Settlement fallback' meta='artist control' />
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
      </div>
    </section>
  );
}
