import { describe, expect, it, vi } from 'vitest';
import type { RuntimeReadPort, RuntimeWritePort } from '../runtime/runtimePorts';
import { createSupportPaymentFlow, SupportNotSubmittedError, supportNeedsFunding, supportWasCanceled } from './supportPayment';
import { createUnsupportedCashAccessPaymentIntent, DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET } from './paymentModel';
import { persistentPaymentJournal } from './paymentJournal';

const txHash = `0x${'ab'.repeat(32)}` as const;
function fixture() {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    }
  };
  const reader = { hasPaid: vi.fn(async () => false), canAccess: vi.fn(async () => false) };
  const writer = {
    payForAccess: vi.fn(async () => txHash),
    waitForTransaction: vi.fn(async () => {
      reader.hasPaid.mockResolvedValue(true);
      reader.canAccess.mockResolvedValue(true);
    })
  };
  const input = {
    network: 'product-cdm:devnet',
    listenerAddress: `0x${'11'.repeat(20)}` as const,
    intent: {
      kind: 'track-access' as const,
      rail: 'runtime-native' as const,
      asset: DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET,
      runtimeAddress: `0x${'22'.repeat(20)}` as const,
      contentHash: `0x${'33'.repeat(32)}` as const,
      amountPlanck: 3n
    },
    reader: reader as unknown as RuntimeReadPort,
    writer: writer as unknown as RuntimeWritePort,
    currentAccount: vi.fn(() => true),
    onProgress: vi.fn(),
    verificationOptions: { attempts: 1, delayMs: 0 }
  };
  return { items, storage, reader, writer, input, flow: createSupportPaymentFlow(() => storage) };
}

