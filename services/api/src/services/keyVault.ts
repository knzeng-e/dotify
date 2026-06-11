// Server-side content-key custody.
//
// Per-track AES-256 keys are derived from a single master secret:
//
//   HKDF-SHA256(ikm  = CONTENT_KEY_MASTER_SECRET (hex-decoded),
//               salt = empty,
//               info = 'dotify-content-key-v1:<contentHash>') -> 32 bytes
//
// This is the SAME derivation the upload route uses to encrypt audio before
// pinning (services/api/src/routes/uploads.ts). Keep them identical: a key
// delivered here must decrypt bytes encrypted there. The derivation is
// centralized in this module so the two paths cannot drift.
//
// The master secret never leaves this process; only the derived per-track
// key is returned, and only after the wallet signature and on-chain access
// check pass. This replaces the prototype's frontend-bundled VITE_CONTENT_SECRET.
//
// Security boundary, stated plainly: this protects distribution access, not
// analog capture. An authorized listener can record what they can play. The
// derivation is deterministic, so "temporary" applies to the grant, not the
// key bytes; rotating CONTENT_KEY_MASTER_SECRET re-keys every track at once.
// Artist-operated key custody may replace this central derivation later.

import { hkdfSync } from 'node:crypto';
import { config } from '../config.js';

const HKDF_INFO_PREFIX = 'dotify-content-key-v1:';
const MIN_MASTER_SECRET_BYTES = 32;

export type ContentKeyStatus = {
  configured: boolean;
  contentHash: string;
};

export type ContentKeyResult =
  | { ok: true; contentKey: `0x${string}` }
  | { ok: false; code: 'KEY_SERVICE_NOT_CONFIGURED'; reason: string };

function masterSecretBytes(): Buffer | null {
  const secret = config.CONTENT_KEY_MASTER_SECRET;
  if (!secret) return null;
  const hex = secret.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = Buffer.from(hex, 'hex');
  return bytes.length >= MIN_MASTER_SECRET_BYTES ? bytes : null;
}

export function getContentKeyStatus(contentHash: string): ContentKeyStatus {
  return {
    configured: masterSecretBytes() !== null,
    contentHash,
  };
}

/**
 * Derive the 32-byte per-track content key as raw bytes.
 * Returns null when the master secret is missing or malformed (fail closed).
 */
export function deriveContentKeyBytes(contentHash: string): Buffer | null {
  const secret = masterSecretBytes();
  if (!secret) return null;
  return Buffer.from(
    hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from(`${HKDF_INFO_PREFIX}${contentHash.toLowerCase()}`, 'utf8'), 32),
  );
}

/** Derive the per-track content key for delivery. Fails closed when unconfigured. */
export function deriveContentKey(contentHash: string): ContentKeyResult {
  const key = deriveContentKeyBytes(contentHash);
  if (!key) {
    return {
      ok: false,
      code: 'KEY_SERVICE_NOT_CONFIGURED',
      reason: 'CONTENT_KEY_MASTER_SECRET is not configured (or is not 32+ bytes of hex); content keys cannot be derived.',
    };
  }
  return { ok: true, contentKey: `0x${key.toString('hex')}` };
}
