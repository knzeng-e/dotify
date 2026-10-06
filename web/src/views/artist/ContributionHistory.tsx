import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { formatEther, zeroHash, type Address } from 'viem';
import { useCatalogContext, useWalletContext } from '../../app/providers';
import type { ContributionReceipt } from '../../features/donations/contributions';
import { useContributionWriter } from '../../features/donations/useContributionWriter';
import { useContributionHistory, type ContributionHistoryState } from '../../features/donations/useContributionHistory';
import { nativeCurrencyForChain } from '../../shared/config/contracts';
import { getTransactionProofUrl } from '../../shared/utils/explorer';

export function ContributionHistory({ runtime, personal = false }: { runtime?: Address | null; personal?: boolean }) {
  const history = useContributionHistory(runtime);
  return <ContributionLedger runtime={runtime} personal={personal} history={history} />;
}

export function ContributionLedger({
  runtime,
  personal = false,
  history,
  compact = false
}: {
  runtime?: Address | null;
  personal?: boolean;
  history: ContributionHistoryState;
  compact?: boolean;
}) {
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const writer = useContributionWriter();
  const { rows, known, updatedAt, error, busy, refresh } = history;
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);
  if (!wallet.listenerEvmAddress) return null;
  const owned = rows.filter(row => runtime && row.runtime.toLowerCase() === runtime.toLowerCase());
  const total = (items: ContributionReceipt[]) => items.reduce((sum, row) => sum + row.amount, 0n);
  const mine = rows.flatMap(row => row.shares.filter(share => share.recipient.toLowerCase() === wallet.listenerEvmAddress!.toLowerCase()));
  const received = mine.reduce((sum, share) => sum + (share.paid || share.claimed ? share.amount : 0n), 0n);
  const pendingTotal = mine.reduce((sum, share) => sum + (!share.paid && !share.claimed ? share.amount : 0n), 0n);
  const byWork = new Map<string, { title: string; amount: bigint }>();
  const byCampaign = new Map<string, bigint>();
  for (const row of owned) {
    if (row.contentHash !== zeroHash) {
      const key = `${row.runtime}:${row.contentHash}`.toLowerCase();
      const title = catalog.catalogTracks.find(track => track.id.toLowerCase() === key)?.title ?? row.contentHash;
      byWork.set(key, { title, amount: (byWork.get(key)?.amount ?? 0n) + row.amount });
    }
    if (row.campaign !== zeroHash) byCampaign.set(row.campaign, (byCampaign.get(row.campaign) ?? 0n) + row.amount);
  }
  const symbol = wallet.expectedChainId ? nativeCurrencyForChain(wallet.expectedChainId, wallet.ethRpcUrl).symbol : '';
  async function claim(row: ContributionReceipt) {
    setClaiming(true);
    setClaimError('');
    try {
      if (!writer.contributionCall) throw new Error('Claim unavailable for this wallet.');
      const hash = await writer.contributionCall(row.runtime, 'musicGiftClaim', [row.id]);
      await writer.waitForTransaction(hash);
      await refresh();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Could not claim.');
    } finally {
      setClaiming(false);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(rows, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dotify-contributions.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className='contribution-history'>
      <div className='studio-section-head'>
        <h2>{personal ? 'Your contributions and host tips' : 'Gifts & tips'}</h2>
        <div>
          <button className='icon-action' title='Export contribution receipts' aria-label='Export contribution receipts' disabled={!known} onClick={download}>
            <Download size={18} />
          </button>
          <button className='icon-action' title='Refresh contributions' aria-label='Refresh contributions' disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      {!compact && (
        <dl className='contribution-totals'>
          {!personal && (
            <>
              <div>
                <dt>Gifts generated</dt>
                <dd>{known ? `${formatEther(total(owned.filter(row => row.contentHash === zeroHash)))} ${symbol}` : '—'}</dd>
              </div>
              <div>
                <dt>Tips generated</dt>
                <dd>{known ? `${formatEther(total(owned.filter(row => row.contentHash !== zeroHash)))} ${symbol}` : '—'}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Received by you</dt>
            <dd>{known ? `${formatEther(received)} ${symbol}` : '—'}</dd>
          </div>
          <div>
            <dt>Available to claim</dt>
            <dd>{known ? `${formatEther(pendingTotal)} ${symbol}` : '—'}</dd>
          </div>
        </dl>
      )}
      {byWork.size > 0 && (
        <details className='contribution-entry'>
          <summary>Tips by work</summary>
          <ul className='contribution-destinations'>
            {[...byWork].map(([key, row]) => (
              <li key={key}>
                <span>{row.title}</span>
                <strong>
                  {formatEther(row.amount)} {symbol}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      )}
      {byCampaign.size > 0 && (
        <details className='contribution-entry'>
          <summary>Contributions linked to campaigns</summary>
          <p>These amounts include all recipients, including collaborators and hosts. They are not a measure of funds received by a cause.</p>
          <ul className='contribution-destinations'>
            {[...byCampaign].map(([key, amount]) => (
              <li key={key}>
                <span>
                  <code>{key}</code>
                </span>
                <strong>
                  {formatEther(amount)} {symbol}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      )}
      {updatedAt !== null && <p className='contribution-freshness'>Finalized contributions · checked {new Date(updatedAt).toLocaleTimeString()}</p>}
      {history.coverage === 'verified-receipts' && (
        <p className='contribution-freshness'>Includes verified Product receipts saved by Dotify. Earlier unsynced payments may be missing.</p>
      )}
      {error && <p role='status'>{error}</p>}
      {claimError && <p role='alert'>{claimError}</p>}
      {!rows.length && (
        <p>
          {known ? 'No recorded contributions in the known artist runtimes. Earlier direct transfers are not included.' : 'Checking contribution receipts…'}
        </p>
      )}
      {[...rows]
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(row => {
          const track = catalog.catalogTracks.find(track => track.id.toLowerCase() === `${row.runtime}:${row.contentHash}`.toLowerCase());
          const pending = row.shares.some(share => share.recipient.toLowerCase() === wallet.listenerEvmAddress!.toLowerCase() && !share.paid && !share.claimed);
          return (
            <details className='contribution-entry' key={`${row.runtime}:${row.id}`}>
              <summary>
                <span>
                  {row.contentHash === zeroHash ? 'Gift to artist' : `Tip · ${track?.title || 'Release'}`}
                  <small>{new Date(row.timestamp).toLocaleString()}</small>
                </span>
                <strong>
                  {formatEther(row.amount)} {symbol}
                </strong>
              </summary>
              <p>
                From <code>{row.sender}</code>
              </p>
              <ul className='contribution-destinations'>
                {row.shares.map((share, i) => (
                  <li key={i}>
                    <span>
                      {['Artist / beneficiary', 'Collaborator', 'Room host'][share.role]}
                      <small>{share.recipient}</small>
                      {share.paid || share.claimed ? 'Received' : 'Available to claim'}
                    </span>
                    <strong>
                      {formatEther(share.amount)} {symbol}
                    </strong>
                  </li>
                ))}
              </ul>
              {row.campaign !== zeroHash && (
                <p>
                  Campaign <code>{row.campaign}</code>
                </p>
              )}
              {row.room !== zeroHash && (
                <p>
                  Room host <code>{row.host}</code>
                </p>
              )}
              <a href={getTransactionProofUrl(row.transactionHash, row.proofKind)} target='_blank' rel='noreferrer'>
                View dated receipt
              </a>
              {pending && (
                <button className='secondary-action' disabled={claiming} onClick={() => void claim(row)}>
                  Claim your contribution
                </button>
              )}
            </details>
          );
        })}
    </section>
  );
}
