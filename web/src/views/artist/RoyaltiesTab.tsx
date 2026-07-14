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
  artistRuntimeAddress: `0x${string}` | null;
  expandedRoyaltyPaymentId: string | null;
  totalRoyaltyWei: bigint;
  uniqueRoyaltyListeners: number;
  paidRoyaltyTracks: number;
  onSetExpandedRoyaltyPaymentId: (id: string | null) => void;
  onRefreshRoyalties: () => void;
};

export function RoyaltiesTab({
  royaltyPayments,
  royaltyStatus,
  isRefreshingRoyalties,
  artistRuntimeAddress,
  expandedRoyaltyPaymentId,
  totalRoyaltyWei,
  uniqueRoyaltyListeners,
  paidRoyaltyTracks,
  onSetExpandedRoyaltyPaymentId,
  onRefreshRoyalties
}: RoyaltiesTabProps) {
  return (
    <section className='content-grid royalties-grid'>
      <div className='doc-panel royalties-panel'>
        <PanelTitle icon={Wallet} title='Royalty ledger' meta={artistRuntimeAddress ? 'on-chain payments' : 'profile needed'} />
        <div className='royalty-summary-grid'>
          <Metric label='received' value={`${formatWeiAsDot(totalRoyaltyWei)} DOT`} />
          <Metric label='payments' value={royaltyPayments.length.toString()} />
          <Metric label='listeners' value={uniqueRoyaltyListeners.toString()} />
          <Metric label='tracks paid' value={paidRoyaltyTracks.toString()} />
        </div>
        <div className='royalty-toolbar'>
          <p className='rights-status'>{royaltyStatus}</p>
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

        <div className='royalty-ledger-list'>
          {royaltyPayments.length > 0 ? (
            royaltyPayments.map(payment => {
              const isExpanded = expandedRoyaltyPaymentId === payment.id;

              return (
                <article className='royalty-entry' data-expanded={isExpanded} key={payment.id}>
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
                      <strong>{payment.amountDot} DOT</strong>
                      <span>
                        Details
                        <ChevronDown size={15} />
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className='royalty-details' id={`royalty-details-${payment.id}`}>
                      <EndpointRow label='Paid at' value={formatPaymentDate(payment.paidAtMs)} />
                      <EndpointRow
                        label='Listener wallet'
                        value={
                          <a className='verify-link' href={getBlockscoutAddressUrl(payment.listener)} target='_blank' rel='noreferrer'>
                            {shorten(payment.listener, 14)}
                          </a>
                        }
                      />
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
        <PanelTitle icon={CircleCheckBig} title='Direct settlement' meta='artist control' />
        <div className='principle-list'>
          <div>
            <strong>Payment history</strong>
            <span>Every row is a listener supporting and opening one of your releases.</span>
          </div>
          <div>
            <strong>Listener record</strong>
            <span>Support stays visible without forcing listeners into platform accounts.</span>
          </div>
          <div>
            <strong>Open accounting</strong>
            <span>Amounts are shown in DOT and each payment links back to Blockscout.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
