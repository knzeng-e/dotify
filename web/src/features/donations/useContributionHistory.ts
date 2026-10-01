import { useLayoutEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { useCatalogContext, useWalletContext } from '../../app/providers';
import { useVisibleRefresh, runSerializedRefresh, type RefreshGate } from '../../hooks/useVisibleRefresh';
import { contributionReader, type ContributionReceipt } from './contributions';

export function useContributionHistory(runtime?: Address | null) {
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const runtimes = [
    ...new Set([...catalog.catalogTracks.map(track => track.id.split(':')[0]), ...(runtime ? [runtime] : [])].map(value => value.toLowerCase()))
  ]
    .sort()
    .filter(value => /^0x[\da-f]{40}$/i.test(value)) as Address[];
  const scope = `${wallet.expectedChainId}:${wallet.ethRpcUrl}:${wallet.listenerEvmAddress}:${runtimes.join(':')}`;
  const current = useRef(scope);
  const gate = useRef<RefreshGate>({ current: null });
  const [snapshot, setSnapshot] = useState<{ scope: string; rows: ContributionReceipt[]; updated: number }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    current.current = scope;
    setError('');
  }, [scope]);
  async function read() {
    if (!wallet.listenerEvmAddress || !wallet.expectedChainId) return;
    setBusy(true);
    try {
      const reader = contributionReader(wallet.ethRpcUrl);
      if ((await reader.client.getChainId()) !== wallet.expectedChainId) throw new Error('Contribution history network mismatch.');
      const rows = (await Promise.all(runtimes.map(address => reader.history(address)))).flat();
      if (current.current === scope) {
        setSnapshot({ scope, rows, updated: Date.now() });
        setError('');
      }
    } catch (error) {
      if (current.current === scope) setError(`Update delayed. ${error instanceof Error ? error.message.split('\n')[0] : 'History unavailable.'}`);
    } finally {
      if (current.current === scope) setBusy(false);
    }
  }
  const refresh = () => runSerializedRefresh(gate.current, read, true);
  useVisibleRefresh(refresh, wallet.listenerEvmAddress ? scope : null);
  const known = Boolean(wallet.listenerEvmAddress && snapshot?.scope === scope);
  const rows =
    known && snapshot
      ? snapshot.rows.filter(
          row =>
            (runtime && row.runtime.toLowerCase() === runtime.toLowerCase()) ||
            row.sender.toLowerCase() === wallet.listenerEvmAddress!.toLowerCase() ||
            row.shares.some(share => share.recipient.toLowerCase() === wallet.listenerEvmAddress!.toLowerCase())
        )
      : [];
  return { rows, known, updatedAt: known ? snapshot!.updated : null, error, busy, refresh };
}

export type ContributionHistoryState = ReturnType<typeof useContributionHistory>;
