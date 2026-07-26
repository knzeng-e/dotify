export type ProductHostMode = 'off' | 'auto' | 'required';
export type ProductHostStatus = 'off' | 'checking' | 'available' | 'unavailable';

export type ProductHostConfig = {
  mode: ProductHostMode;
  productId: string;
};

export type ProductHostIdentity = {
  evmAddress: `0x${string}`;
  substrateAddress: string;
};

type EnvironmentLike = Record<string, string | boolean | number | null | undefined>;

function envValue(env: EnvironmentLike, key: string): string {
  const value = env[key];
  return value === null || value === undefined ? '' : String(value).trim();
}

export function resolveProductHostConfig(env: EnvironmentLike): ProductHostConfig {
  const rawMode = envValue(env, 'VITE_DOTIFY_HOST_MODE').toLowerCase();
  const mode: ProductHostMode = rawMode === 'auto' || rawMode === 'required' ? rawMode : 'off';

  return {
    mode,
    productId: envValue(env, 'VITE_DOTIFY_PRODUCT_ID') || 'dotify.dot'
  };
}

async function probeSdkHost(): Promise<boolean> {
  const { isInsideContainer } = await import('@parity/product-sdk/host');
  return isInsideContainer();
}

export async function probeProductHost(mode: ProductHostMode, probe: () => Promise<boolean> = probeSdkHost): Promise<ProductHostStatus> {
  if (mode === 'off') return 'off';

  try {
    return (await probe()) ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function describeHostError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    return String((error as { reason: unknown }).reason);
  }
  return String(error);
}

export async function connectProductHostIdentity(config: ProductHostConfig): Promise<ProductHostIdentity> {
  if (config.mode === 'off') {
    throw new Error('This Dotify build does not use the Polkadot Product host.');
  }

  const [{ getAccountsProvider }, { deriveH160, ss58Encode }] = await Promise.all([import('@parity/product-sdk/host'), import('@parity/product-sdk/address')]);
  const provider = await getAccountsProvider();
  if (!provider) {
    throw new Error('Open this build inside the Polkadot Product host, then try again.');
  }

  const account = await provider.getProductAccount(config.productId, 0).match(
    value => value,
    error => {
      throw new Error(`The Product host could not provide the Dotify account: ${describeHostError(error)}`);
    }
  );

  return {
    substrateAddress: ss58Encode(account.publicKey),
    evmAddress: deriveH160(account.publicKey)
  };
}
