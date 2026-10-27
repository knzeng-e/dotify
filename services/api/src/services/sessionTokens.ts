// Sessions prove identity, never access. PostgreSQL is authoritative in shared
// mode; local file persistence is reserved for an explicitly single-node API.
// Two-hour tokens can renew within the original 24-hour wallet sign-in window.
import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../config.js';
import { checkDotifyChainId } from './chainDomain.js';
import { sharedState } from './sharedState/index.js';
import { PostgresSessions } from './sharedState/sessions.js';

const HKDF_INFO = 'dotify-session-token-v1';
const MIN_MASTER_SECRET_BYTES = 32;
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SessionTokenPayload = {
  address: `0x${string}`;
  chainId: number;
  jti: string;
  epoch: string;
  iat: number;
  exp: number;
  startedAt?: number;
};

export type IssuedSession =
  | { ok: true; token: string; expiresAt: string; revocableUntil?: string }
  | { ok: false; code: 'SESSION_NOT_CONFIGURED' | 'CHAIN_ID_MISMATCH'; reason: string };

export type SessionVerification =
  | { valid: true; address: `0x${string}`; chainId: number; jti: string }
  | {
      valid: false;
      code: 'SESSION_NOT_CONFIGURED' | 'SESSION_INVALID' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'SESSION_RESTARTED' | 'CHAIN_ID_MISMATCH';
      reason: string;
    };

// Callers must not acknowledge logout until revocation reaches durable storage.
export class SessionRevocationStorageError extends Error {
  constructor() {
    super('Sign-out could not be saved. Please try again.');
    this.name = 'SessionRevocationStorageError';
  }
}

export type SessionTokenServiceOptions = {
  epoch?: string;
  masterSecret?: () => string | undefined;
  randomId?: () => string;
  previousSecret?: () => string | undefined;
  // Retain verification for delayed logout after the auth-overlap deadline.
  previousRevocationSecret?: () => string | undefined;
  revoked?: Map<string, number>;
  // Used only with a stable epoch: a random epoch already ends old sessions.
  revocationPath?: string;
  onStorageError?: (message: string) => void;
};

type RevocationFile = { epoch: string; revoked: [string, number][] };

// undefined: unreadable or malformed, the caller must not trust the epoch.
function loadRevocations(path: string, epoch: string, now: number): Map<string, number> | undefined {
  let serialized: string;
  try {
    serialized = readFileSync(path, 'utf8');
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Map() : undefined;
  }
  try {
    const parsed = JSON.parse(serialized) as RevocationFile;
    if (typeof parsed?.epoch !== 'string' || !Array.isArray(parsed.revoked)) return undefined;
    const revoked = new Map<string, number>();
    if (parsed.epoch !== epoch) return revoked;
    for (const entry of parsed.revoked) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'number') return undefined;
      if (entry[1] > now) revoked.set(entry[0], entry[1]);
    }
    return revoked;
  } catch {
    return undefined;
  }
}

