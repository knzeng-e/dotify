import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { sharedState } from './sharedState/index.js';
import { PostgresUploadAuthorizations } from './sharedState/uploads.js';
import { config } from '../config.js';
import { getActiveContentKeyMasterSecret } from './keyVault.js';
import { checkDotifyChainId } from './chainDomain.js';

const HKDF_INFO = 'dotify-upload-authorization-v1';
const MIN_MASTER_SECRET_BYTES = 32;
const HEX_ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

export type UploadPurpose = 'audio' | 'cover' | 'metadata';

export type UploadAuthorizationPayload = {
  address: `0x${string}`;
  runtimeAddress: `0x${string}`;
  chainId: number;
  purpose: UploadPurpose;
  maxBytes: number;
  jti: string;
  epoch: string;
  iat: number;
  exp: number;
};

export type UploadAuthorizationErrorCode =
  | 'UPLOAD_AUTH_NOT_CONFIGURED'
  | 'UPLOAD_BUDGET_INVALID'
  | 'UPLOAD_PRINCIPAL_QUOTA_EXCEEDED'
  | 'UPLOAD_GLOBAL_QUOTA_EXCEEDED'
  | 'UPLOAD_AUTH_INVALID'
  | 'UPLOAD_AUTH_EXPIRED'
  | 'UPLOAD_AUTH_RESTARTED'
  | 'UPLOAD_AUTH_REPLAYED'
  | 'UPLOAD_PURPOSE_MISMATCH'
  | 'UPLOAD_PRINCIPAL_CONCURRENCY_EXCEEDED'
  | 'UPLOAD_GLOBAL_CONCURRENCY_EXCEEDED';

type UploadAuthorizationFailure = {
  ok: false;
  code: UploadAuthorizationErrorCode;
  reason: string;
};

export type IssuedUploadAuthorization =
  | {
      ok: true;
      token: string;
      expiresAt: string;
      maxBytes: number;
      purpose: UploadPurpose;
    }
  | UploadAuthorizationFailure;

export type UploadLease = {
  payload: UploadAuthorizationPayload;
  complete: (actualBytes: number) => boolean | Promise<boolean>;
  abort: () => void | Promise<void>;
};

export type UploadLeaseResult = { ok: true; lease: UploadLease } | UploadAuthorizationFailure;

export type Reservation = {
  payload: UploadAuthorizationPayload;
  state: 'reserved' | 'active';
  leaseUntil?: number;
};

export type Usage = {
  address: string;
  bytes: number;
  expiresAt: number;
};

export type UploadAuthorizationServiceOptions = {
  epoch?: string;
  state?: { reservations: Map<string, Reservation>; usage: Usage[] };
  now?: () => number;
  randomId?: () => string;
  masterSecret?: () => string | undefined;
  previousSecret?: () => string | undefined;
  authorizationTtlMs?: number;
  quotaWindowMs?: number;
  principalByteLimit?: number;
  globalByteLimit?: number;
  principalConcurrencyLimit?: number;
  globalConcurrencyLimit?: number;
};

export type SyncUploadAuthorizationService = {
  issue: (input: {
    address: `0x${string}`;
    runtimeAddress: `0x${string}`;
    chainId: number;
    purpose: UploadPurpose;
    maxBytes: number;
  }) => IssuedUploadAuthorization;
  begin: (token: string, purpose: UploadPurpose) => UploadLeaseResult;
  settleActive: (jti: string, actualBytes?: number) => boolean;
};

export type UploadAuthorizationService = {
  issue: (...args: Parameters<SyncUploadAuthorizationService['issue']>) => IssuedUploadAuthorization | Promise<IssuedUploadAuthorization>;
  begin: (token: string, purpose: UploadPurpose) => UploadLeaseResult | Promise<UploadLeaseResult>;
};

function deriveHmacKey(secretValue: string | undefined): Buffer | null {
  if (!secretValue) return null;
  const hex = secretValue.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const ikm = Buffer.from(hex, 'hex');
  if (ikm.length < MIN_MASTER_SECRET_BYTES) return null;
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), HKDF_INFO, 32));
}

function sign(payloadB64: string, key: Buffer): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url');
}

function fail(code: UploadAuthorizationErrorCode, reason: string): UploadAuthorizationFailure {
  return { ok: false, code, reason };
}

