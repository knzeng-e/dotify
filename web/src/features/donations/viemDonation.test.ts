import { beforeEach, expect, it, vi } from 'vitest';
import { createViemDonationPort } from './viemDonation';
import { SupportNotSubmittedError } from '../payments/supportPayment';
import type { getWalletClient } from '../../shared/config/contracts';
const mocks = vi.hoisted(() => ({ estimateGas: vi.fn(), waitForTransactionReceipt: vi.fn(), getTransaction: vi.fn() }));
vi.mock('../../shared/config/contracts', () => ({
  resolveEvmChain: async () => ({ id: 420420417, nativeCurrency: { name: 'Paseo', symbol: 'PAS', decimals: 18 } }),
  getPublicClient: () => mocks
}));
const sender = `0x${'11'.repeat(20)}` as const;
const recipient = `0x${'22'.repeat(20)}` as const;
const hash = `0x${'33'.repeat(32)}` as const;
function fixture() {
  const wallet = { account: { address: sender }, chain: { id: 420420417 }, sendTransaction: vi.fn(async () => hash) };
  return { wallet, make: () => createViemDonationPort('test', sender, async () => wallet as unknown as Awaited<ReturnType<typeof getWalletClient>>) };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
  mocks.getTransaction.mockResolvedValue({ from: sender, to: recipient, value: 2n, input: '0x' });
});
it('estimates before approval and verifies the exact plain-value transfer', async () => {
  const f = fixture();
  const port = await f.make();
  expect(port.asset.decimals).toBe(18);
  await expect(port.send(recipient, 2n)).resolves.toEqual({ hash, finalized: false });
  expect(f.wallet.sendTransaction).toHaveBeenCalledWith({ to: recipient, value: 2n });
  await expect(port.confirm({ hash, amount: 2n }, recipient)).resolves.toBeUndefined();
});
it('does not submit on gas failure or a changed wallet network', async () => {
  const f = fixture();
  const port = await f.make();
  mocks.estimateGas.mockRejectedValueOnce(new Error('Insufficient funds'));
  await expect(port.send(recipient, 2n)).rejects.toBeInstanceOf(SupportNotSubmittedError);
  f.wallet.chain.id = 1;
  await expect(port.send(recipient, 2n)).rejects.toBeInstanceOf(SupportNotSubmittedError);
  expect(f.wallet.sendTransaction).not.toHaveBeenCalled();
});
it.each([{ to: sender }, { from: recipient }, { value: 3n }, { input: '0xab' }])('rejects a mismatched receipt %s', async mismatch => {
  mocks.getTransaction.mockResolvedValue({ from: sender, to: recipient, value: 2n, input: '0x', ...mismatch });
  await expect((await fixture().make()).confirm({ hash, amount: 2n }, recipient)).rejects.toThrow();
});
it('rejects a reverted transfer', async () => {
  mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' });
  await expect((await fixture().make()).confirm({ hash, amount: 2n }, recipient)).rejects.toThrow();
});
