import { zeroHash } from 'viem';
import type { ContributionReceipt } from '../donations/contributions';
import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';
import type { ReleaseEarnings } from './earnings';

export type ArtistActivity = {
  id: string;
  kind: 'listening' | 'gift' | 'tip';
  title: string;
  timestamp: number | null;
  receivedWei: bigint;
  pendingWei: bigint;
  grossWei: bigint;
  hash: `0x${string}`;
  proofKind?: ContributionReceipt['proofKind'];
};
export function artistActivity(
  payments: RoyaltyPayment[],
  contributions: ContributionReceipt[],
  tracks: CatalogTrack[],
  account: string,
  runtime?: string | null
): ArtistActivity[] {
  const rows = new Map<string, ArtistActivity>();
  const seen = new Set<string>();
  for (const payment of payments) {
    const eventId = `${payment.runtimeAddress}:${payment.transactionHash}:${payment.logIndex}`.toLowerCase();
    if (seen.has(eventId) || payment.recipient.toLowerCase() !== account.toLowerCase()) continue;
    seen.add(eventId);
    const key = `listening:${payment.runtimeAddress}:${payment.transactionHash}:${payment.trackHash}`.toLowerCase();
    const row = rows.get(key) ?? {
      id: key,
      kind: 'listening' as const,
      title: payment.trackTitle,
      timestamp: payment.paidAtMs,
      receivedWei: 0n,
      pendingWei: 0n,
      grossWei: 0n,
      hash: payment.transactionHash
    };
    row.grossWei += payment.amountWei;
    if (payment.settlement === 'paid' || payment.settlement === 'claimed') row.receivedWei += payment.amountWei;
    else if (payment.settlement === 'claimable') row.pendingWei += payment.amountWei;
    rows.set(key, row);
  }
  for (const contribution of contributions) {
    const key = `support:${contribution.runtime}:${contribution.id}`.toLowerCase();
    if (rows.has(key)) continue;
    const shares = contribution.shares.filter(share => share.recipient.toLowerCase() === account.toLowerCase());
    if (!shares.length && contribution.runtime.toLowerCase() !== runtime?.toLowerCase()) continue;
    const track = tracks.find(track => track.id.toLowerCase() === `${contribution.runtime}:${contribution.contentHash}`.toLowerCase());
    rows.set(key, {
      id: key,
      kind: contribution.contentHash === zeroHash ? 'gift' : 'tip',
      title: contribution.contentHash === zeroHash ? 'Gift to your artist space' : (track?.title ?? 'Release tip'),
      timestamp: contribution.timestamp,
      hash: contribution.transactionHash,
      proofKind: contribution.proofKind,
      grossWei: contribution.amount,
      receivedWei: shares.reduce((sum, share) => sum + (share.paid || share.claimed ? share.amount : 0n), 0n),
      pendingWei: shares.reduce((sum, share) => sum + (!share.paid && !share.claimed ? share.amount : 0n), 0n)
    });
  }
  return [...rows.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || a.id.localeCompare(b.id));
}

export function addReleaseTips(releases: ReleaseEarnings[], contributions: ContributionReceipt[], account: string): ReleaseEarnings[] {
  const seen = new Set<string>();
  const rows = new Map(releases.map(row => [row.track.id.toLowerCase(), { ...row }]));
  for (const tip of contributions) {
    const id = `${tip.runtime}:${tip.id}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const row = rows.get(`${tip.runtime}:${tip.contentHash}`.toLowerCase());
    if (!row) continue;
    row.generatedWei += tip.amount;
    row.payments += 1;
    for (const share of tip.shares) {
      if (share.recipient.toLowerCase() !== account.toLowerCase()) continue;
      if (share.paid || share.claimed) row.receivedWei += share.amount;
      else row.pendingWei += share.amount;
    }
  }
  return [...rows.values()];
}

export function receiptDays(activity: ArtistActivity[], now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (13 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const start = date.getTime();
    return {
      start,
      amount: activity
        .filter(row => row.timestamp !== null && row.timestamp >= start && row.timestamp < next.getTime())
        .reduce((sum, row) => sum + row.receivedWei, 0n)
    };
  });
}
