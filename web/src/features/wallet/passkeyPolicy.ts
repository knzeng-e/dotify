// Passkey policy for W06.
//
// Dotify used to derive an EVM wallet directly from WebAuthn PRF output. That
// path is intentionally retired from public routes: losing local credential
// metadata, changing origin/RP ID, or using an authenticator without PRF can
// otherwise create a different account without the user understanding it.
//
// Passkeys can return later only as a login/recovery factor attached to an
// already-known EVM wallet or Product host account, with backend credential
// records and explicit account binding.

export const LEGACY_PASSKEY_CREDENTIAL_KEY = 'dotify:passkey:credId';
export const LAST_WALLET_METHOD_KEY = 'dotify:wallet:lastMethod';

export const PASSKEY_ONLY_WALLET_RETIRED_MESSAGE =
  'Passkey-only Dotify accounts are retired for this pilot. Connect an EVM wallet or use the Polkadot Product account; passkeys may return later only when linked to one of those identities.';

export const LEGACY_PASSKEY_LOCAL_DATA_MESSAGE =
  'This browser still has older Dotify passkey lookup data. Dotify no longer uses passkey-only accounts; forgetting it removes only Dotify local data, not the passkey saved in your device or password manager.';

type WalletStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RestorableWalletMethod = 'extension';

export type IdentitySurface = 'standalone-web' | 'product-dot-gateway' | 'product-host' | 'unknown';

export type PasskeyOnlyWalletStatus = {
  available: false;
  reason: string;
};

function browserStorage(): WalletStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getPasskeyOnlyWalletStatus(): PasskeyOnlyWalletStatus {
  return {
    available: false,
    reason: PASSKEY_ONLY_WALLET_RETIRED_MESSAGE
  };
}

export function hasLegacyPasskeyCredential(storage: WalletStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return Boolean(storage.getItem(LEGACY_PASSKEY_CREDENTIAL_KEY));
  } catch {
    return false;
  }
}

export function clearLegacyPasskeyData(storage: WalletStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(LEGACY_PASSKEY_CREDENTIAL_KEY);
    if (storage.getItem(LAST_WALLET_METHOD_KEY) === 'passkey') {
      storage.removeItem(LAST_WALLET_METHOD_KEY);
    }
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function readRestorableWalletMethod(storage: WalletStorage | null = browserStorage()): RestorableWalletMethod | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(LAST_WALLET_METHOD_KEY);
    if (value === 'extension') return value;
    if (value) storage.removeItem(LAST_WALLET_METHOD_KEY);
    return null;
  } catch {
    return null;
  }
}

export function rememberExtensionWallet(storage: WalletStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(LAST_WALLET_METHOD_KEY, 'extension');
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function clearStoredWalletMethod(storage: WalletStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(LAST_WALLET_METHOD_KEY);
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function classifyIdentitySurface(input: string): IdentitySurface {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return 'unknown';
  }

  if (url.protocol === 'polkadot:') return 'product-host';

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'dotify-test01.dot' || hostname.endsWith('.app.dev-dot.li') || hostname.endsWith('.app.dot.li')) {
    return 'product-host';
  }
  if (hostname.endsWith('.dev-dot.li') || hostname.endsWith('.dot.li')) {
    return 'product-dot-gateway';
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.netlify.app')) {
    return 'standalone-web';
  }
  return 'unknown';
}

export function canonicalIdentityForSurface(surface: IdentitySurface): string {
  switch (surface) {
    case 'product-host':
      return 'Product host account for presence, protected playback, and opt-in Product CDM writes; EVM wallet remains the standalone fallback for paid writes.';
    case 'product-dot-gateway':
      return 'Product host account only when the page runs inside a compatible host; otherwise use an EVM wallet for paid or publishing actions.';
    case 'standalone-web':
      return 'EVM wallet for paid or publishing actions; room guests and Free playback stay walletless.';
    default:
      return 'EVM wallet or Product host account, depending on the supported host capabilities.';
  }
}
