import { expect, it, vi } from 'vitest';
import { ss58Encode } from '@parity/product-sdk/address';
import { hexToBytes, zeroAddress } from 'viem';
import { deployments } from '../shared/config/deployments';
import { openArtistOnboarding, reconcileRuntime } from './artistOnboardingSession';

const host = vi.hoisted(() => ({ signer: vi.fn(), contracts: vi.fn() }));
vi.mock('../features/runtime/productRuntimeSigner', () => ({ createProductSignerManager: host.signer }));
vi.mock('../features/runtime/productCdmContracts', () => ({ createProductCdmContracts: host.contracts }));

it('reconciles creation, every interrupted stage and finalized ownership lookup', () => {
  const runtime = deployments.factory;
  expect(reconcileRuntime(zeroAddress, zeroAddress, 0n)).toEqual({ stage: 0, runtime: null });
  for (let stage = 1; stage <= 7; stage++) {
    expect(reconcileRuntime(zeroAddress, runtime, BigInt(stage))).toEqual({ stage, runtime });
  }
  expect(reconcileRuntime(runtime, zeroAddress, 0n)).toEqual({ stage: 'ready', runtime });
  for (const [registered, pending, stage] of [
    [zeroAddress, zeroAddress, 4n],
    [runtime, runtime, 4n],
    [zeroAddress, runtime, 0n],
    [zeroAddress, runtime, 8n],
    [zeroAddress, runtime, '4']
  ]) {
    expect(() => reconcileRuntime(registered, pending, stage)).toThrow('inconsistent installation state');
  }
});

it('rejects an unexpected address before it can construct a Product signer', async () => {
  const digest = vi.spyOn(crypto.subtle, 'digest');
  await expect(
    openArtistOnboarding({
      status: 'reported',
      accountRequested: true,
      productId: 'dotify-test01.dot',
      derivationIndex: 0,
      publicKey: `0x${'12'.repeat(32)}`,
      substrateAddress: 'unused',
      evmAddress: deployments.factory
    })
  ).rejects.toThrow('differs from the artist account');
  expect(digest).toHaveBeenCalledOnce();
  expect(host.signer).not.toHaveBeenCalled();
  digest.mockRestore();
});

it('simulates before approval, rejects stale reviews and submits only the reviewed step with its peak cap', async () => {
  const key = `0x${'12'.repeat(32)}` as const;
  const signerKey = hexToBytes(key);
  const digest = vi
    .spyOn(crypto.subtle, 'digest')
    .mockResolvedValueOnce(hexToBytes('0xf033680e6ef4b801d178e6c3f3a5e0f0edc95d76dc2edf12d1220281af754492').buffer as ArrayBuffer);
  const hash = `0x${'23'.repeat(32)}`;
  const read = (value: unknown) => ({ query: vi.fn(async () => ({ success: true, value })) });
  let stage = 0;
  const create = vi.fn();
  const install = vi.fn(async () => ({ ok: true, value: { ok: true, txHash: hash, block: { hash } } }));
  const dryRun = vi.fn(async () => ({ result: { success: true, value: { flags: 0 } }, storage_deposit: { type: 'Charge', value: 12n } }));
  const stageQuery = vi.fn(async () => ({ success: true, value: BigInt(stage) }));
  host.signer.mockResolvedValueOnce({ getState: () => ({ selectedAccount: { publicKey: signerKey } }), destroy: vi.fn() });
  host.contracts.mockResolvedValueOnce({
    nativeTokenDecimals: 10,
    finalizedHash: async () => hash,
    dryRunCall: dryRun,
    readMappedAccount: async () => ss58Encode(signerKey, 42),
    readAvailableBalance: async () => 50n,
    destroy: vi.fn(),
    resolver: {
      getFactoryContract: () => ({
        directory: read(deployments.directory),
        pendingRuntimeOf: { query: async () => ({ success: true, value: stage ? deployments.initializer : zeroAddress }) },
        pendingRuntimeStageOf: { query: stageQuery },
        createRuntime: { tx: create },
        installRuntimeStep: { tx: install }
      }),
      getDirectoryContract: () => ({ runtimeOf: read(zeroAddress), factory: read(deployments.factory) })
    }
  });
  try {
    const session = await openArtistOnboarding({
      status: 'reported',
      accountRequested: true,
      productId: 'dotify-test01.dot',
      derivationIndex: 0,
      publicKey: key,
      substrateAddress: 'fixture',
      evmAddress: deployments.factory
    });
    const initial = await session.preview();
    if (initial.status !== 'review') throw new Error('Expected creation preview');
    expect(create).not.toHaveBeenCalled();
    expect(dryRun).toHaveBeenCalledOnce();
    stage = 4;
    const record = vi.fn();
    const changed = await session.approve(initial, record);
    if (changed.status !== 'changed' || changed.preview.status !== 'review') throw new Error('Expected a fresh review');
    expect(changed.preview.state.stage).toBe(4);
    expect(record).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    await expect(session.approve(changed.preview, record)).resolves.toEqual({ status: 'finalized', hash });
    expect(record).toHaveBeenCalledOnce();
    expect(install).toHaveBeenCalledExactlyOnceWith({ waitFor: 'finalized', storageDepositLimit: 12n });
    session.close();
  } finally {
    digest.mockRestore();
  }
});
