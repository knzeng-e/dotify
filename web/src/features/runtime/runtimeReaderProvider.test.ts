import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./viemRuntimeAdapter', () => ({
  createViemRuntimeReader: vi.fn(() => ({ kind: 'viem', getArtistCount: async () => 7n })),
  createViemRuntimeWriter: vi.fn()
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock('./productCdmContracts');
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
});
