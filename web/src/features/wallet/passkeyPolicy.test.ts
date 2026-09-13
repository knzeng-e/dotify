import { describe, expect, it } from 'vitest';
import {
  LEGACY_PASSKEY_CREDENTIAL_KEY,
  LAST_WALLET_METHOD_KEY,
  canonicalIdentityForSurface,
  classifyIdentitySurface,
  clearLegacyPasskeyData,
  clearStoredWalletMethod,
  getPasskeyOnlyWalletStatus,
  hasLegacyPasskeyCredential,
  readRestorableWalletMethod,
  rememberExtensionWallet
} from './passkeyPolicy';

function storage(entries: Record<string, string> = {}) {
  const store = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    snapshot: () => Object.fromEntries(store.entries())
  };
}

describe('passkey-only wallet policy', () => {
  it('keeps passkey-only wallet creation unavailable even when generic WebAuthn exists', () => {
    expect(getPasskeyOnlyWalletStatus()).toEqual({
      available: false,
      reason:
        'Passkey-only Dotify accounts are retired for this pilot. Connect an EVM wallet or use the Polkadot Product account; passkeys may return later only when linked to one of those identities.'
    });
  });

  it('does not restore a retired passkey wallet method from local storage', () => {
    const local = storage({
      [LAST_WALLET_METHOD_KEY]: 'passkey',
      [LEGACY_PASSKEY_CREDENTIAL_KEY]: 'legacy-credential'
    });

    expect(readRestorableWalletMethod(local)).toBeNull();
    expect(local.snapshot()).toEqual({ [LEGACY_PASSKEY_CREDENTIAL_KEY]: 'legacy-credential' });
  });

  it('restores only browser EVM wallet sessions', () => {
    const local = storage();

    rememberExtensionWallet(local);

    expect(readRestorableWalletMethod(local)).toBe('extension');
    expect(local.snapshot()).toEqual({ [LAST_WALLET_METHOD_KEY]: 'extension' });
  });

  it('clears invalid stored wallet methods instead of treating them as accounts', () => {
    const local = storage({ [LAST_WALLET_METHOD_KEY]: 'product-host' });

    expect(readRestorableWalletMethod(local)).toBeNull();
    expect(local.snapshot()).toEqual({});
  });

  it('forgets legacy Dotify passkey lookup data without implying OS passkey deletion', () => {
    const local = storage({
      [LAST_WALLET_METHOD_KEY]: 'passkey',
      [LEGACY_PASSKEY_CREDENTIAL_KEY]: 'legacy-credential'
    });

    expect(hasLegacyPasskeyCredential(local)).toBe(true);
    clearLegacyPasskeyData(local);

    expect(hasLegacyPasskeyCredential(local)).toBe(false);
    expect(local.snapshot()).toEqual({});
  });

  it('clears remembered EVM wallet method separately from legacy passkey lookup data', () => {
    const local = storage({
      [LAST_WALLET_METHOD_KEY]: 'extension',
      [LEGACY_PASSKEY_CREDENTIAL_KEY]: 'legacy-credential'
    });

    clearStoredWalletMethod(local);

    expect(local.snapshot()).toEqual({ [LEGACY_PASSKEY_CREDENTIAL_KEY]: 'legacy-credential' });
  });
});

describe('Dotify identity surfaces', () => {
  it('classifies standalone web, Product gateway, and Product host origins', () => {
    expect(classifyIdentitySurface('https://muzinga.netlify.app/artists')).toBe('standalone-web');
    expect(classifyIdentitySurface('http://localhost:5273/#/rooms/abc123')).toBe('standalone-web');
    expect(classifyIdentitySurface('https://dotify-test01.dev-dot.li/#/rooms/abc123')).toBe('product-dot-gateway');
    expect(classifyIdentitySurface('https://dotify-test01.app.dev-dot.li/')).toBe('product-host');
    expect(classifyIdentitySurface('https://dotify-test01.app.dot.li/')).toBe('product-host');
    expect(classifyIdentitySurface('polkadot://dotify-test01.dot')).toBe('product-host');
  });

  it('documents canonical account authority without passkey-derived EVM migration claims', () => {
    expect(canonicalIdentityForSurface('standalone-web')).toContain('EVM wallet');
    expect(canonicalIdentityForSurface('product-host')).toContain('Product host account');
    expect(canonicalIdentityForSurface('product-dot-gateway')).toContain('compatible host');
    expect(canonicalIdentityForSurface('unknown')).not.toContain('passkey');
  });
});
