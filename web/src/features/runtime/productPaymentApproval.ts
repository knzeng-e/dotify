import type { SignerManager } from '@parity/product-sdk/wallet';
import type { PaymentLifecycle } from './runtimePorts';

export type ProductPaymentSigner = NonNullable<ReturnType<SignerManager['getSigner']>>;

/** A Host response arriving after this attempt ends must never reach submission. */
export function createProductPaymentApproval(signer: ProductPaymentSigner) {
  let closed = false;
  let requested = false;
  let signatureReturned = false;
  let submissionObserved = false;
  const expired = () => new Error('This payment confirmation request has ended. Start a new request in Dotify.');
  const scopedSigner = new Proxy(signer, {
    apply(target, thisArg, args) {
      if (closed) return Promise.reject(expired());
      const mocked = args[3] === true;
      if (!mocked) requested = true;
      return Promise.resolve(Reflect.apply(target, thisArg, args)).then(transaction => {
        if (closed) throw expired();
        if (!mocked) signatureReturned = true;
        return transaction;
      });
    }
  });
  return {
    signer: scopedSigner,
    close() {
      closed = true;
    },
    observe(status: PaymentLifecycle) {
      // SDK 0.5.3 emits "signing" on its created/signed transaction event.
      if (status !== 'error') submissionObserved = true;
    },
    unsignedTimeout(error: unknown): boolean {
      if (!closed || !requested || signatureReturned || submissionObserved) return false;
      for (let depth = 0; error && typeof error === 'object' && depth < 8; depth += 1) {
        const item = error as { name?: string; call?: string; cause?: unknown };
        if (item.name === 'TxTimeoutError' || (item.name === 'HostTimeoutError' && item.call === 'createTransaction')) return true;
        error = item.cause;
      }
      return false;
    }
  };
}
