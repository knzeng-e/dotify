import { describe, expect, it, vi } from 'vitest';
import { assertClassicPrice, MAX_REGISTRY_PRICE, parseExactEvmAmount } from './nativePrice';
import { createViemRuntimeWriter } from './viemRuntimeAdapter';
import { createProductCdmRuntimeWriter } from './productCdmRuntimeAdapter';
import { DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET, createNativeRuntimeAccessPaymentIntent } from '../payments/paymentModel';

const runtime = '0x1111111111111111111111111111111111111111' as const;
const hash = `0x${'aa'.repeat(32)}` as const;
const registration = (pricePlanck: bigint) => ({
  contentHash: hash,
  title: 'Music',
  artistName: 'Artist',
  description: 'Music',
  imageRef: 'ipfs://cover',
  audioRef: 'ipfs://audio',
  metadataRef: 'ipfs://metadata',
  artistContractRef: 'dotify:self-certified',
  accessMode: 1,
  pricePlanck,
  requiredPersonhood: 0,
  royaltyRecipients: [runtime],
  royaltyShares: [10000]
});
const update = (pricePlanck: bigint) => ({ contentHash: hash, accessMode: 1, pricePlanck, requiredPersonhood: 0 });

describe('exact Classic prices', () => {
  it('never rounds an over-precision input or accepts exponent/negative values', () => {
    for (const text of ['0.0000000000000000001', '0.9999999999999999999', '1e-10', '-1', 'NaN']) {
      expect(() => parseExactEvmAmount(text)).toThrow();
    }
    expect(parseExactEvmAmount(' 0.0000000001 ')).toBe(100_000_000n);
    expect(parseExactEvmAmount('0.000000000000000001')).toBe(1n);
  });
  it('checks native precision and uint128 bounds without rounding', () => {
    expect(() => assertClassicPrice(1, 100_000_000n, 10)).not.toThrow();
    expect(() => assertClassicPrice(1, 100_000_001n, 10)).toThrow(/at most 10/);
    expect(() => assertClassicPrice(1, 1n, 18)).not.toThrow();
    for (const price of [0n, -1n, MAX_REGISTRY_PRICE + 1n]) expect(() => assertClassicPrice(1, price, 18)).toThrow();
    for (const decimals of [-1, 19, NaN, 0.5]) expect(() => assertClassicPrice(1, 1n, decimals)).toThrow(/precision/);
  });
  it('prevents EVM publication, price edits and a legacy incompatible payment before signing', async () => {
    const writeContract = vi.fn();
    const writer = createViemRuntimeWriter({
      ethRpcUrl: 'http://localhost:8545',
      walletClient: { writeContract } as never,
      publicClient: { readContract: vi.fn(async () => 10) } as never
    });
    await expect(writer.registerTrack(runtime, registration(100_000_001n))).rejects.toThrow(/cannot be paid exactly/);
    await expect(writer.setAccessMode(runtime, update(100_000_001n))).rejects.toThrow(/cannot be paid exactly/);
    await expect(
      writer.payForAccess(
        createNativeRuntimeAccessPaymentIntent({
          runtimeAddress: runtime,
          contentHash: hash,
          amountPlanck: 100_000_001n,
          asset: DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET
        })
      )
    ).rejects.toMatchObject({ name: 'SupportNotSubmittedError' });
    expect(writeContract).not.toHaveBeenCalled();
  });
  it('prevents Product publication/edits on dust, missing getter or a network precision mismatch', async () => {
    const tx = vi.fn(async () => ({ ok: true as const, value: { ok: true, txHash: hash } }));
    let decimals: number | undefined = 10;
    const contracts = {
      getDirectoryContract: () => ({}),
      getFactoryContract: () => ({}),
      getRuntimeContract: () => ({
        musicRegNativeDecimals: { query: async () => ({ success: true as const, value: decimals }) },
        musicRegRegister: { tx },
        musicRegSetAccessMode: { tx }
      })
    };
    const writer = createProductCdmRuntimeWriter({ nativeTokenDecimals: 10, contracts });
    await expect(writer.registerTrack(runtime, registration(100_000_001n))).rejects.toThrow(/cannot be paid exactly/);
    await expect(writer.setAccessMode(runtime, update(100_000_001n))).rejects.toThrow(/cannot be paid exactly/);
    decimals = 18;
    await expect(writer.registerTrack(runtime, registration(100_000_000n))).rejects.toThrow(/do not match/);
    decimals = undefined;
    await expect(writer.setAccessMode(runtime, update(100_000_000n))).rejects.toThrow(/do not match/);
    expect(tx).not.toHaveBeenCalled();
    decimals = 10;
    await expect(writer.registerTrack(runtime, registration(100_000_000n))).resolves.toBe(hash);
    expect(tx).toHaveBeenCalledTimes(1);
  });
});
