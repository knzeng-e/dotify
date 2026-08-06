import { bytesToHex } from '@polkadot-apps/utils';
import type { RemotePermissionItem } from '@parity/product-sdk/host';

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
export type ProductHostNavigationResult = { ok: true } | { ok: false; reason: string };
export type ProductHostRoomPermissionOptions = {
  remoteUrls?: string[];
};

type EnvironmentLike = Record<string, string | boolean | number | null | undefined>;
type HostRoomPermission = Extract<RemotePermissionItem, { tag: 'Remote' | 'WebRtc' }>;
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
  requestPermission?: (permission: HostRoomPermission) => Promise<{ ok: true; value: boolean } | { ok: false; error: unknown }>;
};
type ProductHostNavigationDeps = {
  navigateTo: (url: string) => Promise<{ ok: true; value: void } | { ok: false; error: unknown }>;
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
  const host = await import('@parity/product-sdk/host');
  return {
    isInsideContainer: host.isInsideContainer,
    requestPermission: typeof host.requestPermission === 'function' ? host.requestPermission : undefined
  };
}

async function loadProductHostNavigationDeps(): Promise<ProductHostNavigationDeps> {
  const { navigateTo } = await import('@parity/product-sdk/host');
  return { navigateTo };
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

function uniqueDomainsFromUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map(url => domainFromUrl(url))));
}

function isSdkPermissionPreflightUnsupported(error: unknown): boolean {
  const message = describeHostError(error).toLowerCase();
  return message.includes('is not a function') || message.includes('unsupported') || message.includes('not supported');
}

async function requestHostRoomPermission(
  requestPermission: ProductHostRoomPermissionDeps['requestPermission'],
  permission: HostRoomPermission
): Promise<{ ok: true; value: boolean } | { ok: false; error: unknown } | { unsupported: true }> {
  if (!requestPermission) return { unsupported: true };

  try {
    return await requestPermission(permission);
  } catch (error) {
    if (isSdkPermissionPreflightUnsupported(error)) {
      return { unsupported: true };
    }
    throw error;
  }
}

export async function ensureProductHostRoomPermissions(
  signalUrl: string,
  deps?: ProductHostRoomPermissionDeps,
  options: ProductHostRoomPermissionOptions = {}
): Promise<ProductHostRoomPermissionResult> {
  const { isInsideContainer, requestPermission } = deps ?? (await loadProductHostRoomPermissionDeps());
  if (!(await isInsideContainer())) return { ok: true };

  let remoteDomains: string[];
  try {
    remoteDomains = uniqueDomainsFromUrls([signalUrl, ...(options.remoteUrls ?? []).filter(Boolean)]);
  } catch {
    return { ok: false, reason: 'Room service unavailable. A configured room service URL is not valid.' };
  }

  // Request WebRTC first. Product Mobile can currently throw while encoding a
  // domain-scoped Remote request even though its simpler WebRtc permission is
  // supported. Signaling fetches may still work through the webview in that
  // state, so returning early after Remote would open a room that can exchange
  // metadata but can never publish media.
  const webRtc = await requestHostRoomPermission(requestPermission, { tag: 'WebRtc' });
  if (!('unsupported' in webRtc) && !webRtc.ok) {
    return { ok: false, reason: `Room service unavailable. The Polkadot host could not request WebRTC access: ${describeHostError(webRtc.error)}` };
  }
  if (!('unsupported' in webRtc) && !webRtc.value) {
    return { ok: false, reason: 'Room service unavailable. Allow WebRTC in the Polkadot host to share live room audio.' };
  }

  const remote = await requestHostRoomPermission(requestPermission, {
    tag: 'Remote',
    value: { domains: remoteDomains }
  });
  if (!('unsupported' in remote) && !remote.ok) {
    return { ok: false, reason: `Room service unavailable. The Polkadot host could not request remote access to ${remoteDomains.join(', ')}: ${describeHostError(remote.error)}` };
  }
  if (!('unsupported' in remote) && !remote.value) {
    return { ok: false, reason: `Room service unavailable. Allow remote access to ${remoteDomains.join(', ')} in the Polkadot host to open listening rooms.` };
  }

  return { ok: true };
}

export function isProductHostWebRtcUnavailable(
  protocol: string = typeof window === 'undefined' ? '' : window.location.protocol,
  peerConnection: typeof RTCPeerConnection | undefined = typeof window === 'undefined' ? undefined : window.RTCPeerConnection,
  hostMarked: boolean = typeof window !== 'undefined' && (window as Window & { __HOST_WEBVIEW_MARK__?: boolean }).__HOST_WEBVIEW_MARK__ === true
): boolean {
  return (protocol === 'polkadot:' || hostMarked) && typeof peerConnection !== 'function';
}

export async function openProductHostExternalUrl(
  rawUrl: string,
  deps?: ProductHostNavigationDeps
): Promise<ProductHostNavigationResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Dotify could not build a valid browser link.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Dotify only opens secure browser links from the Polkadot host.' };
  }

  const { navigateTo } = deps ?? (await loadProductHostNavigationDeps());
  const result = await navigateTo(url.toString());
  if (!result.ok) {
    return { ok: false, reason: `The Polkadot host could not open the browser: ${describeHostError(result.error)}` };
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
