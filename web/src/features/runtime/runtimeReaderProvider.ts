// Selects the runtime read adapter and hands callers a plain RuntimeReadPort.
//
// Scope note: this switches READS only. Runtime writes have their own provider
// because they need stricter signer setup: the Product CDM writer must bind the
// connected Product account before any payment or publication transaction can
// be submitted.
//
// Every RuntimeReadPort method already returns a promise, so the Product
// adapter's asynchronous setup (dynamic import, host connection, deployment
// check) hides behind a facade instead of turning ~16 call sites into
// double-awaits. The underlying port resolves once and is shared.

import { createViemRuntimeReader } from './viemRuntimeAdapter';
import { createProductCdmRuntimeReader } from './productCdmRuntimeAdapter';
import { resolveRuntimeAdapterConfig, type RuntimeAdapterConfig } from './runtimeAdapterConfig';
import type { RuntimeReadPort } from './runtimePorts';

export type RuntimeReaderDeps = {
  ethRpcUrl: string;
  config?: RuntimeAdapterConfig;
};

// Build-time constant, not a runtime check. Vite inlines the env value, so a
// build that did not opt in folds this to `false` and Rollup drops the import
// below along with the whole Product contract graph.
//
// That matters more than it looks: @parity/product-sdk-descriptors keeps a
// shared descriptors module that references every chain's metadata, so pulling
// in a single Asset Hub descriptor drags ~5.6 MB of chain metadata into the
// output. Shipping that to a viem build would inflate every Bulletin
// publication - a finite quota - for code that build can never execute.
const PRODUCT_CDM_ENABLED = import.meta.env.VITE_DOTIFY_RUNTIME_ADAPTER === 'product-cdm';

async function createProductCdmReader(config: RuntimeAdapterConfig): Promise<RuntimeReadPort> {
  if (!PRODUCT_CDM_ENABLED) {
    throw new Error(
      'This Dotify build was not built with VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm, so the Product contract adapter is not bundled. Rebuild with that flag to use it.'
    );
  }
  const { createProductCdmContracts } = await import('./productCdmContracts');
  const { resolver, verifyDeployment } = await createProductCdmContracts({ environment: config.productEnvironment });
  // Confirm the host connected a chain that actually holds Dotify's contracts
  // before any catalog read runs. Skipping this would surface a wrong-chain
  // connection as an empty catalog.
  await verifyDeployment();
  return createProductCdmRuntimeReader({ contracts: resolver });
}

/**
 * Build the configured read port.
 *
 * The returned object is usable immediately; the first actual read creates the
 * Product port and later reads reuse it. Creating this provider during React
 * render must not contact the host: room guests and catalog-API readers do not
 * need Product chain capabilities merely to open a shared link.
 *
 * A failed Product setup rejects that read rather than silently falling back to
 * viem - the artist runtime is the authority on access policy. The rejected
 * setup is cleared so a later, explicit read can retry after the host recovers.
 */
export function createRuntimeReader(deps: RuntimeReaderDeps): RuntimeReadPort {
  const config = deps.config ?? resolveRuntimeAdapterConfig(import.meta.env);

  if (config.kind === 'viem') {
    return createViemRuntimeReader({ ethRpcUrl: deps.ethRpcUrl });
  }

  let productPortPromise: Promise<RuntimeReadPort> | null = null;

  function portForRead(): Promise<RuntimeReadPort> {
    productPortPromise ??= createProductCdmReader(config).catch(error => {
      productPortPromise = null;
      throw error;
    });
    return productPortPromise;
  }

  return {
    ensureContract: (...args) => portForRead().then(port => port.ensureContract(...args)),
    resolveArtistRuntime: (...args) => portForRead().then(port => port.resolveArtistRuntime(...args)),
    getArtistCount: (...args) => portForRead().then(port => port.getArtistCount(...args)),
    listArtistRuntimes: (...args) => portForRead().then(port => port.listArtistRuntimes(...args)),
    listRuntimeTracks: (...args) => portForRead().then(port => port.listRuntimeTracks(...args)),
    canAccess: (...args) => portForRead().then(port => port.canAccess(...args)),
    hasPaid: (...args) => portForRead().then(port => port.hasPaid(...args)),
    pendingRuntimeOf: (...args) => portForRead().then(port => port.pendingRuntimeOf(...args)),
    pendingRuntimeStageOf: (...args) => portForRead().then(port => port.pendingRuntimeStageOf(...args)),
    listRoyaltyPaymentLogs: (...args) => portForRead().then(port => port.listRoyaltyPaymentLogs(...args)),
    getRoyaltyClaimable: (...args) => portForRead().then(port => port.getRoyaltyClaimable(...args))
  };
}
