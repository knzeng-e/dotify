import { describe, expect, it, vi } from 'vitest';
import { DOTIFY_CDM_PACKAGES, createProductCdmContracts, type ProductCdmContractsDeps } from './productCdmContracts';
import cdmManifest from '../../generated/contracts/cdm.json';

const DIRECTORY = cdmManifest.contracts['@dotify/artist-directory'].address as `0x${string}`;
const FACTORY = cdmManifest.contracts['@dotify/artist-runtime-factory'].address as `0x${string}`;
const RUNTIME = '0x00000000000000000000000000000000000000aa' as const;

type Handles = { artistCountSuccess?: boolean };

function buildDeps(overrides: Handles = {}, spies: Record<string, ReturnType<typeof vi.fn>> = {}): ProductCdmContractsDeps {
  const artistCountQuery = vi.fn(async () => ({ success: overrides.artistCountSuccess ?? true, value: 3n, gasRequired: {} }));
  const managerContract = { artistCount: { query: artistCountQuery } };

  const createContract = spies.createContract ?? vi.fn(() => ({ musicAccCanAccess: { query: vi.fn() } }));
  const destroy = spies.destroy ?? vi.fn();

  class ContractManager {
    getAddress(library: string) {
      if (library === DOTIFY_CDM_PACKAGES.directory) return DIRECTORY;
      if (library === DOTIFY_CDM_PACKAGES.factory) return FACTORY;
      throw new Error(`unknown package ${library}`);
    }
    getContract() {
      return managerContract;
    }
  }

  return {
    loadContracts: async () =>
      ({
        ContractManager,
        createContractRuntimeFromClient: vi.fn(() => ({ runtime: true })),
        createContract
      }) as never,
    loadChain: async () => ({ createChainClient: spies.createChainClient ?? vi.fn(async () => ({ raw: { assetHub: {} }, destroy })) }) as never,
    loadDescriptor: async () => ({ descriptor: true })
  };
}

describe('createProductCdmContracts', () => {
  it('resolves the manifest contracts by their deployed addresses', async () => {
    const { resolver } = await createProductCdmContracts({ environment: 'devnet' }, buildDeps());

    expect(() => resolver.getDirectoryContract(DIRECTORY)).not.toThrow();
    expect(() => resolver.getFactoryContract(FACTORY)).not.toThrow();
    await expect(resolver.hasContract?.(DIRECTORY)).resolves.toBe(true);
    await expect(resolver.hasContract?.(RUNTIME)).resolves.toBe(false);
  });

  it('refuses a directory address that does not match the manifest', async () => {
    const { resolver } = await createProductCdmContracts({ environment: 'devnet' }, buildDeps());

    expect(() => resolver.getDirectoryContract(RUNTIME)).toThrow(/does not match CDM package/);
  });

  it('binds the merged facet ABI to a per-artist runtime address', async () => {
    const createContract = vi.fn((..._args: unknown[]) => ({ musicAccCanAccess: { query: vi.fn() } }));
    const { resolver } = await createProductCdmContracts({ environment: 'devnet' }, buildDeps({}, { createContract }));

    resolver.getRuntimeContract(RUNTIME);

    expect(createContract).toHaveBeenCalledTimes(1);
    const [, address, abi] = createContract.mock.calls[0];
    expect(address).toBe(RUNTIME);
    expect(Array.isArray(abi)).toBe(true);
  });

  it('names the missing host connection instead of reporting an RPC failure', async () => {
    const createChainClient = vi.fn(async () => {
      throw new Error('no host provider');
    });

    await expect(createProductCdmContracts({ environment: 'devnet' }, buildDeps({}, { createChainClient }))).rejects.toThrow(
      /Polkadot Product host connection/
    );
  });

  it('verifyDeployment rejects a chain that does not answer for the directory', async () => {
    // A wrong-chain connection otherwise looks like an artist with no releases.
    const { verifyDeployment } = await createProductCdmContracts({ environment: 'devnet' }, buildDeps({ artistCountSuccess: false }));

    await expect(verifyDeployment()).rejects.toThrow(/did not answer on the "devnet" chain/);
  });

  it('verifyDeployment passes when the directory answers', async () => {
    const { verifyDeployment } = await createProductCdmContracts({ environment: 'devnet' }, buildDeps());

    await expect(verifyDeployment()).resolves.toBeUndefined();
  });
});
