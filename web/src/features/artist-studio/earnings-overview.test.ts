import { describe, expect, it } from 'vitest';
import { zeroHash, type Address, type Hash } from 'viem';
import type { ContributionReceipt } from '../donations/contributions';
import { combineEarningsSources, summarizeContributionEarnings } from './earnings';

const artist = `0x${'11'.repeat(20)}` as Address;
const runtime = `0x${'22'.repeat(20)}` as Address;
const other = `0x${'33'.repeat(20)}` as Address;
const hash = `0x${'44'.repeat(32)}` as Hash;
function receipt(patch: Partial<ContributionReceipt> = {}): ContributionReceipt {
  return {
    id: hash,
    runtime,
    contentHash: zeroHash,
    sender: other,
    amount: 100n,
    host: other,
    room: zeroHash,
    campaign: zeroHash,
    timestamp: 1,
    transactionHash: hash,
    shares: [
      { recipient: artist, amount: 60n, paid: true, claimed: false, role: 0 },
      { recipient: other, amount: 40n, paid: true, claimed: false, role: 1 }
    ],
    ...patch
  };
}
describe('all-source artist earnings', () => {
  it('separates gross generation from receipts and never counts duplicated contributions twice', () => {
    const gift = receipt();
    const tip = receipt({
      id: zeroHash,
      contentHash: hash,
      shares: [
        { recipient: artist, amount: 50n, paid: false, claimed: false, role: 0 },
        { recipient: other, amount: 50n, paid: true, claimed: false, role: 2 }
      ]
    });
    const summary = summarizeContributionEarnings([gift, gift, tip], runtime, artist);
    expect(summary).toEqual({ giftsGeneratedWei: 100n, tipsGeneratedWei: 100n, giftsReceivedWei: 60n, tipsReceivedWei: 0n, claimableWei: 50n });
    expect(combineEarningsSources({ generatedWei: 200n, receivedWei: 80n, claimableWei: 10n }, summary)).toEqual({
      generatedWei: 400n,
      receivedWei: 140n,
      claimableWei: 60n
    });
  });
  it('includes cross-runtime host receipts but not sent donations as artist income', () => {
    const sent = receipt({ runtime: other, sender: artist, shares: [{ recipient: other, amount: 100n, paid: true, claimed: false, role: 0 }] });
    const hosting = receipt({
      runtime: other,
      id: zeroHash,
      contentHash: hash,
      shares: [{ recipient: artist, amount: 20n, paid: false, claimed: true, role: 2 }]
    });
    const summary = summarizeContributionEarnings([sent, hosting], runtime, artist);
    expect(summary).toEqual({ giftsGeneratedWei: 0n, tipsGeneratedWei: 0n, giftsReceivedWei: 0n, tipsReceivedWei: 20n, claimableWei: 0n });
  });
  it('does not label partial source totals as complete or conflate unknown claim balances with zero', () => {
    const contributions = summarizeContributionEarnings([], runtime, artist);
    expect(combineEarningsSources({ generatedWei: 10n, receivedWei: 5n, claimableWei: 0n }, null)).toEqual({
      generatedWei: null,
      receivedWei: null,
      claimableWei: null
    });
    expect(combineEarningsSources({ generatedWei: null, receivedWei: null, claimableWei: null }, contributions)).toEqual({
      generatedWei: null,
      receivedWei: null,
      claimableWei: null
    });
    expect(combineEarningsSources({ generatedWei: 10n, receivedWei: 5n, claimableWei: null }, contributions)).toEqual({
      generatedWei: 10n,
      receivedWei: 5n,
      claimableWei: null
    });
  });
});
