// Server-side content-key custody.
//
// Release-bound AES keys use HKDF with the configured version secret and
// chain/runtime/original hash. Secrets stay server-side; signed/session/Free
// authority controls delivery. Version rotation and permanent nonce custody
// remain required even with an empty catalog. This is access control, not DRM.

import { hkdfSync } from 'node:crypto';
import { config } from '../config.js';

export const RELEASE_BOUND_CONTENT_KEY_VERSION = 'dotify-content-key-v2';

const MIN_MASTER_SECRET_BYTES = 32;
const HEX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const HEX_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const CONTENT_KEY_VERSION_PATTERN = /^dotify-content-key-v((?:[2-9]|[1-9][0-9]+))$/;
const RELEASE_BOUND_AUDIO_REF_PATTERN = /^dotify:enc:v3:key-v((?:[2-9]|[1-9][0-9]+)):ipfs:\/\//;

export type ContentKeyVersion = `dotify-content-key-v${number}`;

export type ContentKeyVaultConfigInput = {
  contentKeyMasterSecret?: string;
  contentKeyMasterSecrets?: string;
  contentKeyActiveVersion?: string;
  chainId?: number;
};

export type ContentKeyDerivationScope = {
  contentHash: string;
  keyVersion?: string;
  chainId?: number;
  runtimeAddress?: string;
};

export type ContentKeyDerivationInput = ContentKeyDerivationScope;

export type ContentKeyStatus = {
  configured: boolean;
  contentHash: string;
  activeVersion: ContentKeyVersion;
  configuredVersions: ContentKeyVersion[];
  errors: string[];
};

export type ContentKeyVaultStatus = Omit<ContentKeyStatus, 'contentHash'>;

export type ContentKeyResult =
  | { ok: true; contentKey: `0x${string}` }
  | { ok: false; code: 'KEY_SERVICE_NOT_CONFIGURED' | 'KEY_VERSION_NOT_CONFIGURED' | 'KEY_SCOPE_INVALID'; reason: string };

export function isSupportedContentKeyVersion(value: string): value is ContentKeyVersion {
  return CONTENT_KEY_VERSION_PATTERN.test(value);
}

export function contentKeyVersionForAudioRef(audioRef: string): ContentKeyVersion | null {
  const releaseBound = RELEASE_BOUND_AUDIO_REF_PATTERN.exec(audioRef);
  if (releaseBound?.[1]) return `dotify-content-key-v${releaseBound[1]}` as ContentKeyVersion;
  return null;
}

function normalizeSecretHex(secret: string | undefined): string | null {
  if (!secret) return null;
  const hex = secret.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = Buffer.from(hex, 'hex');
  return bytes.length >= MIN_MASTER_SECRET_BYTES ? hex.toLowerCase() : null;
}

function configInput(overrides: ContentKeyVaultConfigInput = {}): Required<ContentKeyVaultConfigInput> {
  return {
    contentKeyMasterSecret: overrides.contentKeyMasterSecret ?? config.CONTENT_KEY_MASTER_SECRET ?? '',
    contentKeyMasterSecrets: overrides.contentKeyMasterSecrets ?? config.CONTENT_KEY_MASTER_SECRETS ?? '',
    contentKeyActiveVersion: overrides.contentKeyActiveVersion ?? config.CONTENT_KEY_ACTIVE_VERSION ?? RELEASE_BOUND_CONTENT_KEY_VERSION,
    chainId: overrides.chainId ?? config.DOTIFY_CHAIN_ID
  };
}

function parseVersionedSecrets(source: Required<ContentKeyVaultConfigInput>): { secrets: Map<ContentKeyVersion, string>; errors: string[] } {
  const secrets = new Map<ContentKeyVersion, string>();
  const errors: string[] = [];
  const defaultSecret = normalizeSecretHex(source.contentKeyMasterSecret);

  if (defaultSecret) {
    secrets.set(RELEASE_BOUND_CONTENT_KEY_VERSION, defaultSecret);
  } else if (source.contentKeyMasterSecret.trim()) {
    errors.push('CONTENT_KEY_MASTER_SECRET is not 32+ bytes of hex.');
  }

  if (!source.contentKeyMasterSecrets.trim()) return { secrets, errors };

  let parsed: unknown;
  try {
    parsed = JSON.parse(source.contentKeyMasterSecrets);
  } catch {
    errors.push('CONTENT_KEY_MASTER_SECRETS must be a JSON object of key version to 32+ byte hex secret.');
    return { secrets, errors };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('CONTENT_KEY_MASTER_SECRETS must be a JSON object of key version to 32+ byte hex secret.');
    return { secrets, errors };
  }

  for (const [version, secret] of Object.entries(parsed)) {
    if (!isSupportedContentKeyVersion(version)) {
      errors.push(`CONTENT_KEY_MASTER_SECRETS contains unsupported key version ${version}.`);
      continue;
    }
    if (typeof secret !== 'string') {
      errors.push(`CONTENT_KEY_MASTER_SECRETS value for ${version} must be a hex string.`);
      continue;
    }
    const hex = normalizeSecretHex(secret);
    if (!hex) {
      errors.push(`CONTENT_KEY_MASTER_SECRETS value for ${version} is not 32+ bytes of hex.`);
      continue;
    }
    secrets.set(version, hex);
  }

  return { secrets, errors };
}

