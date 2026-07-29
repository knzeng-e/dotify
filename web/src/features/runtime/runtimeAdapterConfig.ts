// Which runtime adapter backs the contract ports.
//
// `viem` is the default and the only path with production evidence. `product-cdm`
// is opt-in and additionally requires a Product host container, because the
// Product chain client has no direct-WebSocket fallback.
//
// Selection is deliberately a build-time environment value rather than a
// runtime toggle: switching the authority for access policy is a deployment
// decision an operator makes with evidence, not something a page should be able
// to flip.

export type RuntimeAdapterKind = 'viem' | 'product-cdm';

export type RuntimeAdapterConfig = {
  kind: RuntimeAdapterKind;
  /** Product chain environment used only when kind is 'product-cdm'. */
  productEnvironment: 'devnet';
};

type EnvironmentLike = Record<string, string | boolean | number | null | undefined>;

const PRODUCT_ENVIRONMENTS = ['devnet'] as const;

function envValue(env: EnvironmentLike, key: string): string {
  const value = env[key];
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

/**
 * Resolve the adapter selection, failing closed to `viem` for any unknown
 * value. An unrecognised adapter name must not silently disable contract reads.
 */
export function resolveRuntimeAdapterConfig(env: EnvironmentLike): RuntimeAdapterConfig {
  const requested = envValue(env, 'VITE_DOTIFY_RUNTIME_ADAPTER');
  const kind: RuntimeAdapterKind = requested === 'product-cdm' ? 'product-cdm' : 'viem';

  const requestedEnvironment = envValue(env, 'VITE_DOTIFY_PRODUCT_CHAIN');
  // Product DevNet is a preset over the Paseo system parachains (Asset Hub
  // 1000, EVM chain 420420417) - exactly where Dotify's contracts already live.
  // The SDK's `paseo` preset points at Paseo Next instead, a different network,
  // so `devnet` is the only environment Dotify can serve a catalog from.
  const productEnvironment = (PRODUCT_ENVIRONMENTS as readonly string[]).includes(requestedEnvironment)
    ? (requestedEnvironment as RuntimeAdapterConfig['productEnvironment'])
    : 'devnet';

  return { kind, productEnvironment };
}
