// Selects the runtime write adapter and hands callers a plain RuntimeWritePort.
//
// Writes are money/ownership operations, so adapter selection is intentionally
// build-time and fail-closed, matching runtimeReaderProvider. The default path
// remains viem with the connected EVM/passkey wallet. Product CDM writes are
// available only in builds that explicitly opt in to the Product contract graph.

import type { getWalletClient } from '../../shared/config/contracts';
import { createProductCdmRuntimeWriter } from './productCdmRuntimeAdapter';
import { resolveRuntimeAdapterConfig, type RuntimeAdapterConfig } from './runtimeAdapterConfig';
import type { RuntimeAccessPolicyUpdate, RuntimeTrackRegistration, RuntimeWritePort } from './runtimePorts';
import { createViemRuntimeWriter } from './viemRuntimeAdapter';

type ViemWalletClient = Awaited<ReturnType<typeof getWalletClient>>;

export type ProductRuntimeSignerAccount = {
  productId: string;
  derivationIndex?: number;
  /** Product account public key already approved by Dotify's wallet flow. */
  publicKey?: `0x${string}`;
};

export type RuntimeWriterDeps = {
  ethRpcUrl: string;
  getViemWalletClient: () => Promise<ViemWalletClient>;
  config?: RuntimeAdapterConfig;
  productAccount?: ProductRuntimeSignerAccount;
};

// Build-time constant. A viem build must not import the Product contract graph,
// because the descriptors are large and cannot execute outside the Product host.
const PRODUCT_CDM_ENABLED = import.meta.env.VITE_DOTIFY_RUNTIME_ADAPTER === 'product-cdm';

type ProductSignerAccountLike = {
  publicKey: Uint8Array;
  address?: string;
  h160Address?: `0x${string}`;
};

type ProductSignerManagerLike = {
  connect: (providerType?: string) => Promise<{ ok: true; value: ProductSignerAccountLike[] } | { ok: false; error: unknown }>;
  getState: () => { selectedAccount: ProductSignerAccountLike | null };
  destroy: () => void;
};

type ProductSignerModule = {
  SignerManager: new (options?: unknown) => ProductSignerManagerLike;
  HostProvider: new (options?: unknown) => unknown;
};

async function createViemWriter(deps: RuntimeWriterDeps): Promise<RuntimeWritePort> {
  const walletClient = await deps.getViemWalletClient();
  return createViemRuntimeWriter({ ethRpcUrl: deps.ethRpcUrl, walletClient });
}

async function createProductSignerManager(account?: ProductRuntimeSignerAccount): Promise<ProductSignerManagerLike> {
  const { SignerManager, HostProvider } = (await import('@parity/product-sdk-signer')) as unknown as ProductSignerModule;
  const productId = account?.productId?.trim() || productIdFromEnv();
  const derivationIndex = account?.derivationIndex ?? 0;
  const expectedPublicKey = normalizeHex(account?.publicKey);

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

  const result = await manager.connect('host');
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
  if (expectedPublicKey && selectedPublicKey.toLowerCase() !== expectedPublicKey) {
    manager.destroy();
    throw new Error(
      `Product CDM signer mismatch: the connected Dotify wallet uses ${expectedPublicKey}, but the Product host selected ${selectedPublicKey}. Reconnect the Product account before submitting a runtime transaction.`
    );
  }

  return manager;
}

async function createProductCdmWriter(config: RuntimeAdapterConfig, productAccount?: ProductRuntimeSignerAccount): Promise<RuntimeWritePort> {
  if (!PRODUCT_CDM_ENABLED) {
    throw new Error(
      'This Dotify build was not built with VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm, so the Product contract write adapter is not bundled. Rebuild with that flag to use it.'
    );
  }

  const { createProductCdmContracts } = await import('./productCdmContracts');
  const signerManager = await createProductSignerManager(productAccount);
  try {
    const { resolver, verifyDeployment } = await createProductCdmContracts({ environment: config.productEnvironment, signerManager });
    await verifyDeployment();
    return createProductCdmRuntimeWriter({ contracts: resolver });
  } catch (error) {
    signerManager.destroy();
    throw error;
  }
}

/**
 * Build the configured write port.
 *
 * Product setup is lazy: creating this provider during React render must not
 * contact the host or prompt the user. The first actual write performs setup and
 * then reuses that Product port for later writes. Viem writes resolve a fresh
 * wallet client per call so account/network changes are observed.
 */
export function createRuntimeWriter(deps: RuntimeWriterDeps): RuntimeWritePort {
  const config = deps.config ?? resolveRuntimeAdapterConfig(import.meta.env);
  let productPortPromise: Promise<RuntimeWritePort> | null = null;

  function portForWrite(): Promise<RuntimeWritePort> {
    if (config.kind === 'viem') return createViemWriter(deps);
    productPortPromise ??= createProductCdmWriter(config, deps.productAccount);
    return productPortPromise;
  }

  return {
    createRuntime: factoryAddress => portForWrite().then(port => port.createRuntime(factoryAddress)),
    installRuntimeStep: factoryAddress => portForWrite().then(port => port.installRuntimeStep(factoryAddress)),
    registerTrack: (runtimeAddress, registration: RuntimeTrackRegistration) => portForWrite().then(port => port.registerTrack(runtimeAddress, registration)),
    payForAccess: intent => portForWrite().then(port => port.payForAccess(intent)),
    setAccessMode: (runtimeAddress, update: RuntimeAccessPolicyUpdate) => portForWrite().then(port => port.setAccessMode(runtimeAddress, update)),
    setReleaseActive: (runtimeAddress, contentHash, active) => portForWrite().then(port => port.setReleaseActive(runtimeAddress, contentHash, active)),
    waitForTransaction: txHash => portForWrite().then(port => port.waitForTransaction(txHash))
  };
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
