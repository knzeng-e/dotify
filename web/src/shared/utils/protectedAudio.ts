// Best-effort audio protection: per-track AES-256-GCM encryption with app-derived keys.
//
// Key derivation: blake2b256(APP_SECRET ‖ "dotify-content-key-v1:" ‖ contentHash)
// This is deterministic — the app never needs to store or transmit content keys.
//
// Protection model:
//   • IPFS stores only encrypted bytes — the raw CID is not playable.
//   • The contentHash (cleartext identity) is used as key-derivation input, not stored separately.
//   • VITE_CONTENT_SECRET is bundled in the JS (best-effort, not DRM). Set a real secret for
//     production; defaults to an all-zero dev key when the env var is absent.
//
// Access policy (PoP / payment checks) is enforced separately at the call site.

import { blake2b256 } from '@polkadot-apps/utils';
import { encryptAudio, decryptAudio } from './crypto';

const APP_SECRET_HEX = (import.meta.env.VITE_CONTENT_SECRET as string | undefined) ?? '';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getAppSecret(): Uint8Array {
  const hex = APP_SECRET_HEX.replace(/^0x/, '').replace(/\s+/g, '');
  if (!hex) return new Uint8Array(32); // dev fallback: all-zero key
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Derive a 32-byte AES-256 content key for a specific track. */
export function deriveContentKey(contentHash: string): Uint8Array {
  const secret = getAppSecret();
  const label = new TextEncoder().encode(`dotify-content-key-v1:${contentHash}`);
  const combined = new Uint8Array(secret.length + label.length);
  combined.set(secret, 0);
  combined.set(label, secret.length);
  return blake2b256(combined);
}

/** Encrypt raw audio bytes with the per-track derived key. Output: nonce(12) ‖ ciphertext. */
export async function encryptTrackAudio(bytes: Uint8Array, contentHash: string): Promise<Uint8Array> {
  return encryptAudio(bytes, deriveContentKey(contentHash));
}

/** Decrypt audio bytes previously encrypted by encryptTrackAudio. */
export async function decryptTrackAudio(packed: Uint8Array, contentHash: string): Promise<Uint8Array> {
  return decryptAudio(packed, deriveContentKey(contentHash));
}

// ---------------------------------------------------------------------------
// audioRef URI helpers (stored in the EVM registry)
// ---------------------------------------------------------------------------

const ENC_AUDIO_PREFIX = 'dotify:enc:ipfs://';
const ENC_AUDIO_V2_PREFIX = 'dotify:enc:v2:ipfs://';

/**
 * Build the on-chain audioRef for an encrypted IPFS upload.
 * Example: makeEncryptedAudioRef("QmXXX") → "dotify:enc:ipfs://QmXXX"
 */
export function makeEncryptedAudioRef(audioCID: string): string {
  return `${ENC_AUDIO_PREFIX}${audioCID}`;
}

/** Build the on-chain audioRef for a chunked encrypted IPFS upload. */
export function makeEncryptedAudioV2Ref(audioCID: string): string {
  return `${ENC_AUDIO_V2_PREFIX}${audioCID}`;
}

/** Normalize an upload response that may already be a full encrypted audio ref. */
export function normalizeEncryptedAudioRef(audioRefOrCid: string): string {
  if (isEncryptedAudioRef(audioRefOrCid)) return audioRefOrCid;
  return makeEncryptedAudioRef(audioRefOrCid);
}

/** Returns true when the audioRef is any encrypted Dotify audio ref. */
export function isEncryptedAudioRef(audioRef: string): boolean {
  return audioRef.startsWith(ENC_AUDIO_PREFIX) || audioRef.startsWith(ENC_AUDIO_V2_PREFIX);
}

/** Returns true when the audioRef points to a chunked DAV2 encrypted asset. */
export function isEncryptedAudioV2Ref(audioRef: string): boolean {
  return audioRef.startsWith(ENC_AUDIO_V2_PREFIX);
}

/** Extract the raw IPFS CID from an encrypted audioRef. */
export function encryptedRefToCID(audioRef: string): string {
  if (audioRef.startsWith(ENC_AUDIO_V2_PREFIX)) return audioRef.slice(ENC_AUDIO_V2_PREFIX.length);
  return audioRef.slice(ENC_AUDIO_PREFIX.length);
}
