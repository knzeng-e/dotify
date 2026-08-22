import { describe, expect, it } from 'vitest';
import {
  DOTIFY_CASH_ASSET,
  DOTIFY_NATIVE_RUNTIME_ASSET,
  cashSettlementUnavailableReason,
  createNativeRuntimeAccessPaymentIntent,
  createUnsupportedCashAccessPaymentIntent
} from './paymentModel';

const runtimeAddress = '0x3000000000000000000000000000000000000000' as const;
const contentHash = `0x${'ab'.repeat(32)}` as const;

describe('payment model', () => {
  it('creates an executable native runtime payment intent for Classic unlocks', () => {
    expect(
      createNativeRuntimeAccessPaymentIntent({
        runtimeAddress,
        contentHash,
        amountPlanck: 42n
      })
    ).toEqual({
      kind: 'track-access',
      rail: 'runtime-native',
      asset: DOTIFY_NATIVE_RUNTIME_ASSET,
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
        amountPlanck: 0n
      })
    ).toThrow(/positive native amount/);
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