function saveRevocations(path: string, epoch: string, revoked: Map<string, number>): void {
  const target = resolve(path);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  const file: RevocationFile = { epoch, revoked: [...revoked.entries()] };
  writeFileSync(temporary, `${JSON.stringify(file)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

export type SessionTokenService = {
  isConfigured: () => boolean;
  issue: (address: `0x${string}`, chainId: number, now?: number) => IssuedSession;
  verify: (token: string, now?: number) => SessionVerification;
  verifyRevocable: (token: string, now?: number) => SessionVerification;
  revoke: (token: string, now?: number) => boolean;
  renew: (token: string, now?: number) => IssuedSession | SessionVerification;
};

function deriveHmacKey(secretValue: string | undefined): Buffer | null {
  if (!secretValue) return null;
  const hex = secretValue.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const ikm = Buffer.from(hex, 'hex');
  if (ikm.length < MIN_MASTER_SECRET_BYTES) return null;
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), HKDF_INFO, 32));
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

function sign(payloadB64: string, key: Buffer): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url');
}

export function createSessionTokenService(options: SessionTokenServiceOptions = {}): SessionTokenService {
  const masterSecret = options.masterSecret ?? (() => config.SESSION_SECRET);
  const randomId = options.randomId ?? randomUUID;
  const reportStorageError = options.onStorageError ?? (message => console.error(`[dotify-api] ${message}`));
  let epoch = options.epoch ?? randomUUID();
  let revocationPath = options.epoch ? options.revocationPath : undefined;
  let revokedJtis = options.revoked ?? new Map<string, number>();
  if (revocationPath) {
    const loaded = loadRevocations(revocationPath, epoch, Date.now());
    if (loaded) {
      revokedJtis = loaded;
    } else {
      reportStorageError('Session revocations are unreadable; using a fresh session epoch, so earlier sessions must sign in again.');
      epoch = randomUUID();
      revocationPath = undefined;
    }
  }

  let revocationsDirty = false;

  function persistRevocations(): void {
    if (!revocationPath || !revocationsDirty) return;
    try {
      saveRevocations(revocationPath, epoch, revokedJtis);
      revocationsDirty = false;
    } catch {
      reportStorageError('Session revocation could not be persisted; logout was not acknowledged. Repair storage and retry before restarting.');
      throw new SessionRevocationStorageError();
    }
  }

  function tokenHmacKey(): Buffer | null {
    return deriveHmacKey(masterSecret());
  }

  function pruneRevoked(now: number): void {
    for (const [jti, exp] of revokedJtis) {
      if (exp <= now) revokedJtis.delete(jti);
    }
  }

  function verify(token: string, now = Date.now(), revocationOnly = false): SessionVerification {
    const key = tokenHmacKey();
    if (!key) {
      return { valid: false, code: 'SESSION_NOT_CONFIGURED', reason: 'Session auth is unavailable: the key service master secret is not configured.' };
    }

    if (token.length > 4096) return { valid: false, code: 'SESSION_INVALID', reason: 'Invalid session token.' };
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { valid: false, code: 'SESSION_INVALID', reason: 'Malformed session token.' };
    }

    const provided = Buffer.from(parts[1], 'utf8');
    const keys = [key, deriveHmacKey(revocationOnly ? (options.previousRevocationSecret ?? options.previousSecret)?.() : options.previousSecret?.())].filter(
      (value): value is Buffer => value !== null
    );
    if (
      !keys.some(candidate => {
        const expected = Buffer.from(sign(parts[0], candidate), 'utf8');
        return expected.length === provided.length && timingSafeEqual(expected, provided);
      })
    ) {
      return { valid: false, code: 'SESSION_INVALID', reason: 'Session token signature does not verify.' };
    }

    let payload: SessionTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SessionTokenPayload;
    } catch {
      return { valid: false, code: 'SESSION_INVALID', reason: 'Session token payload is not valid JSON.' };
    }

    if (
      typeof payload.address !== 'string' ||
      !/^0x[0-9a-f]{40}$/.test(payload.address) ||
      typeof payload.chainId !== 'number' ||
      typeof payload.jti !== 'string' ||
      payload.jti.length > 128 ||
      !payload.jti ||
      typeof payload.epoch !== 'string' ||
      typeof payload.iat !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      !Number.isSafeInteger(payload.iat) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > SESSION_MAX_AGE_MS ||
      payload.iat > now + 30_000 ||
      (payload.startedAt !== undefined &&
        (!Number.isSafeInteger(payload.startedAt) || payload.startedAt > payload.iat || payload.exp > payload.startedAt + SESSION_MAX_AGE_MS))
    ) {
      return { valid: false, code: 'SESSION_INVALID', reason: 'Session token payload is missing required claims.' };
    }

    const domain = checkDotifyChainId(payload.chainId);
    if (!domain.ok) return { valid: false, code: domain.code, reason: domain.reason };
    if ((revocationOnly ? (payload.startedAt ?? payload.iat) + SESSION_MAX_AGE_MS : payload.exp) <= now)
      return { valid: false, code: 'SESSION_EXPIRED', reason: 'Session has expired. Sign in again.' };
    if (payload.epoch !== epoch) {
      return { valid: false, code: 'SESSION_RESTARTED', reason: 'The API restarted and invalidated earlier sessions. Sign in again.' };
    }
    if (revokedJtis.has(payload.jti)) return { valid: false, code: 'SESSION_REVOKED', reason: 'Session has been signed out.' };
    return { valid: true, address: payload.address, chainId: payload.chainId, jti: payload.jti };
  }

  return {
    isConfigured: () => tokenHmacKey() !== null,
    issue(address, chainId, now = Date.now()) {
      const domain = checkDotifyChainId(chainId);
      if (!domain.ok) return domain;
      const key = tokenHmacKey();
      if (!key) {
        return { ok: false, code: 'SESSION_NOT_CONFIGURED', reason: 'Session auth is unavailable: the key service master secret is not configured.' };
      }

      const payload: SessionTokenPayload = {
        address: address.toLowerCase() as `0x${string}`,
        chainId,
        jti: randomId(),
        epoch,
        iat: now,
        exp: now + SESSION_TTL_MS,
        startedAt: now
      };
      const payloadB64 = b64url(JSON.stringify(payload));
      return {
        ok: true,
        token: `${payloadB64}.${sign(payloadB64, key)}`,
        expiresAt: new Date(payload.exp).toISOString(),
        revocableUntil: new Date(now + SESSION_MAX_AGE_MS).toISOString()
      };
    },
    verify,
    verifyRevocable: (token, now) => verify(token, now, true),
    renew(token, now = Date.now()) {
      const valid = verify(token, now);
      if (!valid.valid) return valid;
      const old = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as SessionTokenPayload;
      const startedAt = old.startedAt ?? old.iat;
      const exp = Math.min(now + SESSION_TTL_MS, startedAt + SESSION_MAX_AGE_MS);
      if (exp <= now + 60_000) return { valid: false, code: 'SESSION_EXPIRED', reason: 'Reconnect your account to continue.' };
      const payload = { ...old, iat: now, exp, startedAt };
      const encoded = b64url(JSON.stringify(payload));
      return {
        ok: true,
        token: `${encoded}.${sign(encoded, tokenHmacKey()!)}`,
        expiresAt: new Date(exp).toISOString(),
        revocableUntil: new Date(startedAt + SESSION_MAX_AGE_MS).toISOString()
      };
    },
    revoke(token, now = Date.now()) {
      const verified = verify(token, now, true);
      if (!verified.valid) {
        // A failed write already revoked this token in memory. Retrying must
        // flush that pending revocation, never turn the first 503 into a false 200.
        if (verified.code === 'SESSION_REVOKED') persistRevocations();
        return false;
      }
      pruneRevoked(now);
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as SessionTokenPayload;
      revokedJtis.set(verified.jti, (payload.startedAt ?? payload.iat) + SESSION_MAX_AGE_MS);
      revocationsDirty = true;
      persistRevocations();
      return true;
    }
  };
}

const sessionTokenService = createSessionTokenService({
  epoch: config.SESSION_EPOCH,
  revocationPath: sharedState ? undefined : config.SESSION_REVOCATIONS_PATH,
  previousSecret: previousSessionSecret,
  previousRevocationSecret: () => config.SESSION_PREVIOUS_SECRET
});

function previousSessionSecret(): string | undefined {
  return config.SESSION_PREVIOUS_SECRET_UNTIL && Date.now() < Date.parse(config.SESSION_PREVIOUS_SECRET_UNTIL) ? config.SESSION_PREVIOUS_SECRET : undefined;
}
const persistentSessions = sharedState
  ? new PostgresSessions(
      sharedState,
      createSessionTokenService({
        epoch: config.SESSION_EPOCH,
        previousSecret: previousSessionSecret,
        previousRevocationSecret: () => config.SESSION_PREVIOUS_SECRET
      })
    )
  : undefined;
export const isSessionAuthConfigured = () => sessionTokenService.isConfigured();
export const issueSessionToken = (address: `0x${string}`, chainId: number, now = Date.now()) =>
  persistentSessions ? persistentSessions.issue(address, chainId) : sessionTokenService.issue(address, chainId, now);
export const verifySessionToken = (token: string, now = Date.now()) =>
  persistentSessions ? persistentSessions.verify(token) : sessionTokenService.verify(token, now);
export const revokeSessionToken = (token: string, now = Date.now()) =>
  persistentSessions ? persistentSessions.revoke(token) : sessionTokenService.revoke(token, now);
export const renewSessionToken = (token: string, now = Date.now()) =>
  persistentSessions ? persistentSessions.renew(token) : sessionTokenService.renew(token, now);
