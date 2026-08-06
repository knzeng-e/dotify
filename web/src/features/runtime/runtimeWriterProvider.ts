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

export type RuntimeWriterDeps = {
  ethRpcUrl: string;
  getViemWalletClient: () => Promise<ViemWalletClient>;
  config?: RuntimeAdapterConfig;
};

// Build-time constant. A viem build must not import the Product contract graph,
// because the descriptors are large and cannot execute outside the Product host.
const PRODUCT_CDM_ENABLED = import.meta.env.VITE_DOTIFY_RUNTIME_ADAPTER === 'product-cdm';

async function createViemWriter(deps: RuntimeWriterDeps): Promise<RuntimeWritePort> {
  const walletClient = await deps.getViemWalletClient();
  return createViemRuntimeWriter({ ethRpcUrl: deps.ethRpcUrl, walletClient });
}

async function createProductCdmWriter(config: RuntimeAdapterConfig): Promise<RuntimeWritePort> {
  if (!PRODUCT_CDM_ENABLED) {
    throw new Error(
      'This Dotify build was not built with VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm, so the Product contract write adapter is not bundled. Rebuild with that flag to use it.'
    );
  }

  const { createProductCdmContracts } = await import('./productCdmContracts');
  const { resolver, verifyDeployment } = await createProductCdmContracts({ environment: config.productEnvironment });
  await verifyDeployment();
  return createProductCdmRuntimeWriter({ contracts: resolver });
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
    productPortPromise ??= createProductCdmWriter(config);
    return productPortPromise;
  }

  return {
    createRuntime: factoryAddress => portForWrite().then(port => port.createRuntime(factoryAddress)),
    installRuntimeStep: factoryAddress => portForWrite().then(port => port.installRuntimeStep(factoryAddress)),
    registerTrack: (runtimeAddress, registration: RuntimeTrackRegistration) => portForWrite().then(port => port.registerTrack(runtimeAddress, registration)),
    payForAccess: (runtimeAddress, contentHash, value) => portForWrite().then(port => port.payForAccess(runtimeAddress, contentHash, value)),
    setAccessMode: (runtimeAddress, update: RuntimeAccessPolicyUpdate) => portForWrite().then(port => port.setAccessMode(runtimeAddress, update)),
    setReleaseActive: (runtimeAddress, contentHash, active) => portForWrite().then(port => port.setReleaseActive(runtimeAddress, contentHash, active)),
    waitForTransaction: txHash => portForWrite().then(port => port.waitForTransaction(txHash))
  };
}
