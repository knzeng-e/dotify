import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./viemRuntimeAdapter', () => ({
  createViemRuntimeReader: vi.fn(() => ({ kind: 'viem', getArtistCount: async () => 7n })),
  createViemRuntimeWriter: vi.fn()
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock('./productCdmContracts');
  vi.doUnmock('./productCdmRuntimeAdapter');
});

async function loadProvider() {
  return (await import('./runtimeReaderProvider')).createRuntimeReader;
}

describe('createRuntimeReader', () => {
  it('uses the viem reader by default', async () => {
    const createRuntimeReader = await loadProvider();
    const reader = createRuntimeReader({ ethRpcUrl: 'https://rpc.example', config: { kind: 'viem', productEnvironment: 'devnet' } });

    await expect(reader.getArtistCount('0x1' as never)).resolves.toBe(7n);
  });

  it('explains that the Product graph is absent when the build did not opt in', async () => {
    // The adapter is selected at build time so an unopted build can tree-shake
    // ~5.6 MB of chain metadata away. Asking for it anyway must say exactly
    // that, not surface a confusing connection error.
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'viem');
    vi.resetModules();
    const createRuntimeReader = await loadProvider();

    const reader = createRuntimeReader({
      ethRpcUrl: 'https://rpc.example',
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    await expect(reader.getArtistCount('0x1' as never)).rejects.toThrow(/not bundled/);
  });

  it('surfaces a failed Product setup on every read instead of falling back to viem', async () => {
    // Silently degrading would leave the adapter in use ambiguous, and the
    // artist runtime is the authority on access policy.
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    vi.doMock('./productCdmContracts', () => ({
      createProductCdmContracts: async () => {
        throw new Error('no host provider');
      }
    }));
    vi.resetModules();
    const createRuntimeReader = await loadProvider();

    const reader = createRuntimeReader({
      ethRpcUrl: 'https://rpc.example',
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    await expect(reader.getArtistCount('0x1' as never)).rejects.toThrow(/no host provider/);
    await expect(reader.ensureContract('0x1' as never)).rejects.toThrow(/no host provider/);
  });

  it('does not contact the Product host until an authoritative runtime read is requested', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    const verifyDeployment = vi.fn(async () => undefined);
    const productReader = {
      getArtistCount: vi.fn(async () => 3n),
      ensureContract: vi.fn(async () => true)
    };
    const createProductCdmContracts = vi.fn(async () => ({ resolver: {}, verifyDeployment }));
    vi.doMock('./productCdmContracts', () => ({ createProductCdmContracts }));
    vi.doMock('./productCdmRuntimeAdapter', () => ({
      createProductCdmRuntimeReader: vi.fn(() => productReader)
    }));
    vi.resetModules();
    const createRuntimeReader = await loadProvider();

    const reader = createRuntimeReader({
      ethRpcUrl: 'https://rpc.example',
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    expect(createProductCdmContracts).not.toHaveBeenCalled();
    await expect(reader.getArtistCount('0x1' as never)).resolves.toBe(3n);
    await expect(reader.ensureContract('0x1' as never)).resolves.toBe(true);
    expect(createProductCdmContracts).toHaveBeenCalledTimes(1);
    expect(verifyDeployment).toHaveBeenCalledTimes(1);
  });

  it('retries Product reader setup after a host transport failure', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    const productReader = { getArtistCount: vi.fn(async () => 4n) };
    const createProductCdmContracts = vi
      .fn()
      .mockRejectedValueOnce(new Error('protocol version mismatch'))
      .mockResolvedValue({ resolver: {}, verifyDeployment: vi.fn(async () => undefined) });
    vi.doMock('./productCdmContracts', () => ({ createProductCdmContracts }));
    vi.doMock('./productCdmRuntimeAdapter', () => ({
      createProductCdmRuntimeReader: vi.fn(() => productReader)
    }));
    vi.resetModules();
    const createRuntimeReader = await loadProvider();
    const reader = createRuntimeReader({
      ethRpcUrl: 'https://rpc.example',
      config: { kind: 'product-cdm', productEnvironment: 'devnet' }
    });

    await expect(reader.getArtistCount('0x1' as never)).rejects.toThrow(/protocol version mismatch/);
    await expect(reader.getArtistCount('0x1' as never)).resolves.toBe(4n);
    expect(createProductCdmContracts).toHaveBeenCalledTimes(2);
  });
});
