// Protected playback failure - why an authorized listener still got no sound.
//
// Access was already granted client-side when these apply. Naming the cause
// lets transient failures retry quietly and lets a persistent one offer the
// right recovery. Failed key requests retry server-side authorization;
// transport retries can reuse an already authorized key.

import { KeyServiceError } from '../../services/keyService';

export type ProtectedPlaybackFailureKind =
  | 'signature-declined'
  | 'service-unreachable'
  | 'access-not-confirmed'
  | 'audio-unavailable'
  | 'account-required'
  | 'session-interrupted'
  | 'unknown';

export type ProtectedPlaybackFailure = {
  trackId: string;
  kind: ProtectedPlaybackFailureKind;
};

/** Thrown where the key service answered but did not release a key. */
export class ProtectedPlaybackError extends Error {
  readonly kind: ProtectedPlaybackFailureKind;

  constructor(kind: ProtectedPlaybackFailureKind, message: string) {
    super(message);
    this.name = 'ProtectedPlaybackError';
    this.kind = kind;
  }
}

// KEY_SERVICE_ERROR is the client fallback for a response without a typed code
// (proxy 5xx, rate limit). The others are typed by services/api.
const SERVICE_ERROR_CODES = new Set(['KEY_SERVICE_ERROR', 'RPC_UNAVAILABLE', 'CATALOG_UNAVAILABLE', 'SESSION_UNAVAILABLE']);
const ACCESS_ERROR_CODES = new Set(['LISTENER_ACCESS_REQUIRED', 'HOST_ACCESS_REQUIRED', 'NOT_FREE']);

// Wallet-side refusal only. A server "denied" is an access answer, not this.
const WALLET_REJECTION = /\b4001\b|user rejected|request rejected|cancell?ed/i;

export function classifyProtectedPlaybackFailure(error: unknown): ProtectedPlaybackFailureKind {
  if (error instanceof ProtectedPlaybackError) return error.kind;
  if (error instanceof KeyServiceError) {
    if (error.code === 'SESSION_SIGN_IN_INTERRUPTED') return 'session-interrupted';
    if (error.code === 'WALLET_REQUIRED') return 'account-required';
    if (SERVICE_ERROR_CODES.has(error.code)) return 'service-unreachable';
    if (ACCESS_ERROR_CODES.has(error.code)) return 'access-not-confirmed';
    return 'unknown';
  }
  if (error instanceof Error) {
    if (WALLET_REJECTION.test(`${error.name} ${error.message}`)) return 'signature-declined';
    // fetch() rejects with TypeError when the network or CORS blocks it, and
    // AbortSignal.timeout() rejects with TimeoutError.
    if (error.name === 'TypeError' || error.name === 'TimeoutError') return 'service-unreachable';
    if (/unable to fetch (dav2 )?audio|gateway/i.test(error.message)) return 'audio-unavailable';
  }
  return 'unknown';
}

/** Failures worth a quiet retry: the next attempt can plausibly succeed unaided. */
export function isTransientProtectedPlaybackFailure(kind: ProtectedPlaybackFailureKind): boolean {
  return kind === 'service-unreachable' || kind === 'access-not-confirmed' || kind === 'audio-unavailable';
}

export const PROTECTED_PLAYBACK_RETRY_DELAYS_MS: readonly number[] = [900, 2200];

export function protectedPlaybackFailureCopy(kind: ProtectedPlaybackFailureKind): { title: string; message: string; action: string } {
  switch (kind) {
    case 'session-interrupted':
      return {
        title: 'Confirm a new listening session',
        message: 'Your sign-in could not finish. Disconnect and reconnect your account to confirm a new session. No payment is needed.',
        action: 'Open account'
      };
    case 'signature-declined':
      return {
        title: 'Listening was not confirmed',
        message: 'Dotify asks for one signature to prove this account may listen. Nothing is paid by signing.',
        action: 'Confirm and listen'
      };
    case 'account-required':
      return {
        title: 'Reconnect to listen',
        message: 'Your account is no longer connected, so this track cannot be opened for you yet.',
        action: 'Try again'
      };
    case 'access-not-confirmed':
      return {
        title: 'Your access is still being confirmed',
        message: 'Your account has access, but the confirmation has not reached the listening service yet. This usually clears within a minute.',
        action: 'Try again'
      };
    case 'audio-unavailable':
      return {
        title: 'The audio is slow to arrive',
        message: 'Your access is confirmed, but the audio file could not be loaded right now.',
        action: 'Try again'
      };
    case 'service-unreachable':
      return {
        title: 'Listening service out of reach',
        message: 'Your access is confirmed, but Dotify could not reach the service that opens protected music. Check your connection.',
        action: 'Try again'
      };
    default:
      return {
        title: 'This track could not start',
        message: 'Your access is confirmed, but playback could not be prepared.',
        action: 'Try again'
      };
  }
}
