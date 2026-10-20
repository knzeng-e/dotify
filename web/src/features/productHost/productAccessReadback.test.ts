import { afterEach, describe, expect, it, vi } from 'vitest';
import * as evidence from './productCdmHostSmokeEvidence';
import { captureProductAccessReadback } from './productAccessReadback';

const candidate = { gitSha: 'a'.repeat(40), productAppVersion: '[0, 1, 29]', deployedCid: 'test-candidate' };
function fixture() {
  const session: evidence.ProductCdmHostSmokeSession = { schemaVersion: 2, startedAt: '2026-09-27T12:00:00Z', candidate, events: [] };
  const getSession = vi.spyOn(evidence, 'getProductCdmHostSmokeSession').mockReturnValue(session);
  const publish = vi.spyOn(evidence, 'publishProductAccessReadbackMetric').mockImplementation(() => {});
  const input = {
    reader: { hasPaid: vi.fn(async () => true), canAccess: vi.fn(async () => true) },
    buildSha: candidate.gitSha,
    productAppVersion: candidate.productAppVersion,
    runtimeAddress: `0x${'11'.repeat(20)}` as const,
    contentHash: `0x${'22'.repeat(32)}` as const,
    listenerAddress: `0x${'33'.repeat(20)}` as const,
    chainId: 420420417,
    isCurrent: vi.fn(() => true)
  };
  return { session, getSession, publish, input };
}
afterEach(() => vi.restoreAllMocks());

describe('Product read-only access capture', () => {
  it('reads the exact release without a writer and exports no payment amount or hash', async () => {
    const { input, publish } = fixture();
    await captureProductAccessReadback(input);
    for (const read of [input.reader.hasPaid, input.reader.canAccess]) {
      expect(read).toHaveBeenCalledExactlyOnceWith(input.runtimeAddress, input.contentHash, input.listenerAddress);
    }
    expect(publish).toHaveBeenCalledExactlyOnceWith({
      runtimeAddress: input.runtimeAddress,
      contentHash: input.contentHash,
      listenerAddress: input.listenerAddress,
      chainId: input.chainId,
      hasPaid: true,
      canAccess: true,
      timestamp: expect.any(Number)
    });
  });

  it.each(['unbound', 'other-build', 'other-version', 'stale-selection'])('does not read or collect outside a current capture: %s', reason => {
    const { input, getSession, publish } = fixture();
    if (reason === 'unbound') getSession.mockReturnValue(null);
    if (reason === 'other-build') input.buildSha = 'b'.repeat(40);
    if (reason === 'other-version') input.productAppVersion = '[0, 1, 28]';
    if (reason === 'stale-selection') input.isCurrent.mockReturnValue(false);
    return captureProductAccessReadback(input).then(() => {
      expect(input.reader.hasPaid).not.toHaveBeenCalled();
      expect(input.reader.canAccess).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });

  it.each(['account', 'reset', 'rebound'])('discards a read when the %s changes while pending', async change => {
    const { input, publish, session, getSession } = fixture();
    input.reader.hasPaid.mockImplementation(async () => {
      if (change === 'account') input.isCurrent.mockReturnValue(false);
      if (change === 'reset') getSession.mockReturnValue(null);
      if (change === 'rebound') getSession.mockReturnValue({ ...session, candidate: { ...candidate, deployedCid: 'another-candidate' } });
      return true;
    });
    await captureProductAccessReadback(input);
    expect(publish).not.toHaveBeenCalled();
  });

  it('records unknown results on RPC failure without exposing the raw error or preventing playback', async () => {
    const { input, publish } = fixture();
    input.reader.hasPaid.mockRejectedValue(new Error('private endpoint details'));
    await expect(captureProductAccessReadback(input)).resolves.toBeUndefined();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ hasPaid: null, canAccess: null }));
    expect(JSON.stringify(publish.mock.calls)).not.toContain('private endpoint details');
  });
});
