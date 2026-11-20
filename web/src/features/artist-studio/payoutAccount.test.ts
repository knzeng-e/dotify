import { expect, it, vi } from 'vitest';
import { resolvePayoutAccount } from './payoutAccount';
import type { PublicClient } from 'viem';
function client(id: number, accountId: string) {
  return { getChainId: vi.fn(async () => id), readContract: vi.fn(async () => accountId) } as unknown as Pick<PublicClient, 'getChainId' | 'readContract'>;
}
it('uses the on-chain native mapping rather than always padding H160 with EE', async () => {
  const c = client(420420417, '0xb2ef7258bd3e4ec49d9109fbcfd7919bf4af3f7ca7c8253c1387c5829d6a1c70');
  expect(await resolvePayoutAccount(c, '0x2f6BF01a6708C927b288a53B9fE3f9edc689FF56')).toBe('5G7KWbnCUoi1qKvjygWn3JvZNm1b3Z5hzq8V48KpXnpJrNFz');
  expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'toAccountId', blockTag: 'finalized' }));
});
it('accepts the canonical EVM-derived fallback returned by Revive', async () => {
  expect(
    await resolvePayoutAccount(client(420420417, '0xc3571714248588c6e19cdece2778b75341b2c288' + 'ee'.repeat(12)), '0xC3571714248588C6E19cDECe2778B75341b2c288')
  ).toBe('5GUq4mo4fVDKF9ZhQwGyBAhciuF2vXJ8N6fxXS6bKC77N6US');
});
it('rejects a different chain, malformed precompile response and a mismatching account', async () => {
  const address = '0xC3571714248588C6E19cDECe2778B75341b2c288';
  await expect(resolvePayoutAccount(client(1, '0x'), address)).rejects.toThrow('different network');
  await expect(resolvePayoutAccount(client(420420417, '0x'), address)).rejects.toThrow('could not be verified');
  await expect(resolvePayoutAccount(client(420420417, '0x' + '11'.repeat(32)), address)).rejects.toThrow('does not match');
});
