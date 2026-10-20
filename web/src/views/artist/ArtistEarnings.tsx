import { useId, useState } from 'react';
import type { ContributionHistoryState } from '../../features/donations/useContributionHistory';
import { ArtistEarningsSummary } from './ArtistEarningsSummary';
import { ContributionLedger } from './ContributionHistory';
import { RoyaltiesTab, type RoyaltiesTabProps } from './RoyaltiesTab';

export function ArtistEarnings(props: RoyaltiesTabProps & { history: ContributionHistoryState }) {
  const [detail, setDetail] = useState<'listening' | 'contributions'>('listening');
  const id = useId();
  const history = props.history;
  const tabs = [
    { key: 'listening', label: 'Listening payments' },
    { key: 'contributions', label: 'Gifts & tips' }
  ] as const;
  return (
    <div className='artist-earnings-view'>
      <ArtistEarningsSummary earnings={props.earnings} history={history} runtime={props.artistRuntimeAddress} />
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
