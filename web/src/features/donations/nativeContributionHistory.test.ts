import { expect, it, vi } from 'vitest';
import { zeroAddress, zeroHash } from 'viem';
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
