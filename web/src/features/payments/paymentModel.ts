import { parseEther, type Address, type Hash } from 'viem';
import type { CatalogTrack } from '../../shared/types';

export const DOTIFY_NATIVE_RUNTIME_ASSET = {
  kind: 'native',
  symbol: 'DOT',
  decimals: 18,
  settlement: 'runtime-msg-value'
} as const;

export const DOTIFY_CASH_ASSET = {
  kind: 'cash',
  symbol: 'CASH',
  settlement: 'pending-product-confirmation'
} as const;

export type DotifyNativeRuntimeAsset = typeof DOTIFY_NATIVE_RUNTIME_ASSET;
export type DotifyCashAsset = typeof DOTIFY_CASH_ASSET;
export type DotifyPaymentAsset = DotifyNativeRuntimeAsset | DotifyCashAsset;

export type NativeRuntimeAccessPaymentIntent = {
  kind: 'track-access';
  rail: 'runtime-native';
  asset: DotifyNativeRuntimeAsset;
  runtimeAddress: Address;
  contentHash: Hash;
  amountPlanck: bigint;
};

export type CashAccessPaymentIntent = {
  kind: 'track-access';
  rail: 'product-cash';
  asset: DotifyCashAsset;
  runtimeAddress: Address;
  contentHash: Hash;
  requestedAmount: string;
  status: 'unsupported';
  reason: string;
};

export type TrackAccessPaymentIntent = NativeRuntimeAccessPaymentIntent | CashAccessPaymentIntent;
export type ExecutableTrackAccessPaymentIntent = NativeRuntimeAccessPaymentIntent;

export function classicTrackPaymentAmountPlanck(track: Pick<CatalogTrack, 'priceDot' | 'pricePlanck'>): bigint {
  return track.pricePlanck ?? parseEther(track.priceDot.trim() || '0');
}

export function createNativeRuntimeAccessPaymentIntent(input: {
  runtimeAddress: Address;
  contentHash: Hash;
  amountPlanck: bigint;
}): NativeRuntimeAccessPaymentIntent {
  if (input.amountPlanck <= 0n) {
    throw new Error('Classic unlock payments require a positive native amount.');
  }

  return {
    kind: 'track-access',
    rail: 'runtime-native',
    asset: DOTIFY_NATIVE_RUNTIME_ASSET,
    runtimeAddress: input.runtimeAddress,
    contentHash: input.contentHash,
    amountPlanck: input.amountPlanck
  };
}

export function createUnsupportedCashAccessPaymentIntent(input: {
  runtimeAddress: Address;
  contentHash: Hash;
  requestedAmount: string;
}): CashAccessPaymentIntent {
  // Design marker only: do not route this to UI or runtime writers until
  // Product confirms CASH settlement evidence.
  return {
    kind: 'track-access',
    rail: 'product-cash',
    asset: DOTIFY_CASH_ASSET,
    runtimeAddress: input.runtimeAddress,
    contentHash: input.contentHash,
    requestedAmount: input.requestedAmount,
    status: 'unsupported',
    reason: cashSettlementUnavailableReason()
  };
}

export function cashSettlementUnavailableReason(): string {
  return 'Product CASH settlement is not executable yet: CASH lives on People chain while Dotify runtime entitlements live on Asset Hub, and the receipt/bridge model still needs Product confirmation.';
}
