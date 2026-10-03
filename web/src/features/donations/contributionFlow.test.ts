import { describe, expect, it, vi } from 'vitest';
import { zeroAddress, zeroHash, type Hash } from 'viem';
import { runContribution, contributionStorageKey, type ContributionIntent } from './contributionFlow';
import { contributionId, type ContributionReceipt } from './contributions';
import { SupportNotSubmittedError } from '../payments/supportPayment';

function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    }
  };
  const hash = `0x${'1'.repeat(64)}` as Hash;
  const intent: ContributionIntent = {
    network: 42,
    sender: zeroAddress,
    runtime: zeroAddress,
    amount: 10n,
    proof: '0x',
    context: { contentHash: zeroHash, intentId: hash, room: zeroHash, host: zeroAddress, expiresAt: 1000n },
    quote: { digest: hash, campaign: zeroHash, attestor: zeroAddress, recipients: [zeroAddress], amounts: [10n], roles: [0] }
  };
  const receipt: ContributionReceipt = {
    id: contributionId(intent.sender, hash),
    runtime: zeroAddress,
    contentHash: zeroHash,
    sender: zeroAddress,
    amount: 10n,
    host: zeroAddress,
    room: zeroHash,
    campaign: zeroHash,
    timestamp: 1000,
    transactionHash: hash,
    shares: []
  };
  return {
    intent,
    storage,
    receipt,
    send: vi.fn(async () => hash),
    confirm: vi.fn(async () => receipt),
    recover: vi.fn(async () => undefined as ContributionReceipt | undefined),
    currentAccount: () => true
  };
}
describe('persistent contributions', () => {
  it('recovers after reload without resubmitting, even if the requested amount changed', async () => {
    const input = fixture();
    input.confirm.mockRejectedValueOnce(new Error('timeout'));
    const interrupted = await runContribution(input);
    expect(interrupted).toMatchObject({
      status: 'uncertain',
      message: expect.stringContaining('taking longer than expected'),
      technicalMessage: 'timeout'
    });
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toContain(input.receipt.transactionHash);
    expect((await runContribution({ ...input, intent: { ...input.intent, amount: 99n } })).receipt?.amount).toBe(10n);
    expect(input.send).toHaveBeenCalledTimes(1);
  });
  it('never resends an uncertain transaction without a hash', async () => {
    const input = fixture();
    input.send.mockRejectedValueOnce(new Error('host disconnected'));
    await runContribution(input);
    await runContribution(input);
    expect(input.send).toHaveBeenCalledTimes(1);
    expect(input.recover).toHaveBeenCalledTimes(1);
    input.recover.mockResolvedValueOnce(input.receipt);
    expect((await runContribution(input)).status).toBe('confirmed');
  });
  it('clears a proven pre-submit failure but not an ambiguous failure', async () => {
    const input = fixture();
    input.send.mockRejectedValueOnce(new SupportNotSubmittedError(new Error('insufficient funds')));
    expect((await runContribution(input)).status).toBe('failed');
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toBeNull();
  });
  it('refuses an account change and a mismatched receipt', async () => {
    const input = fixture();
    expect((await runContribution({ ...input, currentAccount: () => false })).status).toBe('failed');
    expect(input.send).not.toHaveBeenCalled();
    input.confirm.mockResolvedValueOnce({ ...input.receipt, amount: 9n });
    expect((await runContribution(input)).status).toBe('uncertain');
    expect(input.storage.getItem(contributionStorageKey(input.intent))).not.toBeNull();
  });
  it('scopes recovery by chain, payer, runtime and work', () => {
    const { intent } = fixture();
    const original = contributionStorageKey(intent);
    expect(contributionStorageKey({ ...intent, network: 43 })).not.toBe(original);
    expect(contributionStorageKey({ ...intent, context: { ...intent.context, contentHash: intent.context.intentId } })).not.toBe(original);
  });
});
