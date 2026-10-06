import { describe, expect, it } from 'vitest';
import { zeroAddress, zeroHash } from 'viem';
import { addReleaseTips, artistActivity, receiptDays } from './dashboard';
import type { ContributionReceipt } from '../donations/contributions';
import type { CatalogTrack } from '../../shared/types';
const runtime = `0x${'11'.repeat(20)}` as const;
const account = `0x${'22'.repeat(20)}` as const;
const hash = `0x${'33'.repeat(32)}` as const;
const track = { id: `${runtime}:${hash}`, title: 'Mon cerveau' } as CatalogTrack;
const receipt: ContributionReceipt = {
  runtime,
  id: hash,
  contentHash: hash,
  sender: zeroAddress,
  amount: 100n,
  host: zeroAddress,
  room: zeroHash,
  campaign: zeroHash,
  timestamp: 1791324000000,
  transactionHash: hash,
  proofKind: 'substrate-extrinsic',
  shares: [
    { recipient: account, amount: 40n, role: 0, paid: true, claimed: false },
    { recipient: zeroAddress, amount: 60n, role: 1, paid: true, claimed: false }
  ]
};
describe('artist dashboard accounting', () => {
  it('adds a tip once, keeps the whole distribution separate from the artist share, and scopes by runtime', () => {
    const release = { track, generatedWei: 1000n, receivedWei: 400n, pendingWei: 0n, payments: 1 };
    const result = addReleaseTips([release], [receipt, receipt, { ...receipt, runtime: zeroAddress }], account);
    expect(result[0]).toMatchObject({ generatedWei: 1100n, receivedWei: 440n, pendingWei: 0n, payments: 2 });
    expect(release.generatedWei).toBe(1000n);
  });
  it('shows an artist gift separately from works and treats an unpaid share as claimable', () => {
    const gift = { ...receipt, contentHash: zeroHash, shares: [{ ...receipt.shares[0], paid: false }] };
    const rows = artistActivity([], [gift, gift], [track], account, runtime);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'gift', receivedWei: 0n, pendingWei: 40n, grossWei: 100n, proofKind: 'substrate-extrinsic' });
    expect(addReleaseTips([{ track, generatedWei: 0n, receivedWei: 0n, pendingWei: 0n, payments: 0 }], [gift], account)[0].generatedWei).toBe(0n);
  });
  it('plots only dated received shares inside the 14 local calendar days, never gross value or pending money', () => {
    const rows = artistActivity([], [receipt], [track], account, runtime);
    const now = receipt.timestamp + 86400000;
    const days = receiptDays([...rows, { ...rows[0], timestamp: null, receivedWei: 99n }, { ...rows[0], timestamp: now - 15 * 86400000 }], now);
    expect(days).toHaveLength(14);
    expect(days.reduce((sum, day) => sum + day.amount, 0n)).toBe(40n);
  });
});
