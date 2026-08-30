// Real Product CDM contract wiring for the runtime ports.
//
// This closes the gap `createProductCdmRuntimeContractResolver` documented: the
// adapter knew how to map Dotify's runtime surface onto Product contract
// handles, but nothing could actually produce those handles.
//
// Two resolution paths, because Dotify's contracts have two shapes:
//
//   ArtistDirectory / ArtistRuntimeFactory - one fixed address each, so they
//   come from the generated snapshot manifest through `ContractManager`.
//
//   Artist runtimes - a diamond deployed per artist, so the address is only
//   known at call time. Those bind the merged facet ABI to that address with
//   `createContract`, which needs no manifest entry.
//
// Two hard constraints shape this file:
//
//   1. `createChainClient`/`getChainAPI` route exclusively through the Product
//      host provider. There is no direct-WebSocket fallback, so this path
//      cannot work in the standalone build and must fail closed outside a host
//      container rather than appear to work.
//
//   2. The host decides which chain an environment resolves to. Dotify's
//      runtimes are deployed on Polkadot Hub TestNet (EVM chain 420420417);
//      if the host connects an environment that does not hold them, every
//      manifest address resolves to an account with no code. `verifyDeployment`
//      turns that into an explicit error instead of an empty catalog.
//
// Everything Product-specific loads through dynamic imports so a standalone
// build never pulls the PAPI/contract tree into its entry chunk, matching how
// productHost.ts loads the host SDK.

import type { Address } from 'viem';
import cdmManifest from '../../generated/contracts/cdm.json';
import { SMART_RUNTIME_LIBRARY, smartRuntimeAbi } from '../../generated/contracts/smartRuntime';
import {
  ProductCdmRuntimeError,
  type ProductCdmContractHandle,
  type ProductCdmRuntimeContractResolver,
  type ProductCdmRuntimePackages
} from './productCdmRuntimeAdapter';

export const DOTIFY_CDM_PACKAGES: ProductCdmRuntimePackages = {
  directory: '@dotify/artist-directory',
  factory: '@dotify/artist-runtime-factory',
  runtime: SMART_RUNTIME_LIBRARY
};

/**
 * The Product chain environment Dotify targets.
 *
 * Only `devnet`, and that is a correctness constraint rather than a
 * simplification. Product DevNet is not a separate chain: it is a preset over
 * the Paseo system parachains - Asset Hub (1000), People (1004), Bulletin
 * (1010) - with EVM chain id 420420417. That is exactly where Dotify's
 * contracts are already deployed, confirmed by identical ArtistDirectory
 * bytecode served from both the DevNet and Hub TestNet endpoints.
 *
 * The SDK's `paseo` preset is a trap here: it points at the Paseo **Next** v2
 * deployment (Asset Hub Next 1500 / People Next 1502), which the Product docs
 * describe as "a different network" where "funds sent there will not appear on
 * this Devnet". Dotify has no deployment there, and none on Polkadot or Kusama
 * Asset Hub. Offering those presets would only let an operator select a chain
 * that cannot hold the catalog.
 *
 * Each descriptor is also a ~850 kB metadata chunk that ships with the Bulletin
 * publication whether or not it is fetched, and Bulletin storage is a finite
 * quota. Add an environment here only when Dotify actually deploys there.
 */
export type ProductChainEnvironment = 'devnet';

export type ProductCdmContractsOptions = {
  environment: ProductChainEnvironment;
  /** Signer manager from @parity/product-sdk/wallet, when transactions are in scope. */
  signerManager?: unknown;
};

type ContractsModule = typeof import('@parity/product-sdk/contracts');
type ChainModule = typeof import('@parity/product-sdk/chain');

export type ProductCdmContractsDeps = {
  loadContracts: () => Promise<ContractsModule>;
  loadChain: () => Promise<ChainModule>;
  loadDescriptor: (environment: ProductChainEnvironment) => Promise<unknown>;
};

const DESCRIPTOR_LOADERS: Record<ProductChainEnvironment, () => Promise<unknown>> = {
  devnet: async () => (await import('@parity/product-sdk-descriptors/devnet-asset-hub')).devnet_asset_hub
};

const defaultDeps: ProductCdmContractsDeps = {
  loadContracts: () => import('@parity/product-sdk/contracts'),
  loadChain: () => import('@parity/product-sdk/chain'),
  loadDescriptor: environment => DESCRIPTOR_LOADERS[environment]()
};

export type ProductCdmContracts = {
  resolver: ProductCdmRuntimeContractResolver;
  /**
   * Confirm the connected chain actually holds Dotify's contracts. Call before
   * serving catalog reads: a wrong-chain connection otherwise looks like an
   * artist with no releases rather than a misconfiguration.
   */
  verifyDeployment: () => Promise<void>;
  /** Close the chain connection opened for this resolver. */
  destroy: () => void;
};

