import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics as encodeTopics, zeroAddress, zeroHash, type Address, type Hash } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import { decodeContributions } from './contributions';

function encodeEventTopics(args: Parameters<typeof encodeTopics>[0]): Hash[] {
  return encodeTopics(args).map(topic => {
    if (typeof topic !== 'string') throw new Error('Fixture requires concrete event topics.');
    return topic;
  });
}

const runtime = `0x${'11'.repeat(20)}` as Address;
const recipient = `0x${'22'.repeat(20)}` as Address;
const tx = `0x${'33'.repeat(32)}` as Hash;
const id = `0x${'44'.repeat(32)}` as Hash;
const received = {
  address: runtime,
  transactionHash: tx,
  logIndex: 0,
  topics: encodeEventTopics({ abi: musicRoyaltiesAbi, eventName: 'ContributionReceived', args: { id, contentHash: zeroHash, sender: recipient } }),
  data: encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
    [100n, zeroAddress, zeroHash, zeroHash, zeroHash, 1700000000n]
  )
};
const share = (amount: bigint, paid: boolean, logIndex: number) => ({
  address: runtime,
  transactionHash: tx,
  logIndex,
  topics: encodeEventTopics({ abi: musicRoyaltiesAbi, eventName: 'ContributionShare', args: { id, recipient } }),
  data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }, { type: 'bool' }], [amount, 0, paid])
});
describe('contribution ledger', () => {
  it('preserves block date and exact paid/pending shares without counting duplicate logs', () => {
    const paid = share(40n, true, 1),
      pending = share(60n, false, 2);
    const rows = decodeContributions(runtime, [received, paid, pending, received, paid, pending]);
    expect(rows).toHaveLength(1);
    expect(rows[0].timestamp).toBe(1700000000000);
    expect(rows[0].shares).toHaveLength(2);
    expect(rows[0].shares.filter(s => s.paid).reduce((n, s) => n + s.amount, 0n)).toBe(40n);
    expect(rows[0].shares.filter(s => !s.paid && !s.claimed).reduce((n, s) => n + s.amount, 0n)).toBe(60n);
  });
  it('settles only pending shares after a claim and ignores receipts from another runtime', () => {
    const claim = {
      address: runtime,
      transactionHash: zeroHash,
      logIndex: 0,
      topics: encodeEventTopics({ abi: musicRoyaltiesAbi, eventName: 'ContributionClaimed', args: { id, recipient } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [60n])
    };
    const rows = decodeContributions(runtime, [received, share(40n, true, 1), share(60n, false, 2), claim]);
    expect(rows[0].shares.map(s => s.claimed)).toEqual([false, true]);
    expect(decodeContributions(recipient, [received, share(100n, true, 1)])).toEqual([]);
  });
});