describe('support payment recovery', () => {
  it('submits once across overlapping taps, waits, and verifies before success', async () => {
    const f = fixture();
    const first = f.flow.run(f.input);
    expect(f.flow.run(f.input)).toBe(first);
    await expect(first).resolves.toMatchObject({ status: 'verified', txHash });
    expect(f.writer.payForAccess).toHaveBeenCalledExactlyOnceWith(f.input.intent, expect.any(Function));
    expect(f.input.onProgress.mock.calls.map(call => call[0])).toEqual(['checking', 'approval', 'confirming', 'verifying']);
    expect(JSON.parse([...f.items.values()][0])).toEqual({ version: 1, txHash, amountPlanck: '3', symbol: 'UNIT' });
  });
  it('keeps a submitted receipt across timeout and page reload; checking never pays again', async () => {
    const f = fixture();
    f.writer.waitForTransaction.mockRejectedValueOnce(new Error('Confirmation timed out'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', txHash });
    const reloaded = createSupportPaymentFlow(() => f.storage);
    f.reader.hasPaid.mockResolvedValue(true);
    f.reader.canAccess.mockResolvedValue(true);
    await expect(reloaded.run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'verified', txHash });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
  });
  it('reserves an unknown Product submission before asking the host; reload cannot resend it', async () => {
    const f = fixture();
    f.writer.payForAccess.mockRejectedValue(new Error('Host disconnected after broadcasting'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    const reloaded = createSupportPaymentFlow(() => f.storage);
    await expect(reloaded.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
    f.reader.hasPaid.mockResolvedValue(true);
    f.reader.canAccess.mockResolvedValue(true);
    await expect(reloaded.run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'verified' });
  });
  it('permits an explicit new attempt after a proven signing rejection', async () => {
    const f = fixture();
    f.writer.payForAccess.mockRejectedValueOnce(
      Object.assign(new Error('Product failed'), { cause: Object.assign(new Error('Rejected'), { name: 'TxSigningRejectedError' }) })
    );
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'canceled' });
    expect(f.items.size).toBe(0);
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'verified' });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(2);
  });
  it('can retry writer setup failure, which provably precedes a submission', async () => {
    const f = fixture();
    f.writer.payForAccess.mockRejectedValueOnce(new SupportNotSubmittedError(new Error('Host connection failed')));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'verified' });
  });
  it('turns a Product transfer dry-run into funding guidance without exposing runtime internals', async () => {
    const f = fixture();
    const dryRun = Object.assign(
      new Error(
        'Product CDM transaction "musicRoyPayAccess" failed: Dry-run failed: {"type":"Module","value":{"type":"Revive","value":{"type":"TransferFailed"}}}'
      ),
      { name: 'ContractDryRunFailedError' }
    );
    f.writer.payForAccess.mockRejectedValueOnce(new SupportNotSubmittedError(dryRun));

    const result = await f.flow.run(f.input);

    expect(result).toMatchObject({
      status: 'failed',
      failureKind: 'funding-required',
      message: 'This payment account could not cover the support and network fee. Add UNIT to the paying account, then try again. No payment was sent.'
    });
    expect(result.message).not.toContain('TransferFailed');
    expect(result.errorDetail).toContain('TransferFailed');
    expect(f.items.size).toBe(0);
  });
  it('recognizes nested Product funding failures but not unrelated pre-submission errors', () => {
    expect(supportNeedsFunding(new SupportNotSubmittedError(Object.assign(new Error('insufficient balance'), { name: 'ContractDryRunFailedError' })))).toBe(
      true
    );
    expect(supportNeedsFunding(new SupportNotSubmittedError(new Error('Host connection failed')))).toBe(false);
  });
  it('does not mistake an access denial after submission for a canceled signature', async () => {
    const f = fixture();
    f.writer.waitForTransaction.mockRejectedValueOnce(new Error('Permission denied by endpoint'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', txHash });
    expect(supportWasCanceled(new Error('Permission denied'))).toBe(false);
  });
  it.each([
    [true, true, 'existing-access'],
    [false, true, 'existing-access'],
    [true, false, 'unverified']
  ] as const)('checks existing access (%s, %s) before asking for payment', async (paid, access, status) => {
    const f = fixture();
    f.reader.hasPaid.mockResolvedValue(paid);
    f.reader.canAccess.mockResolvedValue(access);
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });
  it('fails closed when the initial access query fails', async () => {
    const f = fixture();
    f.reader.canAccess.mockRejectedValue(new Error('Offline'));
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });
  it('does not submit for an account that changed during preflight', async () => {
    const f = fixture();
    f.input.currentAccount.mockReturnValue(false);
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });
  it('keeps paid-but-unavailable audio closed and offers read-only recovery', async () => {
    const f = fixture();
    f.writer.waitForTransaction.mockImplementation(async () => {
      f.reader.hasPaid.mockResolvedValue(true);
    });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'unverified', txHash });
    await expect(f.flow.run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'unverified', hasPaid: true, txHash });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
  });
  it('never sends money from a read-only check, even with no saved attempt', async () => {
    const f = fixture();
    await expect(f.flow.run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'unverified' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });
  it('stops before payment if a reservation cannot be persisted', async () => {
    const f = fixture();
    f.storage.setItem = () => {
      throw new Error('Storage blocked');
    };
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });
  it('retains a submitted hash in memory if updating the journal fails', async () => {
    const f = fixture();
    f.writer.payForAccess.mockImplementation(async () => {
      f.storage.setItem = () => {
        throw new Error('Quota');
      };
      return txHash;
    });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', txHash });
    f.reader.hasPaid.mockResolvedValue(true);
    f.reader.canAccess.mockResolvedValue(true);
    await expect(f.flow.run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'verified', txHash });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
  });
  it('does not reuse another account, network or release attempt', async () => {
    const f = fixture();
    f.writer.payForAccess.mockRejectedValue(new Error('Unknown'));
    await f.flow.run(f.input);
    await f.flow.run({ ...f.input, listenerAddress: `0x${'44'.repeat(20)}` });
    await f.flow.run({ ...f.input, network: 'other' });
    await f.flow.run({ ...f.input, intent: { ...f.input.intent, contentHash: `0x${'55'.repeat(32)}` } });
    await f.flow.run({ ...f.input, intent: { ...f.input.intent, runtimeAddress: `0x${'66'.repeat(20)}` } });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(5);
    expect(f.items.size).toBe(5);
  });
  it('keeps the original requested amount when the catalog price changes during recovery', async () => {
    const f = fixture();
    f.writer.waitForTransaction.mockRejectedValueOnce(new Error('Timed out'));
    await f.flow.run(f.input);
    f.reader.hasPaid.mockResolvedValue(true);
    f.reader.canAccess.mockResolvedValue(true);
    const reloaded = createSupportPaymentFlow(() => f.storage);
    await expect(reloaded.run({ ...f.input, intent: { ...f.input.intent, amountPlanck: 999n }, readOnly: true })).resolves.toMatchObject({
      status: 'verified',
      amountPlanck: 3n,
      assetSymbol: 'UNIT'
    });
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
    expect(f.writer.waitForTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not turn malformed recovery storage into permission to pay', async () => {
    const f = fixture();
    f.storage.getItem = () => '{invalid';
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });

  it('blocks insufficient funds including the known fee before signing, without reserving a payment', async () => {
    const f = fixture();
    f.input.writer.inspectPayment = vi.fn(async () => ({ availableBalance: 4n, estimatedFee: 2n }));
    const result = await f.flow.run(f.input);
    expect(result).toMatchObject({ status: 'failed', failureKind: 'funding-required' });
    expect(result.message).toContain('including the estimated network fee');
    expect(result.message).toContain('No payment was sent');
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
    expect(f.items.size).toBe(0);
  });

  it('shows available balance before approval and fails closed on an account change during inspection', async () => {
    const f = fixture();
    f.input.writer.inspectPayment = vi.fn(async () => {
      f.input.currentAccount.mockReturnValue(false);
      return { availableBalance: 100n };
    });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'failed' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });

  it('keeps an early hash when the writer later loses confirmation', async () => {
    const f = fixture();
    f.input.writer.payForAccess = vi.fn(async (_intent, onStatus) => {
      onStatus?.('broadcasting', txHash);
      throw new Error('Host disconnected');
    });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', txHash });
    await expect(createSupportPaymentFlow(() => f.storage).run({ ...f.input, readOnly: true })).resolves.toMatchObject({ status: 'unverified', txHash });
    expect(f.input.writer.payForAccess).toHaveBeenCalledTimes(1);
  });

  it('never clears a broadcast reservation on a later nested signing rejection', async () => {
    const f = fixture();
    f.input.writer.payForAccess = vi.fn(async (_intent, onStatus) => {
      onStatus?.('broadcasting');
      throw Object.assign(new Error('Disconnected'), { cause: Object.assign(new Error('Rejected'), { name: 'TxSigningRejectedError' }) });
    });
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain' });
    await createSupportPaymentFlow(() => f.storage).run(f.input);
    expect(f.input.writer.payForAccess).toHaveBeenCalledTimes(1);
  });

  it('does not interpret SDK finalization as a Dotify entitlement', async () => {
    const f = fixture();
    f.input.writer.inspectPayment = async () => ({ availableBalance: 100n });
    f.input.writer.payForAccess = vi.fn(async (_intent, onStatus) => {
      onStatus?.('finalized');
      return txHash;
    });
    f.writer.waitForTransaction.mockImplementation(async () => undefined);
    await expect(f.flow.run(f.input)).resolves.toMatchObject({ status: 'unverified', txHash });
    expect(f.input.onProgress).toHaveBeenCalledWith('approval', undefined, { availableBalance: 100n });
    expect(f.input.onProgress.mock.calls.map(call => call[0])).not.toContain('confirming');
  });

  it('serializes independent coordinators before reading the shared reservation', async () => {
    const f = fixture();
    let queue: Promise<unknown> = Promise.resolve();
    const lock = <T>(_key: string, run: () => Promise<T>) => {
      const next = queue.then(run);
      queue = next;
      return next;
    };
    f.writer.payForAccess.mockRejectedValue(new Error('Unknown submission'));
    await Promise.all([createSupportPaymentFlow(() => f.storage, lock).run(f.input), createSupportPaymentFlow(() => f.storage, lock).run(f.input)]);
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
  });

  it('keeps locking failures recoverable without calling the writer', async () => {
    const f = fixture();
    const flow = createSupportPaymentFlow(
      () => f.storage,
      async () => {
        throw new Error('Lock access denied');
      }
    );
    await expect(flow.run(f.input)).resolves.toMatchObject({ status: 'uncertain', errorDetail: 'Lock access denied' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
  });

  it('migrates tab recovery to durable storage and recovers with a fresh tab', async () => {
    const f = fixture();
    f.writer.payForAccess.mockRejectedValue(new Error('Unknown submission'));
    await f.flow.run(f.input);
    const durable = fixture();
    const journal = persistentPaymentJournal(
      () => durable.storage,
      () => f.storage
    );
    await createSupportPaymentFlow(() => journal).run(f.input);
    expect(f.items.size).toBe(0);
    expect(durable.items.size).toBe(1);
    const newTab = fixture();
    await createSupportPaymentFlow(() =>
      persistentPaymentJournal(
        () => durable.storage,
        () => newTab.storage
      )
    ).run(f.input);
    expect(f.writer.payForAccess).toHaveBeenCalledTimes(1);
  });

  it('cannot execute CASH even when an untyped caller bypasses the intent type', async () => {
    const f = fixture();
    const intent = createUnsupportedCashAccessPaymentIntent({ ...f.input.intent, requestedAmount: '3' });
    await expect(f.flow.run({ ...f.input, intent: intent as never })).resolves.toMatchObject({ status: 'failed' });
    expect(f.writer.payForAccess).not.toHaveBeenCalled();
    expect(f.items.size).toBe(0);
  });
});
