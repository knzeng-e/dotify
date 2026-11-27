import { requireProductTransactionHost } from '../productHost/productTransactionHost';

export type ProductRuntimeSignerAccount = {
  productId: string;
  derivationIndex?: number;
  /** H160 address Dotify uses for runtime access checks and pallet-revive calls. */
  evmAddress?: `0x${string}`;
  /** Product account public key already approved by Dotify's wallet flow. */
  publicKey?: `0x${string}`;
};

type ProductSignerAccountLike = {
  publicKey: Uint8Array;
  address?: string;
  h160Address?: `0x${string}`;
};

type ProductSignerManagerLike = {
  getSigner: import('@parity/product-sdk/wallet').SignerManager['getSigner'];
  connect: (providerType?: string) => Promise<{ ok: true; value: ProductSignerAccountLike[] } | { ok: false; error: unknown }>;
  getState: () => { selectedAccount: ProductSignerAccountLike | null };
  destroy: () => void;
};

type ProductSignerModule = {
  SignerManager: new (options?: unknown) => ProductSignerManagerLike;
  HostProvider: new (options?: unknown) => unknown;
};

type ProductAddressModule = {
  deriveH160: (publicKey: Uint8Array) => `0x${string}`;
};

export async function createProductSignerManager(account?: ProductRuntimeSignerAccount): Promise<ProductSignerManagerLike> {
  await requireProductTransactionHost();
  const [{ SignerManager, HostProvider }, { deriveH160 }] = await Promise.all([
    import('@parity/product-sdk/wallet') as Promise<ProductSignerModule>,
    import('@parity/product-sdk/address') as Promise<ProductAddressModule>
  ]);
  const productId = account?.productId?.trim() || productIdFromEnv();
  const derivationIndex = account?.derivationIndex ?? 0;
  const expectedPublicKey = normalizeHex(account?.publicKey);
  const expectedH160Address = normalizeHex(account?.evmAddress);

  const manager = new SignerManager({
    dappName: productId,
    persistence: null,
    createProvider(providerType: string) {
      if (providerType !== 'host') {
        throw new Error(`Product CDM writes only support the Product host signer, not "${providerType}".`);
      }
      return new HostProvider({
        productAccount: {
          dotNsIdentifier: productId,
          derivationIndex,
          requestName: false
        }
      });
    }
  });

  const result = await manager.connect('host').catch(error => {
    manager.destroy();
    throw error;
  });
  if (!result.ok) {
    manager.destroy();
    throw new Error(`Product CDM signer connection failed: ${describe(result.error)}`);
  }

  const selectedAccount = manager.getState().selectedAccount ?? result.value[0] ?? null;
  if (!selectedAccount) {
    manager.destroy();
    throw new Error(`Product CDM writes need a Product host account for ${productId}. Connect with "Use Polkadot app", then try again.`);
  }

  const selectedPublicKey = hexFromBytes(selectedAccount.publicKey);
  const derivedH160Address = normalizeHex(deriveH160(selectedAccount.publicKey));
  const selectedH160Address = normalizeHex(selectedAccount.h160Address);

  if (selectedH160Address && selectedH160Address !== derivedH160Address) {
    manager.destroy();
    throw new Error(
      `Product CDM signer account mapping mismatch: the host signer reports H160 ${selectedH160Address}, but deriving pallet-revive H160 from its Product public key gives ${derivedH160Address}. Refusing to submit a runtime transaction.`
    );
  }

  if (expectedH160Address && derivedH160Address !== expectedH160Address) {
    manager.destroy();
    throw new Error(
      `Product CDM signer account mismatch: the connected Dotify account maps to ${expectedH160Address}, but the Product host signer maps to ${derivedH160Address}. Reconnect the Product account before submitting a runtime transaction.`
    );
  }

  if (expectedPublicKey && selectedPublicKey.toLowerCase() !== expectedPublicKey) {
    manager.destroy();
    throw new Error(
      `Product CDM signer mismatch: the connected Dotify wallet uses ${expectedPublicKey}, but the Product host selected ${selectedPublicKey}. Reconnect the Product account before submitting a runtime transaction.`
    );
  }

  return manager;
}

function productIdFromEnv(): string {
  const productId = String(import.meta.env.VITE_DOTIFY_PRODUCT_ID ?? '').trim();
  return productId || 'dotify-test01.dot';
}

function normalizeHex(value: `0x${string}` | undefined): string | null {
  return value ? value.toLowerCase() : null;
}

function hexFromBytes(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
