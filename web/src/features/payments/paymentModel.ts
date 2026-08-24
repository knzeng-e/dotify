import { parseEther, type Address, type Chain, type Hash } from 'viem';
import type { CatalogTrack } from '../../shared/types';

export type DotifyNativeRuntimeAsset = {
  kind: 'native';
  symbol: string;
  decimals: number;
  settlement: 'runtime-msg-value';
};

export const DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET: DotifyNativeRuntimeAsset = {
  kind: 'native',
  symbol: 'UNIT',
  decimals: 18,
  settlement: 'runtime-msg-value'
} as const;

export const DOTIFY_CASH_ASSET = {
  kind: 'cash',
  symbol: 'CASH',
  settlement: 'pending-product-confirmation'
} as const;

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

export function nativeRuntimePaymentAssetFromChain(chain: Pick<Chain, 'nativeCurrency'> | null | undefined): DotifyNativeRuntimeAsset {
  const currency = chain?.nativeCurrency;
  const symbol = currency?.symbol?.trim() || DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET.symbol;
  const configuredDecimals = currency?.decimals;
  const decimals =
    typeof configuredDecimals === 'number' && Number.isInteger(configuredDecimals) && configuredDecimals > 0
      ? configuredDecimals
      : DOTIFY_FALLBACK_NATIVE_RUNTIME_ASSET.decimals;

  return {
    kind: 'native',
    symbol,
    decimals,
    settlement: 'runtime-msg-value'
  };
}

export function classicTrackPaymentAmountPlanck(track: Pick<CatalogTrack, 'priceDot' | 'pricePlanck'>): bigint {
  return track.pricePlanck ?? parseEther(track.priceDot.trim() || '0');
}

export function createNativeRuntimeAccessPaymentIntent(input: {
  runtimeAddress: Address;
  contentHash: Hash;
  amountPlanck: bigint;
  asset: DotifyNativeRuntimeAsset;
}): NativeRuntimeAccessPaymentIntent {
  if (input.amountPlanck <= 0n) {
    throw new Error('Classic unlock payments require a positive native amount.');
  }

  return {
    kind: 'track-access',
    rail: 'runtime-native',
    asset: input.asset,
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
