import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_NAME, getStoredDisplayName, isChosenDisplayName, sanitizeDisplayName, storeDisplayName } from './walletIdentity';

const ADDRESS = '0x00000000000000000000000000000000000000aa';

// The suite runs in the node environment (no DOM). The module reads
// window.localStorage, so back it with a minimal in-memory stub rather than
// pulling in jsdom just for a key-value store.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear()
    }
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('sanitizeDisplayName', () => {
  it('collapses whitespace and trims', () => {
    expect(sanitizeDisplayName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('strips control characters', () => {
    // A literal tab (0x09) built at runtime so the source stays printable ASCII.
    const tab = String.fromCharCode(9);
    expect(sanitizeDisplayName(`Ada ${tab}Love`)).toBe('Ada Love');
  });

  it('clamps to the max length', () => {
    expect(sanitizeDisplayName('x'.repeat(50)).length).toBe(32);
  });

  it('returns empty for nullish or blank input', () => {
    expect(sanitizeDisplayName(null)).toBe('');
    expect(sanitizeDisplayName('   ')).toBe('');
  });
});

describe('isChosenDisplayName', () => {
  it('is false for blank and for the untouched default', () => {
    expect(isChosenDisplayName('')).toBe(false);
    expect(isChosenDisplayName('   ')).toBe(false);
    expect(isChosenDisplayName(DEFAULT_DISPLAY_NAME)).toBe(false);
  });

  it('is true for a real choice', () => {
    expect(isChosenDisplayName('Ada')).toBe(true);
  });
});

describe('store/getStoredDisplayName', () => {
  it('round-trips a chosen name per address (case-insensitive key)', () => {
    storeDisplayName(ADDRESS, 'Ada');
    expect(getStoredDisplayName(ADDRESS)).toBe('Ada');
    expect(getStoredDisplayName(ADDRESS.toUpperCase())).toBe('Ada');
  });

  it('does not persist the untouched default', () => {
    storeDisplayName(ADDRESS, DEFAULT_DISPLAY_NAME);
    expect(getStoredDisplayName(ADDRESS)).toBeNull();
  });

  it('sanitizes on the way in', () => {
    storeDisplayName(ADDRESS, '  Gabe   ');
    expect(getStoredDisplayName(ADDRESS)).toBe('Gabe');
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredDisplayName(null)).toBeNull();
    expect(getStoredDisplayName(ADDRESS)).toBeNull();
  });

  it('remembers a guest login under the per-browser guest key', () => {
    storeDisplayName(null, 'Nomad');
    expect(getStoredDisplayName(null)).toBe('Nomad');
    // A wallet-scoped name is independent of the guest one.
    expect(getStoredDisplayName(ADDRESS)).toBeNull();
  });

  it('prefers the wallet-scoped name over the guest name for a connected address', () => {
    storeDisplayName(null, 'Nomad');
    storeDisplayName(ADDRESS, 'Ada');
    expect(getStoredDisplayName(ADDRESS)).toBe('Ada');
    expect(getStoredDisplayName(null)).toBe('Nomad');
  });

  it('does not record the untouched default as a guest login either', () => {
    storeDisplayName(null, DEFAULT_DISPLAY_NAME);
    expect(getStoredDisplayName(null)).toBeNull();
  });
});
