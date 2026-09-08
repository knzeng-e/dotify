import { ChevronDown, CircleCheckBig, Disc3, RefreshCw, Wallet } from 'lucide-react';
import { PanelTitle } from '../../shared/ui/PanelTitle';
import { EndpointRow } from '../../shared/ui/EndpointRow';
import { Metric } from '../../shared/ui/Metric';
import { getBlockscoutAddressUrl, getBlockscoutBlockUrl, getBlockscoutTxUrl } from '../../shared/utils/explorer';
import { formatPaymentDate, formatWeiAsDot, shorten } from '../../shared/utils/format';
import type { RoyaltyPayment } from '../../shared/types';

type RoyaltiesTabProps = {
  royaltyPayments: RoyaltyPayment[];
  royaltyStatus: string;
  isRefreshingRoyalties: boolean;
  claimableRoyaltyWei: bigint;
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

  return (
    <section className='content-grid royalties-grid'>
      <div className='doc-panel royalties-panel'>
        <PanelTitle icon={Wallet} title='Royalty ledger' meta={artistRuntimeAddress ? 'on-chain settlement' : 'profile needed'} />
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
              disabled={isClaimingRoyalties || claimableRoyaltyWei <= 0n || !artistRuntimeAddress}
            >
              {isClaimingRoyalties ? <Disc3 size={16} className='spin' /> : <Wallet size={16} />}
              {isClaimingRoyalties ? 'Claiming…' : 'Claim pending'}
            </button>
            <button
              className='secondary-action compact-action'
              type='button'
              onClick={onRefreshRoyalties}
              disabled={isRefreshingRoyalties || !artistRuntimeAddress}
            >
              {isRefreshingRoyalties ? <Disc3 size={16} className='spin' /> : <RefreshCw size={16} />}
              {isRefreshingRoyalties ? 'Refreshing…' : 'Refresh ledger'}
            </button>
          </div>
        </div>

        <div className='royalty-ledger-list'>
          {royaltyPayments.length > 0 ? (
            royaltyPayments.map(payment => {
              const isExpanded = expandedRoyaltyPaymentId === payment.id;
              const settlementLabel = payment.settlement === 'paid' ? 'Paid' : 'Claimable';

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
                        {payment.settlement === 'paid' ? '+' : ''}
                        {payment.amountDot} {nativePaymentSymbol}
                      </strong>
                      <span>
                        {settlementLabel}
                        <ChevronDown size={15} />
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className='royalty-details' id={`royalty-details-${payment.id}`}>
                      <EndpointRow label={payment.settlement === 'paid' ? 'Paid at' : 'Claimable at'} value={formatPaymentDate(payment.paidAtMs)} />
                      <EndpointRow label='Settlement' value={settlementLabel} />
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
                      {artistRuntimeAddress && (
                        <EndpointRow
                          label='Artist runtime'
                          value={
                            <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                              {shorten(artistRuntimeAddress, 14)}
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
            <div className='empty-state'>{artistRuntimeAddress ? 'No paid support recorded yet.' : 'Create an artist profile before tracking payments.'}</div>
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
