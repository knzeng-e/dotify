// Wallet-scoped display identity (off-chain, Layer 1 of the room-identity work).
//
// Dotify treats the EVM address as the canonical product identity. A listener
// or host should pick a display name once per wallet and never retype it: the
// name is remembered locally, keyed by address, and pre-fills room create/join.
// This is deliberately off-chain (no gas, no permanence, no friction); an
// on-chain handle registry is possible future work, and this module is the seam
// it would plug into (swap the storage backend, keep the shape).
//
// Not an identity guarantee: localStorage is per-browser and user-editable. It
// is a convenience, not an attestation. Room social events still carry only the
// display name, never the address.

export const DISPLAY_NAME_MAX_LENGTH = 32;

// The default seed name a fresh session carries before the user picks one. Kept
// here so callers can tell "user has not chosen yet" from a real choice.
export const DEFAULT_DISPLAY_NAME = 'Listener';

// Control characters (C0 range + DEL). Built via new RegExp with escaped
// backslashes so the source stays ASCII (no literal control bytes in the file).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');

function storageKey(address: string): string {
  return `dotify:display-name:${address.toLowerCase()}`;
}

// Collapse whitespace, strip control characters, and clamp length. Returns an
// empty string when nothing usable remains, so callers can fall back.
export function sanitizeDisplayName(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
    .trim();
}

// Whether a name is a real user choice rather than the untouched default.
export function isChosenDisplayName(value: string | null | undefined): boolean {
  const clean = sanitizeDisplayName(value);
  return clean.length > 0 && clean !== DEFAULT_DISPLAY_NAME;
}

export function getStoredDisplayName(address: string | null | undefined): string | null {
  if (!address) return null;
  try {
    const stored = window.localStorage.getItem(storageKey(address));
    const clean = sanitizeDisplayName(stored);
    return clean || null;
  } catch {
    return null;
  }
}

// Persist a chosen name for an address. No-ops for the untouched default so a
// connected user who never edited the field is not recorded as "Listener".
export function storeDisplayName(address: string | null | undefined, value: string): void {
  if (!address) return;
  const clean = sanitizeDisplayName(value);
  if (!isChosenDisplayName(clean)) return;
  try {
    window.localStorage.setItem(storageKey(address), clean);
  } catch {
    // Ignore storage failures (private browsing, quota, restricted contexts).
  }
}