export function createUploadAuthorizationService(options: UploadAuthorizationServiceOptions = {}): SyncUploadAuthorizationService {
  const epoch = options.epoch ?? randomUUID();
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? randomUUID;
  const masterSecret = options.masterSecret ?? getActiveContentKeyMasterSecret;
  const authorizationTtlMs = options.authorizationTtlMs ?? config.UPLOAD_AUTH_TTL_SECONDS * 1000;
  const quotaWindowMs = options.quotaWindowMs ?? config.UPLOAD_QUOTA_WINDOW_SECONDS * 1000;
  const principalByteLimit = options.principalByteLimit ?? config.UPLOAD_PRINCIPAL_BYTES_PER_WINDOW;
  const globalByteLimit = options.globalByteLimit ?? config.UPLOAD_GLOBAL_BYTES_PER_WINDOW;
  const principalConcurrencyLimit = options.principalConcurrencyLimit ?? config.UPLOAD_PRINCIPAL_CONCURRENCY;
  const globalConcurrencyLimit = options.globalConcurrencyLimit ?? config.UPLOAD_GLOBAL_CONCURRENCY;
  const reservations = options.state?.reservations ?? new Map<string, Reservation>();
  const usage: Usage[] = options.state?.usage ?? [];

  function sweep(currentTime: number): void {
    for (const [jti, reservation] of reservations) {
      if (reservation.state === 'reserved' && reservation.payload.exp <= currentTime) reservations.delete(jti);
      if (reservation.state === 'active' && (reservation.leaseUntil ?? 0) <= currentTime) {
        // A crashed uploader cannot release its byte budget by losing its lease.
        usage.push({ address: reservation.payload.address, bytes: reservation.payload.maxBytes, expiresAt: currentTime + quotaWindowMs });
        reservations.delete(jti);
      }
    }
    let writeIndex = 0;
    for (const record of usage) {
      if (record.expiresAt > currentTime) usage[writeIndex++] = record;
    }
    usage.length = writeIndex;
  }

  function reservedBytes(address?: string): number {
    let total = 0;
    for (const reservation of reservations.values()) {
      if (address && reservation.payload.address !== address) continue;
      total += reservation.payload.maxBytes;
    }
    return total;
  }

  function usedBytes(address?: string): number {
    return usage.reduce((total, record) => (address && record.address !== address ? total : total + record.bytes), 0);
  }

  function activeCount(address?: string): number {
    let total = 0;
    for (const reservation of reservations.values()) {
      if (reservation.state !== 'active') continue;
      if (address && reservation.payload.address !== address) continue;
      total += 1;
    }
    return total;
  }

  function outstandingCount(address?: string): number {
    let total = 0;
    for (const reservation of reservations.values()) {
      if (address && reservation.payload.address !== address) continue;
      total += 1;
    }
    return total;
  }

  function decodeAndVerify(token: string, currentTime: number): UploadAuthorizationPayload | UploadAuthorizationFailure {
    const key = deriveHmacKey(masterSecret());
    if (!key) return fail('UPLOAD_AUTH_NOT_CONFIGURED', 'Upload authorization is unavailable because the server master secret is not configured.');

    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return fail('UPLOAD_AUTH_INVALID', 'Malformed upload authorization.');

    const provided = Buffer.from(parts[1], 'utf8');
    if (
      ![key, deriveHmacKey(options.previousSecret?.())].some(candidate => {
        if (!candidate) return false;
        const expected = Buffer.from(sign(parts[0], candidate), 'utf8');
        return expected.length === provided.length && timingSafeEqual(expected, provided);
      })
    ) {
      return fail('UPLOAD_AUTH_INVALID', 'Upload authorization signature does not verify.');
    }

    let payload: UploadAuthorizationPayload;
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as UploadAuthorizationPayload;
    } catch {
      return fail('UPLOAD_AUTH_INVALID', 'Upload authorization payload is not valid JSON.');
    }

    if (
      typeof payload.address !== 'string' ||
      !HEX_ADDRESS_PATTERN.test(payload.address) ||
      typeof payload.runtimeAddress !== 'string' ||
      !HEX_ADDRESS_PATTERN.test(payload.runtimeAddress) ||
      typeof payload.chainId !== 'number' ||
      !['audio', 'cover', 'metadata'].includes(payload.purpose) ||
      !Number.isSafeInteger(payload.maxBytes) ||
      payload.maxBytes <= 0 ||
      typeof payload.jti !== 'string' ||
      typeof payload.epoch !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return fail('UPLOAD_AUTH_INVALID', 'Upload authorization is missing required claims.');
    }

    const domain = checkDotifyChainId(payload.chainId);
    if (!domain.ok) return fail('UPLOAD_AUTH_INVALID', domain.reason);
    if (payload.exp <= currentTime) return fail('UPLOAD_AUTH_EXPIRED', 'Upload authorization has expired. Request a new one.');
    if (payload.epoch !== epoch) return fail('UPLOAD_AUTH_RESTARTED', 'Upload authorization belongs to an earlier API process. Request a new one.');
    return payload;
  }

  function settleActive(jti: string, actualBytes?: number): boolean {
    sweep(now());
    const reservation = reservations.get(jti);
    if (!reservation || reservation.state !== 'active') return false;
    reservations.delete(jti);
    if (actualBytes === undefined) return true;
    if (!Number.isSafeInteger(actualBytes) || actualBytes < 0 || actualBytes > reservation.payload.maxBytes) return false;
    usage.push({ address: reservation.payload.address, bytes: actualBytes, expiresAt: now() + quotaWindowMs });
    return true;
  }
  return {
    settleActive,
    issue(input) {
      const currentTime = now();
      sweep(currentTime);
      const key = deriveHmacKey(masterSecret());
      if (!key) return fail('UPLOAD_AUTH_NOT_CONFIGURED', 'Upload authorization is unavailable because the server master secret is not configured.');
      if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0) {
        return fail('UPLOAD_BUDGET_INVALID', 'Upload byte budget must be a positive integer.');
      }

      const address = input.address.toLowerCase() as `0x${string}`;
      if (outstandingCount(address) >= principalConcurrencyLimit) {
        return fail('UPLOAD_PRINCIPAL_CONCURRENCY_EXCEEDED', 'This artist already has the maximum number of upload authorizations in progress.');
      }
      if (outstandingCount() >= globalConcurrencyLimit) {
        return fail('UPLOAD_GLOBAL_CONCURRENCY_EXCEEDED', 'The upload service already has the maximum number of upload authorizations in progress.');
      }
      if (usedBytes(address) + reservedBytes(address) + input.maxBytes > principalByteLimit) {
        return fail('UPLOAD_PRINCIPAL_QUOTA_EXCEEDED', 'This artist has exhausted the current upload byte quota. Try again after the quota window resets.');
      }
      if (usedBytes() + reservedBytes() + input.maxBytes > globalByteLimit) {
        return fail('UPLOAD_GLOBAL_QUOTA_EXCEEDED', 'The upload service has exhausted its current global byte quota. Try again later.');
      }

      const issuedAt = currentTime;
      const payload: UploadAuthorizationPayload = {
        address,
        runtimeAddress: input.runtimeAddress.toLowerCase() as `0x${string}`,
        chainId: input.chainId,
        purpose: input.purpose,
        maxBytes: input.maxBytes,
        jti: randomId(),
        epoch,
        iat: issuedAt,
        exp: issuedAt + authorizationTtlMs
      };
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      reservations.set(payload.jti, { payload, state: 'reserved' });
      return {
        ok: true,
        token: `${payloadB64}.${sign(payloadB64, key)}`,
        expiresAt: new Date(payload.exp).toISOString(),
        maxBytes: payload.maxBytes,
        purpose: payload.purpose
      };
    },

    begin(token, purpose) {
      const currentTime = now();
      sweep(currentTime);
      const verified = decodeAndVerify(token, currentTime);
      if ('ok' in verified) return verified;
      if (verified.purpose !== purpose) return fail('UPLOAD_PURPOSE_MISMATCH', 'Upload authorization was issued for a different upload purpose.');

      const reservation = reservations.get(verified.jti);
      if (!reservation || reservation.state !== 'reserved') {
        return fail('UPLOAD_AUTH_REPLAYED', 'Upload authorization has already been used or released. Request a new one.');
      }
      if (activeCount(verified.address) >= principalConcurrencyLimit) {
        return fail('UPLOAD_PRINCIPAL_CONCURRENCY_EXCEEDED', 'This artist already has the maximum number of uploads in progress.');
      }
      if (activeCount() >= globalConcurrencyLimit) {
        return fail('UPLOAD_GLOBAL_CONCURRENCY_EXCEEDED', 'The upload service already has the maximum number of uploads in progress.');
      }

      reservation.state = 'active';
      reservation.leaseUntil = currentTime + 15 * 60_000;
      return {
        ok: true,
        lease: {
          payload: verified,
          complete: actualBytes => settleActive(verified.jti, actualBytes),
          abort: () => {
            settleActive(verified.jti);
          }
        }
      };
    }
  };
}

export const uploadAuthorizationService: UploadAuthorizationService = sharedState
  ? new PostgresUploadAuthorizations(sharedState, {
      epoch: config.SESSION_EPOCH,
      masterSecret: () => config.SESSION_SECRET,
      previousSecret: () =>
        config.SESSION_PREVIOUS_SECRET_UNTIL && Date.now() < Date.parse(config.SESSION_PREVIOUS_SECRET_UNTIL) ? config.SESSION_PREVIOUS_SECRET : undefined
    })
  : createUploadAuthorizationService();
