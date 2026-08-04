import { bytesToHex } from '@polkadot-apps/utils';

export type ProductHostMode = 'off' | 'auto' | 'required';
export type ProductHostStatus = 'off' | 'checking' | 'available' | 'unavailable';

export type ProductHostConfig = {
  mode: ProductHostMode;
  productId: string;
};

export type ProductHostIdentity = {
  evmAddress: `0x${string}`;
  substrateAddress: string;
  productPublicKey: `0x${string}`;
  signMessage: (message: string) => Promise<`0x${string}`>;
};

export type ProductHostRoomPermissionResult = { ok: true } | { ok: false; reason: string };

type EnvironmentLike = Record<string, string | boolean | number | null | undefined>;
type HostRemotePermission =
  | {
      tag: 'Remote';
      value: { domains: string[] };
    }
  | {
      tag: 'WebRtc';
      value?: undefined;
    };
type ProductAccount = {
  dotNsIdentifier: string;
  derivationIndex: number;
  publicKey: Uint8Array;
};
type ProductAccountResult = {
  match: <T, E = T>(onOk: (value: ProductAccount) => T, onErr: (error: unknown) => E) => Promise<T | E>;
};
type ProductAccountSigner = {
  signBytes: (data: Uint8Array) => Promise<Uint8Array>;
};
type ProductAccountsProvider = {
  getProductAccount: (dotNsIdentifier: string, derivationIndex?: number) => ProductAccountResult;
  getProductAccountSigner: (account: ProductAccount) => ProductAccountSigner;
};
type ProductHostIdentityDeps = {
  getAccountsProvider: () => Promise<ProductAccountsProvider | null>;
  deriveH160: (publicKey: Uint8Array) => `0x${string}`;
  ss58Encode: (publicKey: Uint8Array) => string;
};
type ProductHostRoomPermissionDeps = {
  isInsideContainer: () => boolean | Promise<boolean>;
  requestPermission: (permission: HostRemotePermission) => Promise<{ ok: true; value: boolean } | { ok: false; error: unknown }>;
};

function envValue(env: EnvironmentLike, key: string): string {
  const value = env[key];
  return value === null || value === undefined ? '' : String(value).trim();
}

export function resolveProductHostConfig(env: EnvironmentLike): ProductHostConfig {
  const rawMode = envValue(env, 'VITE_DOTIFY_HOST_MODE').toLowerCase();
  const mode: ProductHostMode = rawMode === 'auto' || rawMode === 'required' ? rawMode : 'off';

  return {
    mode,
    productId: envValue(env, 'VITE_DOTIFY_PRODUCT_ID') || 'dotify-test01.dot'
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

async function loadProductHostIdentityDeps(): Promise<ProductHostIdentityDeps> {
  const [{ getAccountsProvider }, { deriveH160, ss58Encode }] = await Promise.all([import('@parity/product-sdk/host'), import('@parity/product-sdk/address')]);
  return { getAccountsProvider, deriveH160, ss58Encode };
}

async function loadProductHostRoomPermissionDeps(): Promise<ProductHostRoomPermissionDeps> {
  const { isInsideContainer, requestPermission } = await import('@parity/product-sdk/host');
  return { isInsideContainer, requestPermission };
}

function describeHostError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    return String((error as { reason: unknown }).reason);
  }
  return String(error);
}

function domainFromUrl(rawUrl: string): string {
  return new URL(rawUrl).hostname.toLowerCase();
}

export async function ensureProductHostRoomPermissions(signalUrl: string, deps?: ProductHostRoomPermissionDeps): Promise<ProductHostRoomPermissionResult> {
  const { isInsideContainer, requestPermission } = deps ?? (await loadProductHostRoomPermissionDeps());
  if (!(await isInsideContainer())) return { ok: true };

  let signalDomain: string;
  try {
    signalDomain = domainFromUrl(signalUrl);
  } catch {
    return { ok: false, reason: 'Room service unavailable. The configured signaling URL is not valid.' };
  }

  const remote = await requestPermission({
    tag: 'Remote',
    value: { domains: [signalDomain] }
  });
  if (!remote.ok) {
    return { ok: false, reason: `Room service unavailable. The Polkadot host could not request remote access to ${signalDomain}: ${describeHostError(remote.error)}` };
  }
  if (!remote.value) {
    return { ok: false, reason: `Room service unavailable. Allow remote access to ${signalDomain} in the Polkadot host to open listening rooms.` };
  }

  const webRtc = await requestPermission({ tag: 'WebRtc' });
  if (!webRtc.ok) {
    return { ok: false, reason: `Room service unavailable. The Polkadot host could not request WebRTC access: ${describeHostError(webRtc.error)}` };
  }
  if (!webRtc.value) {
    return { ok: false, reason: 'Room service unavailable. Allow WebRTC in the Polkadot host to share live room audio.' };
  }

  return { ok: true };
}

export async function connectProductHostIdentity(config: ProductHostConfig, deps?: ProductHostIdentityDeps): Promise<ProductHostIdentity> {
  if (config.mode === 'off') {
    throw new Error('This Dotify build does not use the Polkadot Product host.');
  }

  const { getAccountsProvider, deriveH160, ss58Encode } = deps ?? (await loadProductHostIdentityDeps());
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
  const signer = provider.getProductAccountSigner(account);

  return {
    substrateAddress: ss58Encode(account.publicKey),
    evmAddress: deriveH160(account.publicKey),
    productPublicKey: `0x${bytesToHex(account.publicKey)}` as `0x${string}`,
    signMessage: async message => {
      const signature = await signer.signBytes(new TextEncoder().encode(message));
      return `0x${bytesToHex(signature)}` as `0x${string}`;
    }
  };
}
