import { hasSupportedQualificationRuntime } from './report';
import { sanitizeHostSoftwareObservation } from '../features/productHost/productHostInfo';

export const ACCOUNT_PRODUCT_ID = 'dotify-test01.dot';
export const ACCOUNT_DERIVATION_INDEX = 0;

type ProductAccount = { dotNsIdentifier: string; derivationIndex: number; publicKey: Uint8Array };
type AccountResult = { match: <T>(ok: (value: ProductAccount) => T, error: (error: unknown) => T) => PromiseLike<T> };
export type AccountReaderDeps = {
  provider: { getProductAccount: (productId: string, index: number) => AccountResult } | null;
  deriveH160: (key: Uint8Array) => `0x${string}`;
  ss58Encode: (key: Uint8Array, prefix: number) => string;
};
export type AccountObservation =
  | {
      status: 'reported';
      accountRequested: true;
      productId: typeof ACCOUNT_PRODUCT_ID;
      derivationIndex: 0;
      publicKey: `0x${string}`;
      substrateAddress: string;
      evmAddress: `0x${string}`;
    }
  | { status: 'unsupported-runtime' | 'unavailable' | 'invalid-response' | 'timeout'; accountRequested: boolean };

async function loadAccountReader(): Promise<AccountReaderDeps> {
  const [host, address] = await Promise.all([import('@parity/product-sdk/host'), import('@parity/product-sdk/address')]);
  return { provider: await host.getAccountsProvider(), deriveH160: address.deriveH160, ss58Encode: address.ss58Encode };
}

/** A public-address snapshot only: never construct a signer or query a chain. */
function observeAccount(value: ProductAccount, deps: AccountReaderDeps): AccountObservation {
  if (
    value?.dotNsIdentifier !== ACCOUNT_PRODUCT_ID ||
    value.derivationIndex !== ACCOUNT_DERIVATION_INDEX ||
    !(value.publicKey instanceof Uint8Array) ||
    value.publicKey.length !== 32 ||
    !value.publicKey.some(byte => byte !== 0)
  )
    return { status: 'invalid-response', accountRequested: true };
  // Own the bytes before deriving either address; retain no mutable Host payload.
  const key = new Uint8Array(value.publicKey);
  const evmAddress = deps.deriveH160(key);
  const substrateAddress = deps.ss58Encode(key, 42);
  if (!/^0x[a-fA-F0-9]{40}$/.test(evmAddress) || !/^[1-9A-HJ-NP-Za-km-z]{47,50}$/.test(substrateAddress))
    return { status: 'invalid-response', accountRequested: true };
  return {
    status: 'reported',
    accountRequested: true,
    productId: ACCOUNT_PRODUCT_ID,
    derivationIndex: ACCOUNT_DERIVATION_INDEX,
    publicKey: `0x${Array.from(key, byte => byte.toString(16).padStart(2, '0')).join('')}`,
    substrateAddress,
    evmAddress
  };
}

/** One attempt per document. Timeout/abort cannot queue another prompt or accept a late identity. */
export function createAccountReader(load: () => Promise<AccountReaderDeps> = loadAccountReader, timeoutMs = 60_000) {
  let attempted = false;
  return (host: unknown, signal: AbortSignal): Promise<AccountObservation | null> => {
    if (signal.aborted) return Promise.resolve(null);
    if (!hasSupportedQualificationRuntime(sanitizeHostSoftwareObservation(host)))
      return Promise.resolve({ status: 'unsupported-runtime', accountRequested: false });
    if (attempted) return Promise.resolve({ status: 'unavailable', accountRequested: false });
    attempted = true;
    return new Promise(resolve => {
      let settled = false;
      let accountRequested = false;
      const finish = (result: AccountObservation | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        resolve(result);
      };
      const abort = () => finish(null);
      const timer = setTimeout(() => finish({ status: 'timeout', accountRequested }), timeoutMs);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve()
        .then(async () => {
          if (settled) return;
          const deps = await load();
          if (settled) return;
          if (!deps.provider) return finish({ status: 'unavailable', accountRequested: false });
          accountRequested = true;
          await deps.provider.getProductAccount(ACCOUNT_PRODUCT_ID, ACCOUNT_DERIVATION_INDEX).match(
            value => {
              if (!settled) finish(observeAccount(value, deps));
            },
            () => finish({ status: 'unavailable', accountRequested: true })
          );
        })
        .catch(() => finish({ status: 'unavailable', accountRequested }));
    });
  };
}

export const readQualificationAccount = createAccountReader();
