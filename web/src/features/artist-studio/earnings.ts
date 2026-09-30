import type { CatalogTrack, RoyaltyPayment } from '../../shared/types';

export type ReleaseEarnings = {
  track: CatalogTrack;
  generatedWei: bigint;
  receivedWei: bigint;
  pendingWei: bigint;
  payments: number;
};

export type EarningsHistoryState = 'idle' | 'loading' | 'ready' | 'stale' | 'unavailable';

export function releaseEarningsKey(runtime: string, hash: string) {
  return `${runtime.toLowerCase()}:${hash.toLowerCase()}`;
}

export function summarizeReleaseEarnings(tracks: CatalogTrack[], payments: RoyaltyPayment[], account: string): ReleaseEarnings[] {
  const rows = new Map<string, ReleaseEarnings>();
  const purchases = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const track of tracks) {
    rows.set(track.id.toLowerCase(), { track, generatedWei: 0n, receivedWei: 0n, pendingWei: 0n, payments: 0 });
  }
  for (const payment of payments) {
    const eventId = `${payment.runtimeAddress.toLowerCase()}:${payment.transactionHash.toLowerCase()}:${payment.logIndex}`;
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    const key = releaseEarningsKey(payment.runtimeAddress, payment.trackHash);
    const row = rows.get(key);
    if (!row) continue;
    // The reader excludes access events already represented by recipient shares.
    // A later claim changes a share's state; it is never a second sale.
    row.generatedWei += payment.amountWei;
    const paidAccess = purchases.get(key) ?? new Set<string>();
    paidAccess.add(`${payment.transactionHash.toLowerCase()}:${payment.listener.toLowerCase()}`);
    purchases.set(key, paidAccess);
    row.payments = paidAccess.size;
    if (payment.recipient.toLowerCase() !== account.toLowerCase()) continue;
    if (payment.settlement === 'paid' || payment.settlement === 'claimed') row.receivedWei += payment.amountWei;
    if (payment.settlement === 'claimable') row.pendingWei += payment.amountWei;
  }
  return [...rows.values()];
}
