import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitAndWatch, TxTimeoutError } from '@parity/product-sdk-tx';
import { createProductPaymentApproval, type ProductPaymentSigner } from './productPaymentApproval';
import { createProductCdmRuntimeWriter } from './productCdmRuntimeAdapter';
import { createSupportPaymentFlow, SupportNotSubmittedError } from '../payments/supportPayment';
import { DOTIFY_PRODUCT_DEVNET_NATIVE_RUNTIME_ASSET } from '../payments/paymentModel';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
function signerFor(promise: Promise<string>) {
  return Object.assign(
    vi.fn(() => promise),
    { publicKey: new Uint8Array(32), signBytes: vi.fn() }
  ) as unknown as ProductPaymentSigner;
}
function sign(signer: ProductPaymentSigner, mocked = false) {
  return signer({} as never, {} as never, {} as never, mocked);
}

afterEach(() => vi.useRealTimers());

describe('Product payment approval lifetime', () => {
  it('fences a late Host signature before allowing an unsigned timeout to retry', async () => {
    const host = deferred<string>();
    const signer = signerFor(host.promise);
    const scope = createProductPaymentApproval(signer);
    const pending = sign(scope.signer);
    expect(scope.unsignedTimeout(new TxTimeoutError(100))).toBe(false);
    scope.close();
    expect(scope.unsignedTimeout(new TxTimeoutError(100))).toBe(true);
    const rejected = expect(pending).rejects.toThrow('confirmation request has ended');
    host.resolve('0xsigned');
    await rejected;
    await expect(sign(scope.signer)).rejects.toThrow('confirmation request has ended');
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it('never calls a returned signature or observed submission retryable', async () => {
    const scope = createProductPaymentApproval(signerFor(Promise.resolve('0xsigned')));
    await sign(scope.signer);
    scope.close();
    expect(scope.unsignedTimeout(new TxTimeoutError(100))).toBe(false);
  });

  it.each(['signing', 'broadcasting', 'in-block', 'finalized'] as const)('retains uncertainty after SDK %s evidence', async status => {
    const scope = createProductPaymentApproval(signerFor(new Promise(() => {})));
    void sign(scope.signer);
    scope.observe(status);
    scope.close();
    expect(scope.unsignedTimeout(new TxTimeoutError(100))).toBe(false);
  });

  it('does not mistake mock signing, generic errors or an unrelated Host timeout for approval expiry', async () => {
    const scope = createProductPaymentApproval(signerFor(Promise.resolve('0xmock')));
    await sign(scope.signer, true);
    scope.close();
    expect(scope.unsignedTimeout(new TxTimeoutError(100))).toBe(false);
    const active = createProductPaymentApproval(signerFor(new Promise(() => {})));
    void sign(active.signer);
    active.close();
    expect(active.unsignedTimeout(new Error('timeout'))).toBe(false);
    expect(active.unsignedTimeout({ name: 'HostTimeoutError', call: 'getStorage' })).toBe(false);
    expect(active.unsignedTimeout({ cause: { name: 'HostTimeoutError', call: 'createTransaction' } })).toBe(true);
  });

  it('uses the real pinned SDK timeout, releases only its unsigned reservation, and blocks a late broadcast', async () => {
    vi.useFakeTimers();
    const host = deferred<string>();
    const broadcast = vi.fn();
    const unsubscribe = vi.fn();
    const signer = signerFor(host.promise);
    let oldSigning: Promise<void> | undefined;
    const method = {
      tx: vi.fn(async (...args: unknown[]) => {
        const options = args[1] as { signer: ProductPaymentSigner; onStatus: NonNullable<import('@parity/product-sdk-tx').SubmitOptions['onStatus']> };
        return submitAndWatch(
          {
            createSubmitAndWatch(scopedSigner: ProductPaymentSigner) {
              return {
                subscribe(observer: { error: (e: unknown) => void }) {
                  // Intentionally ignore unsubscribe here: even a badly behaved late
                  // continuation must not receive a signed transaction from the guard.
                  oldSigning = sign(scopedSigner).then(
                    () => {
                      broadcast();
                    },
                    error => {
                      observer.error(error);
                    }
                  );
                  return { unsubscribe };
                }
              };
            }
          } as never,
          options.signer,
          { timeoutMs: 100, onStatus: options.onStatus }
        );
      })
    };
    const writer = createProductCdmRuntimeWriter({
      nativeTokenDecimals: 10,
      getPaymentSigner: () => signer,
      contracts: { getDirectoryContract: () => ({}), getFactoryContract: () => ({}), getRuntimeContract: () => ({ musicRoyPayAccess: method }) }
    });
    const items = new Map<string, string>();
    const flow = createSupportPaymentFlow(() => ({
      getItem: key => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value);
      },
      removeItem: key => {
        items.delete(key);
      }
    }));
    const input = {
      network: 'product-cdm:devnet',
      listenerAddress: `0x${'11'.repeat(20)}` as const,
      intent: {
        kind: 'track-access' as const,
        rail: 'runtime-native' as const,
        asset: DOTIFY_PRODUCT_DEVNET_NATIVE_RUNTIME_ASSET,
        runtimeAddress: `0x${'22'.repeat(20)}` as const,
        contentHash: `0x${'33'.repeat(32)}` as const,
        amountPlanck: 1_000_000_000_000_000_000n
      },
      reader: { hasPaid: async () => false, canAccess: async () => false } as never,
      writer,
      currentAccount: () => true,
      onProgress: vi.fn(),
      verificationOptions: { attempts: 1, delayMs: 0 }
    };
    const result = flow.run(input);
    await vi.advanceTimersByTimeAsync(110);
    await expect(result).resolves.toMatchObject({ status: 'failed', failureKind: 'approval-expired', message: expect.stringContaining('No payment was sent') });
    expect(items.size).toBe(0);
    expect(unsubscribe).toHaveBeenCalled();
    host.resolve('0xlate');
    await oldSigning;
    expect(items.size).toBe(0);
    expect(broadcast).not.toHaveBeenCalled();
    // No automatic second request was made. The next request is a user action.
    expect(method.tx).toHaveBeenCalledTimes(1);
    expect(signer).toHaveBeenCalledTimes(1);
    expect(new SupportNotSubmittedError(new Error(), 'approval-expired').failureKind).toBe('approval-expired');
  });
});
