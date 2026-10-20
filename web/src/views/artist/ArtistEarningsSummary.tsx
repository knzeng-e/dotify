import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { useWalletContext } from '../../app/providers';
import { combineEarningsSources, summarizeContributionEarnings } from '../../features/artist-studio/earnings';
import type { ContributionHistoryState } from '../../features/donations/useContributionHistory';
import { formatWeiAsDot } from '../../shared/utils/format';
import type { EarningsSummaryProps } from './EarningsSummary';

export function ArtistEarningsSummary({
  earnings: access,
  history,
  runtime,
  onDetails
}: {
  earnings: EarningsSummaryProps;
  history: ContributionHistoryState;
  runtime?: string | null;
  onDetails?: () => void;
}) {
  const wallet = useWalletContext();
  const known = access.updatedAt !== null;
  const contributions = summarizeContributionEarnings(history.rows, runtime, wallet.listenerEvmAddress ?? '');
  const totals = combineEarningsSources(
    {
      generatedWei: known ? access.generatedWei : null,
      receivedWei: known ? access.receivedWei : null,
      claimableWei: access.claimableKnown ? access.claimableWei : null
    },
    history.known ? contributions : null
  );
  const unavailable = access.historyState === 'unavailable' || (!history.known && Boolean(history.error));
  const delayed = access.historyState === 'stale' || Boolean(history.error);
  const busy = access.refreshing || history.busy;
  const checked = access.updatedAt !== null && history.updatedAt !== null ? Math.min(access.updatedAt, history.updatedAt) : null;
  const amount = (value: bigint | null) => (value === null ? (unavailable ? 'Unavailable' : 'Checking…') : `${formatWeiAsDot(value)} ${access.symbol}`);
  const sources = [
    { id: 'listening', label: 'Listening', value: known ? access.receivedWei : null, gross: known ? access.generatedWei : null },
    {
      id: 'gifts',
      label: 'Gifts',
      value: history.known ? contributions.giftsReceivedWei : null,
      gross: history.known ? contributions.giftsGeneratedWei : null
    },
    { id: 'tips', label: 'Tips', value: history.known ? contributions.tipsReceivedWei : null, gross: history.known ? contributions.tipsGeneratedWei : null }
  ];
  return (
    <section className='earnings-overview dashboard-finances' aria-label='All earnings'>
      <div className='studio-section-head'>
        <div>
          <p className='dashboard-eyebrow'>Recorded to date</p>
          <h2>Your earnings</h2>
        </div>
        <div className='earnings-freshness'>
          <span role='status'>
            {unavailable
              ? 'History unavailable'
              : delayed
                ? 'Update delayed'
                : busy
                  ? 'Checking sources…'
                  : checked
                    ? `Updated ${new Date(checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Checking sources…'}
          </span>
          <button
            className='icon-button'
            type='button'
            aria-label='Refresh all earnings'
            title='Refresh all earnings'
            disabled={busy}
            onClick={() => {
              access.onRefresh();
              void history.refresh();
            }}
          >
            <RefreshCw size={17} className={busy ? 'spin' : undefined} />
          </button>
        </div>
      </div>
      <dl className='earnings-totals dashboard-metrics'>
        <div data-metric='received'>
          <dt>Received by you</dt>
          <dd>{amount(totals.receivedWei)}</dd>
          <dd className='earnings-total-note'>Your share, already paid to your account</dd>
        </div>
        <div data-metric='generated'>
          <dt>Total generated</dt>
          <dd>{amount(totals.generatedWei)}</dd>
          <dd className='earnings-total-note'>Your music and support · all recipients</dd>
        </div>
        <div data-metric='claimable'>
          <dt>Available to claim</dt>
          <dd>{amount(totals.claimableWei)}</dd>
          <dd className='earnings-total-note'>
            {totals.claimableWei && totals.claimableWei > 0n ? 'A payment is waiting for you' : 'Amounts still held for your account'}
          </dd>
          {onDetails && totals.claimableWei !== null && totals.claimableWei > 0n && (
            <button className='text-action' onClick={onDetails}>
              Review claims <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </dl>
      <div className='dashboard-source-heading'>
        <h3>Where your income comes from</h3>
        {onDetails && (
          <button className='text-action' onClick={onDetails}>
            View earnings <ArrowUpRight size={16} />
          </button>
        )}
      </div>
      <div className='dashboard-sources'>
        {sources.map(source => (
          <div key={source.id} data-source={source.id} className='dashboard-source'>
            <span className='source-dot' aria-hidden='true' />
            <span>{source.label}</span>
            <strong>{amount(source.value)}</strong>
            <small>{amount(source.gross)} generated</small>
          </div>
        ))}
      </div>
      <details className='earnings-definition'>
        <summary>What these figures include</summary>
        <p>
          Received is your settled share, including collaborations and host tips. Total generated also includes amounts distributed to collaborators, hosts and
          other beneficiaries. These are payment records, not your current wallet balance.
        </p>
        <p>
          Listening, gifts and tips are checked every 15 seconds while this space is visible. Delayed updates retain the last reading. An unavailable source is
          never counted as zero.
        </p>
        {history.coverage === 'verified-receipts' && (
          <p>
            Product support includes receipts verified and saved by Dotify. Native listening payments and earlier unsynced support may be missing. Network fees
            and older direct transfers are excluded.
          </p>
        )}
      </details>
    </section>
  );
}
