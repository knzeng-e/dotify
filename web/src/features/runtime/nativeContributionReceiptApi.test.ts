import { describe, expect, it, vi } from 'vitest';
import { readNativeContributionReceiptApi } from './nativeContributionReceiptApi';
import { FinalizedNativeContributionFailedError } from './nativeContributionProof';
const hash = `0x${'11'.repeat(32)}` as const;
const blockHash = `0x${'22'.repeat(32)}` as const;
const genesisHash = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const result = {
  hash,
  block: { number: 123, hash: blockHash, index: 2 },
  genesisHash,
  status: 'success',
  logs: [{ address: `0x${'33'.repeat(20)}`, data: '0x1234', topics: [hash], transactionHash: hash, logIndex: 0 }]
};
function read(body: unknown = result, status = 200) {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const promise = readNativeContributionReceiptApi({ apiUrl: 'https://api.dotify.example', hash, block: { number: 123 }, fetchImpl });
  return { promise, fetchImpl };
}
describe('native receipt API transport', () => {
  it('uses HTTPS API receipt reads without invoking unsupported host RPC methods', async () => {
    const f = read();
    await expect(f.promise).resolves.toEqual(result.logs);
    expect(f.fetchImpl).toHaveBeenCalledWith(
      'https://api.dotify.example/api/contributions/native-receipt',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ hash, block: { number: 123 } }), signal: expect.any(AbortSignal) })
    );
  });
  it('rejects a different genesis, hash or block before accepting success or failed status', async () => {
    for (const patch of [{ genesisHash: hash }, { hash: blockHash }, { block: { number: 124, hash: blockHash } }]) {
      await expect(read({ ...result, ...patch, status: 'failed' }).promise).rejects.toThrow('different network or transaction');
    }
  });
  it('recognizes a proved failed transaction only from the bound API response', async () => {
    await expect(read({ ...result, status: 'failed', logs: [] }).promise).rejects.toBeInstanceOf(FinalizedNativeContributionFailedError);
  });
  it('retains archive errors and correlation references as uncertainty', async () => {
    await expect(read({ error: 'Archive unavailable', requestId: 'request-123' }, 503).promise).rejects.toThrow('Archive unavailable Reference: request-123');
    await expect(read({ ...result, logs: [{ ...result.logs[0], transactionHash: blockHash }] }).promise).rejects.toThrow('unreadable events');
  });
});
