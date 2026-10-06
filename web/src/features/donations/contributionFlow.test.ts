import { describe, expect, it, vi } from 'vitest';
import { zeroAddress, zeroHash, type Hash } from 'viem';
import { runContribution, recoverSavedContribution, saveNativeContributionBlock, contributionStorageKey, type ContributionIntent } from './contributionFlow';
import { ContributionRevertedError, contributionId, type ContributionReceipt } from './contributions';
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
  it('persists the finalized native block and reuses it on recovery without sending again', async () => {
    const input = fixture();
    const nativeBlock = { number: 123, hash: input.receipt.transactionHash, index: 2 };
    const send = vi.fn(async () => ({ hash: input.receipt.transactionHash, nativeBlock }));
    input.confirm.mockRejectedValueOnce(new Error('read-back interrupted'));
    expect((await runContribution({ ...input, send })).status).toBe('uncertain');
    expect((await recoverSavedContribution({ ...input, scope: input.intent })).status).toBe('confirmed');
    expect(input.confirm).toHaveBeenLastCalledWith(input.receipt.transactionHash, input.receipt.id, nativeBlock);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('adds a block hint to an older native payment without changing its amount, ID or hash', async () => {
    const input = fixture();
    input.confirm.mockRejectedValueOnce(new Error('missing native block'));
    await runContribution(input);
    const original = JSON.parse(input.storage.getItem(contributionStorageKey(input.intent))!);
    saveNativeContributionBlock(input.intent, 123, input.storage);
    expect(JSON.parse(input.storage.getItem(contributionStorageKey(input.intent))!)).toEqual({ ...original, nativeBlock: { number: 123 } });
    await expect(recoverSavedContribution({ ...input, scope: input.intent })).resolves.toMatchObject({ status: 'confirmed' });
    expect(input.send).toHaveBeenCalledTimes(1);
    expect(input.confirm).toHaveBeenLastCalledWith(input.receipt.transactionHash, input.receipt.id, { number: 123 });
  });
  it('recovers after reload without resubmitting, even if the requested amount changed', async () => {
    const input = fixture();
    input.confirm.mockRejectedValueOnce(new Error('timeout'));
    const interrupted = await runContribution(input);
    expect(interrupted).toMatchObject({
      status: 'uncertain',
      message: expect.stringContaining('still being checked'),
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
  it('preserves the original host timeout through empty read-back, later RPC errors and reload', async () => {
    const input = fixture();
    const timeout = 'Transaction timed out after 300s. The transaction may still be processing on-chain.';
    input.send.mockRejectedValueOnce(new Error(timeout));
    const expected = { status: 'uncertain', technicalMessage: timeout, id: input.receipt.id, hash: undefined };
    expect(await runContribution(input)).toMatchObject(expected);
    expect(await runContribution(input)).toMatchObject(expected);
    input.recover.mockRejectedValueOnce(new Error('Read RPC unavailable'));
    const recovery = { scope: input.intent, storage: input.storage, confirm: input.confirm, recover: input.recover, currentAccount: input.currentAccount };
    expect(await recoverSavedContribution(recovery)).toMatchObject({ ...expected, latestCheckMessage: 'Read RPC unavailable' });
    expect(await recoverSavedContribution(recovery)).toMatchObject(expected);
    expect(input.send).toHaveBeenCalledTimes(1);
    input.recover.mockResolvedValueOnce(input.receipt);
    expect((await recoverSavedContribution(recovery)).status).toBe('confirmed');
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toBeNull();
  });
  it('retains a pending payment when persisting its diagnostic fails', async () => {
    const input = fixture();
    const setItem = vi.fn(input.storage.setItem);
    setItem.mockImplementationOnce(input.storage.setItem).mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    input.send.mockRejectedValueOnce(new Error('host timeout'));
    expect(await runContribution({ ...input, storage: { ...input.storage, setItem } })).toMatchObject({
      status: 'uncertain',
      technicalMessage: 'host timeout'
    });
    expect(input.storage.getItem(contributionStorageKey(input.intent))).not.toBeNull();
    await runContribution(input);
    expect(input.send).toHaveBeenCalledTimes(1);
  });
  it('recovers a saved contribution after reload using only its account and work scope', async () => {
    const input = fixture();
    input.send.mockRejectedValueOnce(new Error('host disconnected after submission'));
    expect((await runContribution(input)).status).toBe('uncertain');
    const scope = {
      network: input.intent.network,
      sender: input.intent.sender,
      runtime: input.intent.runtime,
      context: { contentHash: input.intent.context.contentHash }
    };
    expect(
      (await recoverSavedContribution({ scope, storage: input.storage, confirm: input.confirm, recover: input.recover, currentAccount: input.currentAccount }))
        .status
    ).toBe('uncertain');
    input.recover.mockResolvedValueOnce(input.receipt);
    expect(
      (await recoverSavedContribution({ scope, storage: input.storage, confirm: input.confirm, recover: input.recover, currentAccount: input.currentAccount }))
        .status
    ).toBe('confirmed');
    expect(input.send).toHaveBeenCalledTimes(1);
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toBeNull();
  });
  it('reports a proved finality failure and releases the saved reservation', async () => {
    const input = fixture();
    input.confirm.mockRejectedValueOnce(new ContributionRevertedError());
    expect(await runContribution(input)).toMatchObject({ status: 'failed', message: expect.stringContaining('finalized') });
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toBeNull();
  });
  it('clears a proven pre-submit failure but not an ambiguous failure', async () => {
    const input = fixture();
    input.send.mockRejectedValueOnce(new SupportNotSubmittedError(new Error('insufficient funds')));
    expect((await runContribution(input)).status).toBe('failed');
    expect(input.storage.getItem(contributionStorageKey(input.intent))).toBeNull();
  });
  it('does not submit when the pending reservation cannot be persisted', async () => {
    const input = fixture();
    const storage = {
      ...input.storage,
      setItem: () => {
        throw new Error('storage unavailable');
      }
    };
    expect((await runContribution({ ...input, storage })).status).toBe('failed');
    expect(input.send).not.toHaveBeenCalled();
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
  it('keeps an intent pending when a receipt belongs to another runtime or work', async () => {
    for (const patch of [{ runtime: '0x1000000000000000000000000000000000000000' as const }, { contentHash: `0x${'ff'.repeat(32)}` as Hash }]) {
      const input = fixture();
      input.confirm.mockResolvedValueOnce({ ...input.receipt, ...patch });
      expect((await runContribution(input)).status).toBe('uncertain');
      expect(input.storage.getItem(contributionStorageKey(input.intent))).not.toBeNull();
    }
  });
});
