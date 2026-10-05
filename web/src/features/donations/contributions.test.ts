import { describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics as encodeTopics, zeroAddress, zeroHash, type Address, type Hash } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import { ContributionRevertedError, confirmSubmittedContribution, decodeContributions, type ContributionReceipt } from './contributions';

const productRuntime = '0x1000000000000000000000000000000000000000' as Address;
const productHash = `0x${'11'.repeat(32)}` as Hash;
const productId = `0x${'22'.repeat(32)}` as Hash;
const receipt: ContributionReceipt = {
  id: productId,
  runtime: productRuntime,
  contentHash: zeroHash,
  sender: zeroAddress,
  amount: 1n,
  host: zeroAddress,
  room: zeroHash,
  campaign: zeroHash,
  timestamp: 1,
  transactionHash: productHash,
  shares: []
};

describe('contribution confirmation', () => {
  it('confirms a finalized Product contribution by intent without waiting for an EVM receipt', async () => {
    const reader = {
      receipt: vi.fn(async () => receipt),
      finalizedReceipt: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(receipt)
    };
    const wait = vi.fn(async () => undefined);

    await expect(
      confirmSubmittedContribution({
        mode: 'finalized-event',
        runtime: productRuntime,
        hash: productHash,
        id: productId,
        reader,
        polling: { attempts: 2, intervalMs: 0, wait }
      })
    ).resolves.toBe(receipt);

    expect(reader.receipt).not.toHaveBeenCalled();
    expect(reader.finalizedReceipt).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('keeps EVM receipt verification and can recover from its finalized event', async () => {
    const failure = new Error('receipt provider delayed');
    const reader = {
      receipt: vi.fn().mockRejectedValue(failure),
      finalizedReceipt: vi.fn(async () => receipt)
    };

    await expect(confirmSubmittedContribution({ mode: 'evm-receipt', runtime: productRuntime, hash: productHash, id: productId, reader })).resolves.toBe(
      receipt
    );
    expect(reader.receipt).toHaveBeenCalledWith(productRuntime, productHash, productId);
    expect(reader.finalizedReceipt).toHaveBeenCalledWith(productRuntime, productId);
  });
  it('does not reinterpret a proved reverted receipt as a delayed contribution', async () => {
    const reader = { receipt: vi.fn().mockRejectedValue(new ContributionRevertedError()), finalizedReceipt: vi.fn() };
    await expect(
      confirmSubmittedContribution({ mode: 'evm-receipt', runtime: productRuntime, hash: productHash, id: productId, reader })
    ).rejects.toBeInstanceOf(ContributionRevertedError);
    expect(reader.finalizedReceipt).not.toHaveBeenCalled();
  });
});

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
