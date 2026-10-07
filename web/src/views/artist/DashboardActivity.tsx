import { ArrowUpRight, Gift, Heart, Music2 } from 'lucide-react';
import type { ArtistActivity } from '../../features/artist-studio/dashboard';
import { receiptDays } from '../../features/artist-studio/dashboard';
import { formatPaymentDate, formatWeiAsDot } from '../../shared/utils/format';
import { getTransactionProofUrl } from '../../shared/utils/explorer';

export function DashboardActivity({
  activity,
  symbol,
  known,
  onDetails
}: {
  activity: ArtistActivity[];
  symbol: string;
  known: boolean;
  onDetails: () => void;
}) {
  const days = receiptDays(activity);
  const maximum = days.reduce((max, day) => (day.amount > max ? day.amount : max), 0n);
  const total = days.reduce((sum, day) => sum + day.amount, 0n);
  const date = (value: number) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <div className='dashboard-activity-column'>
      <section className='dashboard-rhythm' aria-label='Recent receipts'>
        <div className='studio-section-head'>
          <div>
            <p className='dashboard-eyebrow'>Last 14 days</p>
            <h2>Your music, supported</h2>
          </div>
          <span className='dashboard-rhythm-total'>{known ? `${formatWeiAsDot(total)} ${symbol}` : 'Checking…'}</span>
        </div>
        <div
          className='dashboard-chart'
          role='img'
          aria-label={
            known ? `${formatWeiAsDot(total)} ${symbol} received in the last 14 days. Daily amounts available below.` : 'Receipt activity is being checked.'
          }
        >
          {days.map(day => (
            <span key={day.start} className='dashboard-chart-column'>
              <span style={{ height: `${known && maximum > 0n ? Number((day.amount * 10000n) / maximum) / 100 : 0}%` }} data-value={day.amount > 0n} />
            </span>
          ))}
        </div>
        <div className='dashboard-chart-axis'>
          <span>{date(days[0].start)}</span>
          <span>{date(days[13].start)}</span>
        </div>
        {known && maximum === 0n && <p className='dashboard-chart-empty'>Your next receipt will light up this view.</p>}
        <details className='earnings-definition'>
          <summary>Daily receipt amounts</summary>
          <ul className='dashboard-daily-values'>
            {days.map(day => (
              <li key={day.start}>
                <span>{date(day.start)}</span>
                <strong>{known ? `${formatWeiAsDot(day.amount)} ${symbol}` : 'Unavailable'}</strong>
              </li>
            ))}
          </ul>
          <p>Verified received shares, dated by their contribution or listening payment. Later claims remain attached to the original payment date.</p>
        </details>
      </section>
      <section className='dashboard-recent' aria-label='Recent activity'>
        <div className='studio-section-head'>
          <h2>Recent activity</h2>
          <button className='text-action' onClick={onDetails}>
            View all <ArrowUpRight size={16} />
          </button>
        </div>
        {!activity.length && (
          <p className='studio-empty'>{known ? 'Your next listening payment, gift or tip will appear here.' : 'Checking your payment records…'}</p>
        )}
        {activity.slice(0, 5).map(row => {
          const Icon = row.kind === 'gift' ? Gift : row.kind === 'tip' ? Heart : Music2;
          return (
            <a
              className='dashboard-activity-row'
              key={row.id}
              href={getTransactionProofUrl(row.hash, row.proofKind)}
              target='_blank'
              rel='noreferrer'
              aria-label={`${row.kind === 'tip' ? 'Tip' : row.kind === 'gift' ? 'Gift' : 'Listening'} · ${row.title} · View receipt`}
            >
              <span className='dashboard-activity-icon' data-kind={row.kind}>
                <Icon size={17} />
              </span>
              <span className='dashboard-activity-copy'>
                <span className='dashboard-activity-kind'>{row.kind === 'tip' ? 'Track tip' : row.kind === 'gift' ? 'Artist gift' : 'Listening payment'}</span>
                <strong>{row.title}</strong>
                <small>{formatPaymentDate(row.timestamp)}</small>
              </span>
              <span className='dashboard-activity-value'>
                <strong>
                  {formatWeiAsDot(row.receivedWei || row.pendingWei || row.grossWei)} {symbol}
                </strong>
                <small>{row.pendingWei > 0n ? 'To claim' : row.receivedWei > 0n ? 'Received by you' : 'Distributed'}</small>
              </span>
            </a>
          );
        })}
      </section>
    </div>
  );
}
