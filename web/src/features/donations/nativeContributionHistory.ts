import type { Address } from 'viem';
import { readNativePaymentHistory } from '../runtime/nativePaymentHistory';
import { decodeContributions, type ContributionReceipt } from './contributions';

export async function readNativeContributionHistory(apiUrl: string, runtimes: Address[], fetchImpl: typeof fetch = fetch): Promise<ContributionReceipt[]> {
  const receipts = await readNativePaymentHistory(apiUrl, runtimes, 'contributions', fetchImpl);
  const rows = receipts.flatMap(receipt =>
    [...new Set(runtimes.map(runtime => runtime.toLowerCase() as Address))].flatMap(runtime =>
      decodeContributions(runtime, receipt.logs).map(row => ({ ...row, proofKind: 'substrate-extrinsic' as const }))
    )
  );
  return mergeContributionHistory(rows);
}

export function mergeContributionHistory(...sources: ContributionReceipt[][]): ContributionReceipt[] {
  const rows = new Map<string, ContributionReceipt>();
  for (const row of sources.flat()) {
    const key = `${row.runtime}:${row.id}`.toLowerCase();
    const prior = rows.get(key);
    if (prior && (prior.amount !== row.amount || prior.sender.toLowerCase() !== row.sender.toLowerCase() || prior.contentHash !== row.contentHash))
      throw new Error('Contribution sources disagree about this receipt.');
    // Native proof links take precedence if both indexes expose the same payment.
    if (!prior || row.proofKind === 'substrate-extrinsic') rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.timestamp - a.timestamp);
}
