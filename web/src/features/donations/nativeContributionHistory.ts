import type { Address, Hash } from 'viem';
import { validateNativeContributionReceipt } from '../runtime/nativeContributionReceiptApi';
import { decodeContributions, type ContributionReceipt } from './contributions';

const GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
export async function readNativeContributionHistory(apiUrl: string, runtimes: Address[], fetchImpl: typeof fetch = fetch): Promise<ContributionReceipt[]> {
  if (!runtimes.length) return [];
  if (runtimes.length > 100) throw new Error('Support history needs a smaller artist scope.');
  const rows: ContributionReceipt[] = [];
  let offset = 0;
  let revision: string | undefined;
  // One budget covers all pages; revisions prevent mixed snapshots during a refresh.
  const signal = AbortSignal.timeout(25_000);
  for (let page = 0; page < 100; page++) {
    const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/api/contributions/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ runtimes, offset, revision })
    });
    if (!response.ok) throw new Error('Native support history is unavailable. Your payments remain recorded on the network.');
    const body = await response.json();
    if (
      body?.genesisHash !== GENESIS ||
      body.chainId !== 420420417 ||
      body.coverage !== 'verified-receipts' ||
      !Array.isArray(body.receipts) ||
      body.receipts.length > 100 ||
      typeof body.updatedAt !== 'string' ||
      (revision && revision !== body.updatedAt)
    )
      throw new Error('Native support history could not be verified.');
    revision = body.updatedAt;
    for (const receipt of body.receipts) {
      if (!/^0x[\da-f]{64}$/i.test(receipt?.hash ?? '') || !Number.isSafeInteger(receipt?.block?.number) || receipt.block.number < 0)
        throw new Error('Native support receipt has no valid reference.');
      const logs = validateNativeContributionReceipt(receipt, receipt.hash as Hash, receipt.block);
      for (const runtime of runtimes) rows.push(...decodeContributions(runtime, logs).map(row => ({ ...row, proofKind: 'substrate-extrinsic' as const })));
    }
    if (body.nextOffset === null) return rows;
    if (body.nextOffset !== offset + 100) throw new Error('Native support history returned an invalid page.');
    offset = body.nextOffset;
  }
  throw new Error('Native support history exceeded its read budget.');
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
