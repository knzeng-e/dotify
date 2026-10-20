import { expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, zeroAddress, zeroHash, type Address } from 'viem';
import { musicRoyaltiesAbi } from '../../generated/contracts/musicRoyalties';
import { mergeContributionHistory, readNativeContributionHistory } from './nativeContributionHistory';
import type { ContributionReceipt } from './contributions';
const genesisHash = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const row: ContributionReceipt = {
  runtime: zeroAddress,
  id: zeroHash,
  contentHash: zeroHash,
  sender: zeroAddress,
  amount: 42n,
  host: zeroAddress,
  room: zeroHash,
  campaign: zeroHash,
  timestamp: 1,
  transactionHash: zeroHash,
  shares: []
};
it('unions EVM and native receipts by runtime and intent without doubling income', () => {
  expect(mergeContributionHistory([row], [{ ...row, proofKind: 'substrate-extrinsic' }])).toEqual([{ ...row, proofKind: 'substrate-extrinsic' }]);
  expect(() => mergeContributionHistory([row], [{ ...row, amount: 99n }])).toThrow('disagree');
});
it('treats failed or wrong-network history as unavailable, never an empty completed reading', async () => {
  for (const response of [new Response('{}', { status: 503 }), Response.json({ genesisHash: zeroHash, chainId: 420420417, receipts: [] })])
    await expect(
      readNativeContributionHistory(
        'https://api.example',
        [zeroAddress],
        vi.fn(async () => response)
      )
    ).rejects.toThrow();
});
it('binds paged reads to one snapshot and rejects revision drift', async () => {
  const base = { genesisHash, chainId: 420420417, coverage: 'verified-receipts', updatedAt: new Date(1000).toISOString(), receipts: [] };
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...base, nextOffset: 100 }))
    .mockResolvedValueOnce(Response.json({ ...base, updatedAt: new Date(2000).toISOString(), nextOffset: null }));
  await expect(readNativeContributionHistory('https://api.example', [zeroAddress], fetchImpl)).rejects.toThrow('could not be verified');
  expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ offset: 100, revision: base.updatedAt });
});

const historyPage = { genesisHash, chainId: 420420417, coverage: 'verified-receipts', updatedAt: new Date(1000).toISOString(), receipts: [], nextOffset: null };
const catalogRuntimes = Array.from({ length: 101 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}` as Address);
function nativeReceipt(runtime: Address, n: number) {
  const hash = `0x${n.toString(16).padStart(64, '0')}` as const;
  return {
    hash,
    genesisHash,
    status: 'success',
    block: { number: n, hash: zeroHash },
    logs: [
      {
        address: runtime,
        transactionHash: hash,
        logIndex: 0,
        topics: encodeEventTopics({
          abi: musicRoyaltiesAbi,
          eventName: 'ContributionReceived',
          args: { id: hash, contentHash: zeroHash, sender: zeroAddress }
        }),
        data: encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
          [42n, zeroAddress, zeroHash, zeroHash, zeroHash, 100n]
        )
      }
    ]
  };
}
it('reads a catalog larger than 100 runtimes, paging each batch on one revision and deadline', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...historyPage, receipts: [nativeReceipt(catalogRuntimes[0], 1)], nextOffset: 100 }))
    .mockResolvedValueOnce(Response.json({ ...historyPage, receipts: [nativeReceipt(catalogRuntimes[1], 2)] }))
    .mockResolvedValueOnce(Response.json({ ...historyPage, receipts: [nativeReceipt(catalogRuntimes[100], 3)] }));
  const rows = await readNativeContributionHistory('https://api.example', [...catalogRuntimes, catalogRuntimes[0].toUpperCase() as Address], fetchImpl);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.runtime)).toEqual([catalogRuntimes[0], catalogRuntimes[1], catalogRuntimes[100]]);
  const requests = fetchImpl.mock.calls.map(call => JSON.parse(call[1].body));
  expect(requests).toEqual([
    { runtimes: catalogRuntimes.slice(0, 100), offset: 0 },
    { runtimes: catalogRuntimes.slice(0, 100), offset: 100, revision: historyPage.updatedAt },
    { runtimes: catalogRuntimes.slice(100), offset: 0, revision: historyPage.updatedAt }
  ]);
  expect(fetchImpl.mock.calls.every(call => call[1].signal === fetchImpl.mock.calls[0][1].signal)).toBe(true);
});
it('rejects changed or unavailable later batches instead of returning partial income', async () => {
  for (const last of [Response.json({ ...historyPage, updatedAt: new Date(2000).toISOString() }), new Response('{}', { status: 503 })]) {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...historyPage, receipts: [nativeReceipt(catalogRuntimes[0], 1)] }))
      .mockResolvedValueOnce(last);
    await expect(readNativeContributionHistory('https://api.example', catalogRuntimes, fetchImpl)).rejects.toThrow();
  }
});
