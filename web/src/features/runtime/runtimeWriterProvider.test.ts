import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNativeRuntimeAccessPaymentIntent } from '../payments/paymentModel';

const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const factory = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
const runtime = '0xcccccccccccccccccccccccccccccccccccccccc' as const;
const hash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' as const;
const productPublicKey = `0x${'11'.repeat(32)}` as const;
const differentProductPublicKey = `0x${'22'.repeat(32)}` as const;

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
  vi.doUnmock('@parity/product-sdk-signer');
});

async function loadProvider() {
  return (await import('./runtimeWriterProvider')).createRuntimeWriter;
}

function productAccount(publicKey = productPublicKey) {
  return {
    publicKey: Uint8Array.from(
      publicKey
        .slice(2)
        .match(/.{2}/g)!
        .map(byte => Number.parseInt(byte, 16))
    ),
    address: '5ProductAccount',
    h160Address: '0x9999999999999999999999999999999999999999'
  };
}

function mockProductSigner(selectedAccount = productAccount()) {
  const signerManagerOptions: unknown[] = [];
  const signerManager = {
    connect: vi.fn(async () => ({ ok: true as const, value: [selectedAccount] })),
    getState: vi.fn(() => ({ selectedAccount })),
    destroy: vi.fn()
  };
  const SignerManager = vi.fn((options?: unknown) => {
    signerManagerOptions.push(options);
    return signerManager;
  });
  const HostProvider = vi.fn(() => ({ type: 'host' }));
  vi.doMock('@parity/product-sdk-signer', () => ({ SignerManager, HostProvider }));
  return { signerManager, signerManagerOptions, SignerManager, HostProvider };
}

function accessIntent(amountPlanck: bigint) {
  return createNativeRuntimeAccessPaymentIntent({
    runtimeAddress: runtime,
    contentHash: hash,
    amountPlanck
  });
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

    const intent = accessIntent(42n);
    await expect(writer.payForAccess(intent)).resolves.toBe(txHash);
    await expect(writer.waitForTransaction(txHash)).resolves.toBeUndefined();

    const { createViemRuntimeWriter } = await import('./viemRuntimeAdapter');
    expect(createViemRuntimeWriter).toHaveBeenCalledTimes(2);
    expect(createViemRuntimeWriter).toHaveBeenCalledWith({ ethRpcUrl: 'https://rpc.example', walletClient });
    expect(getViemWalletClient).toHaveBeenCalledTimes(2);
    expect(viemWriter.payForAccess).toHaveBeenCalledWith(intent);
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

    await expect(writer.payForAccess(accessIntent(1n))).rejects.toThrow(/Product contract write adapter is not bundled/);
  });

  it('routes Product writes through CDM setup without falling back to viem', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    const { signerManager, signerManagerOptions, SignerManager, HostProvider } = mockProductSigner();
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
      config: { kind: 'product-cdm', productEnvironment: 'devnet' },
      productAccount: { productId: 'dotify-test01.dot', publicKey: productPublicKey }
    });

    await expect(writer.createRuntime(factory)).resolves.toBe(txHash);
    const intent = accessIntent(7n);
    await expect(writer.payForAccess(intent)).resolves.toBe(txHash);

    const { createProductCdmContracts } = await import('./productCdmContracts');
    const { createProductCdmRuntimeWriter } = await import('./productCdmRuntimeAdapter');
    const { createViemRuntimeWriter } = await import('./viemRuntimeAdapter');
    const signerOptions = signerManagerOptions[0] as { dappName?: string; persistence?: unknown; createProvider?: (providerType: string) => unknown };
    expect(SignerManager).toHaveBeenCalledTimes(1);
    expect(signerOptions).toMatchObject({ dappName: 'dotify-test01.dot', persistence: null });
    expect(signerOptions.createProvider?.('host')).toEqual({ type: 'host' });
    expect(HostProvider).toHaveBeenCalledWith({
      productAccount: {
        dotNsIdentifier: 'dotify-test01.dot',
        derivationIndex: 0,
        requestName: false
      }
    });
    expect(signerManager.connect).toHaveBeenCalledWith('host');
    expect(createProductCdmContracts).toHaveBeenCalledTimes(1);
    expect(createProductCdmContracts).toHaveBeenCalledWith({ environment: 'devnet', signerManager });
    expect(verifyDeployment).toHaveBeenCalledTimes(1);
    expect(createProductCdmRuntimeWriter).toHaveBeenCalledTimes(1);
    expect(createProductCdmRuntimeWriter).toHaveBeenCalledWith({ contracts: resolver });
    expect(productWriter.createRuntime).toHaveBeenCalledWith(factory);
    expect(productWriter.payForAccess).toHaveBeenCalledWith(intent);
    expect(createViemRuntimeWriter).not.toHaveBeenCalled();
    expect(getViemWalletClient).not.toHaveBeenCalled();
  });

  it('rejects Product writes when the host signer is not the connected Product account', async () => {
    vi.stubEnv('VITE_DOTIFY_RUNTIME_ADAPTER', 'product-cdm');
    const { signerManager } = mockProductSigner(productAccount(differentProductPublicKey));
    const createProductCdmContracts = vi.fn();
    vi.doMock('./productCdmContracts', () => ({ createProductCdmContracts }));
    vi.resetModules();
    const createRuntimeWriter = await loadProvider();

    const writer = createRuntimeWriter({
      ethRpcUrl: 'https://rpc.example',
      getViemWalletClient: vi.fn(async () => ({}) as never),
      config: { kind: 'product-cdm', productEnvironment: 'devnet' },
      productAccount: { productId: 'dotify-test01.dot', publicKey: productPublicKey }
    });

    await expect(writer.payForAccess(accessIntent(1n))).rejects.toThrow(/Product CDM signer mismatch/);
    expect(signerManager.destroy).toHaveBeenCalledTimes(1);
    expect(createProductCdmContracts).not.toHaveBeenCalled();
  });
});