function sortContentKeyVersions(versions: Iterable<ContentKeyVersion>): ContentKeyVersion[] {
  return Array.from(versions).sort((left, right) => {
    const leftVersion = Number(CONTENT_KEY_VERSION_PATTERN.exec(left)?.[1] ?? 0);
    const rightVersion = Number(CONTENT_KEY_VERSION_PATTERN.exec(right)?.[1] ?? 0);
    return leftVersion - rightVersion;
  });
}

export function getActiveContentKeyVersion(overrides: ContentKeyVaultConfigInput = {}): ContentKeyVersion {
  const activeVersion = configInput(overrides).contentKeyActiveVersion;
  return isSupportedContentKeyVersion(activeVersion) ? activeVersion : RELEASE_BOUND_CONTENT_KEY_VERSION;
}

export function getActiveContentKeyMasterSecret(overrides: ContentKeyVaultConfigInput = {}): string | undefined {
  const source = configInput(overrides);
  const { secrets } = parseVersionedSecrets(source);
  return secrets.get(getActiveContentKeyVersion(overrides));
}

export function getContentKeyVaultStatus(overrides: ContentKeyVaultConfigInput = {}): ContentKeyVaultStatus {
  const source = configInput(overrides);
  const { secrets, errors } = parseVersionedSecrets(source);
  const activeVersion = getActiveContentKeyVersion(overrides);
  const configuredVersions = sortContentKeyVersions(secrets.keys());
  if (!secrets.has(activeVersion)) {
    errors.push(`Active content-key version ${activeVersion} has no configured secret.`);
  }
  const configured = secrets.has(activeVersion) && errors.length === 0;
  return {
    configured,
    activeVersion,
    configuredVersions,
    errors
  };
}

function masterSecretBytes(keyVersion: ContentKeyVersion, overrides: ContentKeyVaultConfigInput = {}): Buffer | null {
  const secret =
    getActiveContentKeyVersion(overrides) === keyVersion
      ? getActiveContentKeyMasterSecret(overrides)
      : parseVersionedSecrets(configInput(overrides)).secrets.get(keyVersion);
  return secret ? Buffer.from(secret, 'hex') : null;
}

function normalizeDerivationScope(
  input: ContentKeyDerivationInput,
  overrides: ContentKeyVaultConfigInput = {}
): { contentHash: string; keyVersion: ContentKeyVersion; info: string } | null {
  if (!input || typeof input !== 'object' || typeof input.contentHash !== 'string') return null;

  const contentHash = input.contentHash.toLowerCase();
  const keyVersion = input.keyVersion ?? getActiveContentKeyVersion(overrides);
  if (!HEX_HASH_PATTERN.test(contentHash) || !isSupportedContentKeyVersion(keyVersion)) return null;

  const runtimeAddress = input.runtimeAddress?.toLowerCase();
  const chainId = input.chainId ?? configInput(overrides).chainId;
  if (!runtimeAddress || !HEX_ADDRESS_PATTERN.test(runtimeAddress) || !Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return {
    contentHash,
    keyVersion,
    info: `${keyVersion}:${chainId}:${runtimeAddress}:${contentHash}`
  };
}

export function getContentKeyStatus(contentHash: string, overrides: ContentKeyVaultConfigInput = {}): ContentKeyStatus {
  const status = getContentKeyVaultStatus(overrides);
  return {
    ...status,
    contentHash
  };
}

/**
 * Derive the 32-byte per-track content key as raw bytes.
 * Returns null when the requested version secret is missing or malformed.
 */
export function deriveContentKeyBytes(input: ContentKeyDerivationInput, overrides: ContentKeyVaultConfigInput = {}): Buffer | null {
  const scope = normalizeDerivationScope(input, overrides);
  const secret = scope ? masterSecretBytes(scope.keyVersion, overrides) : null;
  if (!secret || !scope) return null;
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from(scope.info, 'utf8'), 32));
}

/** Derive the per-track content key for delivery. Fails closed when unconfigured. */
export function deriveContentKey(input: ContentKeyDerivationInput, overrides: ContentKeyVaultConfigInput = {}): ContentKeyResult {
  const scope = normalizeDerivationScope(input, overrides);
  if (!scope) {
    return {
      ok: false,
      code: 'KEY_SCOPE_INVALID',
      reason: 'The requested content-key scope is invalid; content keys cannot be derived.'
    };
  }

  const secret = masterSecretBytes(scope.keyVersion, overrides);
  if (!secret) {
    const status = getContentKeyVaultStatus(overrides);
    return {
      ok: false,
      code: status.configured ? 'KEY_VERSION_NOT_CONFIGURED' : 'KEY_SERVICE_NOT_CONFIGURED',
      reason: `Content-key version ${scope.keyVersion} is not configured; retain its secret or re-encrypt the release before serving keys.`
    };
  }

  const key = deriveContentKeyBytes(input, overrides);
  if (!key) {
    return {
      ok: false,
      code: 'KEY_SERVICE_NOT_CONFIGURED',
      reason: 'Content-key secrets are not configured correctly; content keys cannot be derived.'
    };
  }
  return { ok: true, contentKey: `0x${key.toString('hex')}` };
}
