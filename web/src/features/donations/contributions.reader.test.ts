import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, zeroAddress, zeroHash, type Address, type Hash } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';

const rpc = vi.hoisted(() => ({ getBlock: vi.fn(), request: vi.fn() }));
vi.mock('../../shared/config/contracts', () => ({ getPublicClient: () => rpc }));

import { contributionReader } from './contributions';

const runtime = '0x1000000000000000000000000000000000000000' as Address;
const sender = '0x2000000000000000000000000000000000000000' as Address;
const id = `0x${'11'.repeat(32)}` as Hash;
const hash = `0x${'22'.repeat(32)}` as Hash;
const contentHash = `0x${'33'.repeat(32)}` as Hash;
const blockHash = `0x${'44'.repeat(32)}` as Hash;

function rpcLog(eventName: 'ContributionReceived' | 'ContributionShare', logIndex: string) {
  return {
    address: runtime,
    blockHash,
    blockNumber: '0x7b',
    logIndex,
    removed: false,
    transactionHash: hash,
    transactionIndex: '0x0',
    topics: encodeEventTopics({
      abi: musicRoyaltiesAbi,
      eventName,
      args: eventName === 'ContributionReceived' ? { id, contentHash, sender } : { id, recipient: sender }
    }),
    data:
      eventName === 'ContributionReceived'
        ? encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
            [3n, zeroAddress, zeroHash, zeroHash, zeroHash, 1700000000n]
          )
        : encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }, { type: 'bool' }], [3n, 0, true])
  };
}

describe('finalized contribution reader', () => {
  beforeEach(() => {
    rpc.getBlock.mockReset().mockResolvedValue({ number: 125n });
    rpc.request.mockReset();
  });

  it('queries Product DevNet with only concrete indexed topics and decodes the receipt', async () => {
    rpc.request.mockResolvedValueOnce([rpcLog('ContributionReceived', '0x0')]).mockResolvedValueOnce([rpcLog('ContributionShare', '0x1')]);

    const receipt = await contributionReader('unused').finalizedReceipt(runtime, id);

    expect(receipt).toMatchObject({ id, runtime, contentHash, sender, amount: 3n, transactionHash: hash, timestamp: 1700000000000 });
    expect(receipt?.shares).toEqual([{ recipient: sender, amount: 3n, role: 0, paid: true, claimed: false }]);
    expect(rpc.request).toHaveBeenCalledTimes(2);
    expect(rpc.request.mock.calls[0][0]).toMatchObject({
      method: 'eth_getLogs',
      params: [{ address: runtime, topics: [expect.any(String), id], fromBlock: '0x0', toBlock: '0x7d' }]
    });
    expect(rpc.request.mock.calls[1][0]).toMatchObject({
      method: 'eth_getLogs',
      params: [{ address: runtime, topics: [expect.any(String), id], fromBlock: '0x7b', toBlock: '0x7b' }]
    });
  });

  it('does not invent a receipt when the finalized intent has no event', async () => {
    rpc.request.mockResolvedValueOnce([]);

    await expect(contributionReader('unused').finalizedReceipt(runtime, id)).resolves.toBeUndefined();
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });
});
