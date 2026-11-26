import { expect, it, vi } from 'vitest';
import { zeroAddress } from 'viem';
import { deployments } from '../shared/config/deployments';
import { reconcileRuntime } from './artistOnboardingSession';

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
  const { openArtistOnboarding } = await import('./artistOnboardingSession');
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
  digest.mockRestore();
});
