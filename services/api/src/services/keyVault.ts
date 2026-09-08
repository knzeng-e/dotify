// Server-side content-key custody.
//
// Content AES-256 keys are derived from a single master secret:
//
//   HKDF-SHA256(ikm  = CONTENT_KEY_MASTER_SECRET (hex-decoded),
//               salt = empty,
//               info = 'dotify-content-key-v1:<contentHash>') -> 32 bytes
//   or, for new release-bound uploads,
//               info = 'dotify-content-key-v2:<chainId>:<runtime>:<contentHash>'
//                      -> 32 bytes
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

export const LEGACY_CONTENT_KEY_VERSION = 'dotify-content-key-v1';
export const RELEASE_BOUND_CONTENT_KEY_VERSION = 'dotify-content-key-v2';
export const ENCRYPTED_AUDIO_V2_RELEASE_KEY_PREFIX = 'dotify:enc:v2:key-v2:ipfs://';

const LEGACY_HKDF_INFO_PREFIX = `${LEGACY_CONTENT_KEY_VERSION}:`;
const MIN_MASTER_SECRET_BYTES = 32;
const HEX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const HEX_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export type ContentKeyVersion = typeof LEGACY_CONTENT_KEY_VERSION | typeof RELEASE_BOUND_CONTENT_KEY_VERSION;

export type ContentKeyDerivationScope = {
  contentHash: string;
  keyVersion?: string;
  chainId?: number;
  runtimeAddress?: string;
};

export type ContentKeyDerivationInput = string | ContentKeyDerivationScope;

export type ContentKeyStatus = {
  configured: boolean;
  contentHash: string;
};

export type ContentKeyResult =
  | { ok: true; contentKey: `0x${string}` }
  | { ok: false; code: 'KEY_SERVICE_NOT_CONFIGURED'; reason: string };

export function isSupportedContentKeyVersion(value: string): value is ContentKeyVersion {
  return value === LEGACY_CONTENT_KEY_VERSION || value === RELEASE_BOUND_CONTENT_KEY_VERSION;
}

export function contentKeyVersionForAudioRef(audioRef: string): ContentKeyVersion | null {
  if (audioRef.startsWith(ENCRYPTED_AUDIO_V2_RELEASE_KEY_PREFIX)) return RELEASE_BOUND_CONTENT_KEY_VERSION;
  if (audioRef.startsWith('dotify:enc:v2:ipfs://') || audioRef.startsWith('dotify:enc:ipfs://')) return LEGACY_CONTENT_KEY_VERSION;
  return null;
}

export function makeReleaseBoundEncryptedAudioV2Ref(cid: string): string {
  return `${ENCRYPTED_AUDIO_V2_RELEASE_KEY_PREFIX}${cid}`;
}

function masterSecretBytes(): Buffer | null {
  const secret = config.CONTENT_KEY_MASTER_SECRET;
  if (!secret) return null;
  const hex = secret.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = Buffer.from(hex, 'hex');
  return bytes.length >= MIN_MASTER_SECRET_BYTES ? bytes : null;
}

function normalizeDerivationScope(input: ContentKeyDerivationInput): { contentHash: string; info: string } | null {
  if (typeof input === 'string') {
    const contentHash = input.toLowerCase();
    if (!HEX_HASH_PATTERN.test(contentHash)) return null;
    return { contentHash, info: `${LEGACY_HKDF_INFO_PREFIX}${contentHash}` };
  }

  const contentHash = input.contentHash.toLowerCase();
  const keyVersion = input.keyVersion ?? LEGACY_CONTENT_KEY_VERSION;
  if (!HEX_HASH_PATTERN.test(contentHash) || !isSupportedContentKeyVersion(keyVersion)) return null;

  if (keyVersion === LEGACY_CONTENT_KEY_VERSION) {
    return { contentHash, info: `${LEGACY_HKDF_INFO_PREFIX}${contentHash}` };
  }

  const runtimeAddress = input.runtimeAddress?.toLowerCase();
  const chainId = input.chainId ?? config.DOTIFY_CHAIN_ID;
  if (!runtimeAddress || !HEX_ADDRESS_PATTERN.test(runtimeAddress) || !Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return {
    contentHash,
    info: `${RELEASE_BOUND_CONTENT_KEY_VERSION}:${chainId}:${runtimeAddress}:${contentHash}`
  };
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
export function deriveContentKeyBytes(input: ContentKeyDerivationInput): Buffer | null {
  const secret = masterSecretBytes();
  const scope = normalizeDerivationScope(input);
  if (!secret || !scope) return null;
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from(scope.info, 'utf8'), 32));
}

/** Derive the per-track content key for delivery. Fails closed when unconfigured. */
export function deriveContentKey(input: ContentKeyDerivationInput): ContentKeyResult {
  const key = deriveContentKeyBytes(input);
  if (!key) {
    return {
      ok: false,
      code: 'KEY_SERVICE_NOT_CONFIGURED',
      reason: 'CONTENT_KEY_MASTER_SECRET is not configured (or is not 32+ bytes of hex); content keys cannot be derived.',
    };
  }
  return { ok: true, contentKey: `0x${key.toString('hex')}` };
}
