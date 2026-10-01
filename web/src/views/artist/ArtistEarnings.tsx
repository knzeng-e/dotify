import { useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useWalletContext } from '../../app/providers';
import { combineEarningsSources, summarizeContributionEarnings } from '../../features/artist-studio/earnings';
import { useContributionHistory } from '../../features/donations/useContributionHistory';
import { formatWeiAsDot } from '../../shared/utils/format';
import { ContributionLedger } from './ContributionHistory';
import { RoyaltiesTab, type RoyaltiesTabProps } from './RoyaltiesTab';

export function ArtistEarnings(props: RoyaltiesTabProps) {
  const wallet = useWalletContext();
  const history = useContributionHistory(props.artistRuntimeAddress);
  const [detail, setDetail] = useState<'listening' | 'contributions'>('listening');
  const id = useId();
  const access = props.earnings;
  const accessKnown = access.updatedAt !== null;
  const contributions = summarizeContributionEarnings(history.rows, props.artistRuntimeAddress, wallet.listenerEvmAddress ?? '');
  const totals = combineEarningsSources(
    {
      generatedWei: accessKnown ? access.generatedWei : null,
      receivedWei: accessKnown ? access.receivedWei : null,
      claimableWei: access.claimableKnown ? access.claimableWei : null
    },
    history.known ? contributions : null
  );
  const delayed = access.historyState === 'stale' || Boolean(history.error);
  const unavailable = access.historyState === 'unavailable' || (!history.known && Boolean(history.error));
  const busy = access.refreshing || history.busy;
  const checked = access.updatedAt !== null && history.updatedAt !== null ? Math.min(access.updatedAt, history.updatedAt) : null;
  const amount = (value: bigint | null) => (value === null ? (unavailable ? 'Unavailable' : 'Checking...') : `${formatWeiAsDot(value)} ${access.symbol}`);
  const sources = [
    { id: 'listening', label: 'Listening payments', generated: accessKnown ? access.generatedWei : null, received: accessKnown ? access.receivedWei : null },
    {
      id: 'gifts',
      label: 'Gifts',
      generated: history.known ? contributions.giftsGeneratedWei : null,
      received: history.known ? contributions.giftsReceivedWei : null
    },
    {
      id: 'tips',
      label: 'Tips',
      generated: history.known ? contributions.tipsGeneratedWei : null,
      received: history.known ? contributions.tipsReceivedWei : null
    }
  ];
  const tabs = [
    { key: 'listening', label: 'Listening payments' },
    { key: 'contributions', label: 'Gifts & tips' }
  ] as const;
  return (
    <div className='artist-earnings-view'>
      <section className='earnings-overview' aria-label='All earnings'>
        <div className='studio-section-head'>
          <div>
            <h2>Earnings</h2>
            <p className='earnings-subtitle'>Your music and the support it inspires</p>
          </div>
          <div className='earnings-freshness'>
            <span role='status'>
              {unavailable
                ? 'Some sources unavailable'
                : delayed
                  ? 'Update delayed'
                  : busy
                    ? 'Checking sources...'
                    : checked !== null
                      ? `Checked ${new Date(checked).toLocaleTimeString()}`
                      : 'Checking sources...'}
            </span>
            <button
              className='icon-button'
              type='button'
              title='Refresh all earnings'
              aria-label='Refresh all earnings'
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
        <dl className='earnings-totals'>
          <div>
            <dt>Total generated</dt>
            <dd>{amount(totals.generatedWei)}</dd>
            <dd className='earnings-total-note'>Releases, gifts and tips</dd>
          </div>
          <div>
            <dt>Received by you</dt>
            <dd>{amount(totals.receivedWei)}</dd>
            <dd className='earnings-total-note'>Your settled share</dd>
          </div>
          <div>
            <dt>Available to claim</dt>
            <dd>{access.claimableKnown ? amount(totals.claimableWei) : 'Unavailable'}</dd>
            <dd className='earnings-total-note'>Not yet received</dd>
          </div>
        </dl>
        <table className='earnings-sources'>
          <caption>Revenue sources</caption>
          <thead>
            <tr>
              <th scope='col'>Source</th>
              <th scope='col'>Generated</th>
              <th scope='col'>Received by you</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(source => (
              <tr key={source.id} data-source={source.id}>
                <th scope='row'>{source.label}</th>
                <td>{amount(source.generated)}</td>
                <td>{amount(source.received)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className='earnings-definition'>
          <summary>About these amounts</summary>
          <p>
            Total generated includes all recipients of your releases and artist contributions, not just your income. Received by you includes your settled
            shares, collaborations and host tips. Amounts sent to collaborators, hosts or causes are not counted as your receipts.
          </p>
          <p>
            Sources are checked every 15 seconds while visible. An unavailable source is never counted as zero; delayed updates retain the last known values.
            Contribution history covers known artist runtimes. Older direct gifts and network fees are excluded.
          </p>
        </details>
      </section>
      <section className='earnings-detail'>
        <div className='earnings-detail-tabs' role='tablist' aria-label='Earnings details'>
          {tabs.map(tab => (
            <button
              key={tab.key}
              id={`${id}-${tab.key}`}
              type='button'
              role='tab'
              aria-selected={detail === tab.key}
              aria-controls={`${id}-panel`}
              tabIndex={detail === tab.key ? 0 : -1}
              onClick={() => setDetail(tab.key)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === 'Home' ? 'listening' : event.key === 'End' ? 'contributions' : detail === 'listening' ? 'contributions' : 'listening';
                setDetail(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div id={`${id}-panel`} role='tabpanel' aria-labelledby={`${id}-${detail}`} tabIndex={0}>
          {detail === 'listening' ? <RoyaltiesTab {...props} /> : <ContributionLedger history={history} runtime={props.artistRuntimeAddress} compact />}
        </div>
      </section>
    </div>
  );
}