/**
 * Build a live Product CDM contract resolver.
 *
 * Fails loudly rather than degrading: a caller that cannot reach the chain must
 * not silently fall back to another data source, because the artist runtime is
 * the authority on access policy.
 */
export async function createProductCdmContracts(
  options: ProductCdmContractsOptions,
  deps: ProductCdmContractsDeps = defaultDeps
): Promise<ProductCdmContracts> {
  const [contracts, chain, descriptor] = await Promise.all([deps.loadContracts(), deps.loadChain(), deps.loadDescriptor(options.environment)]);

  // createChainClient, not getChainAPI: the zero-config preset table statically
  // references every environment's assetHub, bulletin, and individuality
  // descriptors, which pulled ~5 MB of chain metadata into the published
  // bundle. Passing the one descriptor we resolved keeps that to a single
  // lazily-fetched chunk.
  let client: Awaited<ReturnType<ChainModule['createChainClient']>>;
  try {
    client = await chain.createChainClient({ chains: { assetHub: descriptor } } as never);
  } catch (error) {
    // The SDK throws here when no host provider is present. Name that, because
    // "connection failed" would send an operator hunting for an RPC problem.
    throw new ProductCdmRuntimeError(
      `Product CDM mode needs a Polkadot Product host connection for the "${options.environment}" environment. Open Dotify inside the Product host, or keep the viem runtime adapter selected. Cause: ${describe(error)}`
    );
  }

  const runtime = contracts.createContractRuntimeFromClient(client.raw.assetHub, descriptor);
  const manager = new contracts.ContractManager(cdmManifest as never, runtime, {
    signerManager: options.signerManager as never
  });

  function manifestAddress(packageName: string): Address {
    return manager.getAddress(packageName) as Address;
  }

  function requireManifestAddress(packageName: string, requested: Address, label: string): void {
    const resolved = manifestAddress(packageName);
    if (resolved.toLowerCase() !== requested.toLowerCase()) {
      throw new ProductCdmRuntimeError(
        `${label} address ${requested} does not match CDM package ${packageName} at ${resolved}. Regenerate the manifest after a redeploy (npm run generate:cdm).`
      );
    }
  }

  const resolver: ProductCdmRuntimeContractResolver = {
    async hasContract(address) {
      // Only the manifest's fixed contracts are knowable from a snapshot. A
      // per-artist runtime address is not, so callers read false as "not one of
      // the manifest contracts", never as "not deployed".
      return [DOTIFY_CDM_PACKAGES.directory, DOTIFY_CDM_PACKAGES.factory].some(packageName => {
        try {
          return manifestAddress(packageName).toLowerCase() === address.toLowerCase();
        } catch {
          return false;
        }
      });
    },

    getDirectoryContract(directoryAddress) {
      requireManifestAddress(DOTIFY_CDM_PACKAGES.directory, directoryAddress, 'ArtistDirectory');
      return manager.getContract(DOTIFY_CDM_PACKAGES.directory) as unknown as ProductCdmContractHandle;
    },

    getFactoryContract(factoryAddress) {
      requireManifestAddress(DOTIFY_CDM_PACKAGES.factory, factoryAddress, 'ArtistRuntimeFactory');
      return manager.getContract(DOTIFY_CDM_PACKAGES.factory) as unknown as ProductCdmContractHandle;
    },

    getRuntimeContract(runtimeAddress) {
      // Per-artist diamond: bind the merged facet ABI to this address.
      return contracts.createContract(runtime, runtimeAddress, smartRuntimeAbi as never, {
        signerManager: options.signerManager as never
      }) as unknown as ProductCdmContractHandle;
    }
  };

  async function verifyDeployment(): Promise<void> {
    const directory = manager.getContract(DOTIFY_CDM_PACKAGES.directory) as unknown as ProductCdmContractHandle;
    const artistCount = directory.artistCount;
    if (!artistCount?.query) {
      throw new ProductCdmRuntimeError(
        'Generated CDM manifest has no artistCount query on the ArtistDirectory package. Regenerate it with npm run generate:cdm.'
      );
    }

    const result = await artistCount.query();
    if (!result.success) {
      throw new ProductCdmRuntimeError(
        `ArtistDirectory at ${manifestAddress(DOTIFY_CDM_PACKAGES.directory)} did not answer on the "${options.environment}" chain. Dotify's runtimes live on Paseo Asset Hub (parachain 1000, EVM chain 420420417), which is what the Product DevNet preset targets; confirm the host connected that chain and not Asset Hub Next (1500), which is a different network.`
      );
    }
  }

  return { resolver, verifyDeployment, destroy: () => client.destroy() };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
