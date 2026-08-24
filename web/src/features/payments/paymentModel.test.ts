import { describe, expect, it } from 'vitest';
import {
  DOTIFY_CASH_ASSET,
  DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET,
  cashSettlementUnavailableReason,
  classicTrackPaymentAmountPlanck,
  createNativeRuntimeAccessPaymentIntent,
  createUnsupportedCashAccessPaymentIntent,
  nativeRuntimePaymentAssetFromChain
} from './paymentModel';
import { formatWeiAsDot } from '../../shared/utils/format';

const runtimeAddress = '0x3000000000000000000000000000000000000000' as const;
const contentHash = `0x${'ab'.repeat(32)}` as const;
const nativeAsset = nativeRuntimePaymentAssetFromChain({ nativeCurrency: { name: 'Paseo', symbol: 'PAS', decimals: 18 } });

describe('payment model', () => {
  it('derives the runtime native payment asset from the configured chain currency', () => {
    expect(nativeAsset).toEqual({
      kind: 'native',
      symbol: 'PAS',
      decimals: 18,
      settlement: 'runtime-msg-value'
    });
    expect(nativeRuntimePaymentAssetFromChain(null)).toEqual(DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET);
  });

  it('creates an executable native runtime payment intent for Classic unlocks', () => {
    expect(
      createNativeRuntimeAccessPaymentIntent({
        runtimeAddress,
        contentHash,
        amountPlanck: 42n,
        asset: nativeAsset
      })
    ).toEqual({
      kind: 'track-access',
      rail: 'runtime-native',
      asset: nativeAsset,
      runtimeAddress,
      contentHash,
      amountPlanck: 42n
    });
  });

  it('fails closed before submitting zero-value Classic unlock payments', () => {
    expect(() =>
      createNativeRuntimeAccessPaymentIntent({
        runtimeAddress,
        contentHash,
        amountPlanck: 0n,
        asset: nativeAsset
      })
    ).toThrow(/positive native amount/);
  });

  it('uses the authoritative on-chain amount instead of the rounded display price', () => {
    const onchainPricePlanck = 1_500_000_000_500_000_000n;
    const displayPriceDot = formatWeiAsDot(onchainPricePlanck);

    expect(displayPriceDot).toBe('1.500000000');
    expect(classicTrackPaymentAmountPlanck({ priceDot: displayPriceDot, pricePlanck: onchainPricePlanck })).toBe(onchainPricePlanck);
  });

  it('keeps tiny positive on-chain prices payable even when display formatting rounds to zero', () => {
    const onchainPricePlanck = 100_000_000n;
    const displayPriceDot = formatWeiAsDot(onchainPricePlanck);

    expect(displayPriceDot).toBe('0.000000000');
    expect(classicTrackPaymentAmountPlanck({ priceDot: displayPriceDot, pricePlanck: onchainPricePlanck })).toBe(onchainPricePlanck);
  });

  it('falls back to the decimal display amount for non-registry tracks without a planck price', () => {
    expect(classicTrackPaymentAmountPlanck({ priceDot: '0.5' })).toBe(500_000_000_000_000_000n);
  });

  it('models CASH access as an explicit unsupported future settlement rail', () => {
    const intent = createUnsupportedCashAccessPaymentIntent({
      runtimeAddress,
      contentHash,
      requestedAmount: '1 CASH'
    });

    expect(intent).toMatchObject({
      kind: 'track-access',
      rail: 'product-cash',
      asset: DOTIFY_CASH_ASSET,
      status: 'unsupported',
      requestedAmount: '1 CASH'
    });
    expect(intent.reason).toBe(cashSettlementUnavailableReason());
    expect(intent.reason).toMatch(/People chain/);
    expect(intent.reason).toMatch(/Asset Hub/);
  });
});
