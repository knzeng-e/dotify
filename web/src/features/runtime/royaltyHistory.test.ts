import { describe, expect, it } from 'vitest';
import { mergeRoyaltyEvents, royaltyPaymentsFromEvents, type RoyaltyEvent } from './royaltyHistory';
const runtime = `0x${'11'.repeat(20)}` as const;
const recipient = `0x${'22'.repeat(20)}` as const;
const listener = `0x${'33'.repeat(20)}` as const;
const hash = `0x${'44'.repeat(32)}` as const;
const nativeHash = `0x${'55'.repeat(32)}` as const;
const work = `0x${'66'.repeat(32)}` as const;
const base: RoyaltyEvent = {
  eventName: 'MusicRoyRoyaltyClaimable',
  args: { contentHash: work, listener, recipient, amount: 10n, pendingTotal: 10n },
  transactionHash: hash,
  blockNumber: 1n,
  transactionIndex: 2,
  logIndex: 3
};
const times = new Map([
  ['1', 1000],
  ['2', 2000],
  ['3', 3000]
]);
describe('mixed EVM and native royalty history', () => {
  it('deduplicates the same extrinsic by block/index despite different hashes and log offsets', () => {
    const native = { ...base, transactionHash: nativeHash, logIndex: 5, proofKind: 'substrate-extrinsic' as const };
    const rows = mergeRoyaltyEvents([base], [native]);
    expect(rows).toEqual([native]);
    expect(royaltyPaymentsFromEvents(runtime, rows, times)).toMatchObject([{ amountWei: 10n, settlement: 'claimable', proofKind: 'substrate-extrinsic' }]);
  });
  it('rejects conflicting duplicate evidence rather than choosing the more convenient source', () => {
    expect(() => mergeRoyaltyEvents([base], [{ ...base, args: { ...base.args, amount: 11n }, proofKind: 'substrate-extrinsic' }])).toThrow('disagree');
  });
  it('does not collapse different transactions with the same split amounts', () => {
    expect(mergeRoyaltyEvents([base], [{ ...base, transactionHash: nativeHash, transactionIndex: 3 }])).toHaveLength(2);
  });
  it('applies a native claim to an older EVM accrual, preserving each proof kind', () => {
    const claim: RoyaltyEvent = {
      ...base,
      eventName: 'MusicRoyRoyaltyClaimed',
      args: { recipient, amount: 10n },
      blockNumber: 2n,
      transactionHash: nativeHash,
      proofKind: 'substrate-extrinsic'
    };
    const rows = royaltyPaymentsFromEvents(runtime, mergeRoyaltyEvents([base], [claim]), times);
    expect(rows).toMatchObject([
      { settlement: 'claimed', proofKind: 'evm-transaction', claimProofKind: 'substrate-extrinsic', claimTransactionHash: nativeHash, claimedAtMs: 2000 }
    ]);
  });
  it('never applies an earlier claim to a later accrual or another recipient', () => {
    const oldClaim: RoyaltyEvent = { ...base, eventName: 'MusicRoyRoyaltyClaimed', args: { recipient, amount: 10n } };
    const later = { ...base, blockNumber: 2n };
    expect(royaltyPaymentsFromEvents(runtime, [oldClaim, later], times)).toMatchObject([{ settlement: 'claimable' }]);
    const otherClaim = { ...oldClaim, blockNumber: 3n, args: { recipient: listener, amount: 10n } };
    expect(royaltyPaymentsFromEvents(runtime, [base, otherClaim], times)).toMatchObject([{ settlement: 'claimable' }]);
  });
  it('counts access gross once and keeps legacy access-only receipts out of settled income', () => {
    const access: RoyaltyEvent = { ...base, eventName: 'MusicRoyAccessPaid', args: { contentHash: work, listener, amount: 10n }, logIndex: 4 };
    expect(royaltyPaymentsFromEvents(runtime, [base, access], times)).toHaveLength(1);
    expect(royaltyPaymentsFromEvents(runtime, [access], times)).toMatchObject([{ settlement: 'legacy' }]);
  });
});
