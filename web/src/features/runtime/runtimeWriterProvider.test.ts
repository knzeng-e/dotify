import { afterEach, describe, expect, it, vi } from 'vitest';

const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const factory = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
const runtime = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const hash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' as const;

const viemWriter = {
  createRuntime: vi.fn(async () => txHash),
  installRuntimeStep: vi.fn(async () => txHash),
  registerTrack: vi.fn(async () => txHash),
  payForAccess: vi.fn(async () => txHash),
  setAccessMode: vi.fn(async () => txHash),
  setReleaseActive: vi.fn(async () => txHash),
  waitForTransaction: vi.fn(async () => undefined)
};

const productWriter = {
  createRuntime: vi.fn(async () => txHash),
  installRuntimeStep: vi.fn(async () => txHash),
  registerTrack: vi.fn(async () => txHash),
  payForAccess: vi.fn(async () => txHash),
  setAccessMode: vi.fn(async () => txHash),
  setReleaseActive: vi.fn(async () => txHash),
  waitForTransaction: vi.fn(async () => undefined)
};

vi.mock('./viemRuntimeAdapter', () => ({
  createViemRuntimeWriter: vi.fn(() => viemWriter)
}));

vi.mock('./productCdmRuntimeAdapter', () => ({
  createProductCdmRuntimeWriter: vi.fn(() => productWriter)
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock('./productCdmContracts');
});

async function loadProvider() {
  return (await import('./runtimeWriterProvider')).createRuntimeWriter;
}

describe('createRuntimeWriter', () => {
  it('uses the viem writer by default and resolves the active wallet per write', async () => {
    const createRuntimeWriter = await loadProvider();
    const walletClient = { writeContract: vi.fn() };
    const getViemWalletClient = vi.fn(async () => walletClient as never);

    const writer = createRuntimeWriter({
      ethRpcUrl: 'https://rpc.example',
      getViemWalletClient,
      config: { kind: 'viem', productEnvironment: 'devnet' }
    });

    await expect(writer.payForAccess(runtime, hash, 42n)).resolves.toBe(txHash);
    await expect(writer.waitForTransaction(txHash)).resolves.toBeUndefined();

    const { createViemRuntimeWriter } = await import('./viemRuntimeAdapter');
    expect(createViemRuntimeWriter).toHaveBeenCalledTimes(2);
    expect(createViemRuntimeWriter).toHaveBeenCalledWith({ ethRpcUrl: 'https://rpc.example', walletClient });
    expect(getViemWalletClient).toHaveBeenCalledTimes(2);
    expect(viemWriter.payForAccess).toHaveBeenCalledWith(runtime, hash, 42n);
  });

  it('explains that Product writes are absent when the build did not opt in', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'viem');
    vi.resetModules();
    const createRuntimeWriter = await loadProvider();

    const writer = createRuntimeWriter({
      ethRpcUrl: 'https://rpc.example',
      getViemWalletClient: vi.fn(async () => ({}) as never),
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    await expect(writer.payForAccess(runtime, hash, 1n)).rejects.toThrow(/Product contract write adapter is not bundled/);
  });

  it('routes Product writes through CDM setup without falling back to viem', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    const verifyDeployment = vi.fn(async () => undefined);
    const resolver = { getRuntimeContract: vi.fn() };
    vi.doMock('./productCdmContracts', () => ({
      createProductCdmContracts: vi.fn(async () => ({
        resolver,
        verifyDeployment,
        destroy: vi.fn()
      }))
    }));
    vi.resetModules();
    const createRuntimeWriter = await loadProvider();

    const getViemWalletClient = vi.fn(async () => ({}) as never);
    const writer = createRuntimeWriter({
      ethRpcUrl: 'https://rpc.example',
      getViemWalletClient,
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    await expect(writer.createRuntime(factory)).resolves.toBe(txHash);
    await expect(writer.payForAccess(runtime, hash, 7n)).resolves.toBe(txHash);

    const { createProductCdmContracts } = await import('./productCdmContracts');
    const { createProductCdmRuntimeWriter } = await import('./productCdmRuntimeAdapter');
    const { createViemRuntimeWriter } = await import('./viemRuntimeAdapter');
    expect(createProductCdmContracts).toHaveBeenCalledTimes(1);
    expect(createProductCdmContracts).toHaveBeenCalledWith({ environment: 'devnet' });
    expect(verifyDeployment).toHaveBeenCalledTimes(1);
    expect(createProductCdmRuntimeWriter).toHaveBeenCalledTimes(1);
    expect(createProductCdmRuntimeWriter).toHaveBeenCalledWith({ contracts: resolver });
    expect(productWriter.createRuntime).toHaveBeenCalledWith(factory);
    expect(productWriter.payForAccess).toHaveBeenCalledWith(runtime, hash, 7n);
    expect(createViemRuntimeWriter).not.toHaveBeenCalled();
    expect(getViemWalletClient).not.toHaveBeenCalled();
  });
});
