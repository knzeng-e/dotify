import { useLayoutEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { useCatalogContext, useWalletContext } from '../../app/providers';
import { useVisibleRefresh, runSerializedRefresh, type RefreshGate } from '../../hooks/useVisibleRefresh';
import { contributionE2e } from '../../e2e/contributionMock';
import { mergeContributionHistory, readNativeContributionHistory } from './nativeContributionHistory';
import { contributionReader, type ContributionReceipt } from './contributions';

export function useContributionHistory(runtime?: Address | null) {
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const runtimes = [
    ...new Set([...catalog.catalogTracks.map(track => track.id.split(':')[0]), ...(runtime ? [runtime] : [])].map(value => value.toLowerCase()))
  ]
    .sort()
    .filter(value => /^0x[\da-f]{40}$/i.test(value)) as Address[];
  const apiUrl = contributionE2e
    ? new URLSearchParams(location.search).get('e2eNativeHistory') === 'on'
      ? 'https://receipt.dotify.test'
      : undefined
    : import.meta.env.VITE_DOTIFY_API_URL;
  const nativeEnabled = Boolean(apiUrl && wallet.expectedChainId === 420420417);
  const scope = `${apiUrl}:${wallet.expectedChainId}:${wallet.ethRpcUrl}:${wallet.listenerEvmAddress}:${runtimes.join(':')}`;
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
      const [evm, native] = await Promise.all([
        Promise.all(runtimes.map(address => reader.history(address))).then(rows => rows.flat()),
        nativeEnabled ? readNativeContributionHistory(apiUrl!, runtimes) : Promise.resolve([])
      ]);
      const rows = mergeContributionHistory(evm, native);
      // A native claim may also be absent from eth_getLogs. Finalized contract state
      // settles the outstanding share without inventing another contribution.
      await Promise.all(
        rows.flatMap(row =>
          row.shares
            .filter(share => !share.paid && !share.claimed)
            .map(async share => {
              const remaining = await reader.pending(row.runtime, row.id, share.recipient);
              if (remaining === 0n) share.claimed = true;
              else if (remaining !== share.amount) throw new Error('The outstanding contribution share could not be reconciled.');
            })
        )
      );
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
  return {
    rows,
    known,
    coverage: nativeEnabled ? ('verified-receipts' as const) : ('evm-only' as const),
    updatedAt: known ? snapshot!.updated : null,
    error,
    busy,
    refresh
  };
}

export type ContributionHistoryState = ReturnType<typeof useContributionHistory>;
