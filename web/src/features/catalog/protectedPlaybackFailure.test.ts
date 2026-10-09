import { describe, expect, it } from 'vitest';
import { KeyServiceError } from '../../services/keyService';
import {
  ProtectedPlaybackError,
  classifyProtectedPlaybackFailure,
  isTransientProtectedPlaybackFailure,
  protectedPlaybackFailureCopy,
  type ProtectedPlaybackFailureKind
} from './protectedPlaybackFailure';

describe('protected playback failure', () => {
  it('names a declined signature and never retries it', () => {
    const kind = classifyProtectedPlaybackFailure(new Error('User rejected the request.'));
    expect(kind).toBe('signature-declined');
    expect(isTransientProtectedPlaybackFailure(kind)).toBe(false);
  });

  it('treats network, timeout and service errors as an unreachable service', () => {
    const timeout = new Error('The operation timed out.');
    timeout.name = 'TimeoutError';
    expect(classifyProtectedPlaybackFailure(new TypeError('Failed to fetch'))).toBe('service-unreachable');
    expect(classifyProtectedPlaybackFailure(timeout)).toBe('service-unreachable');
    expect(classifyProtectedPlaybackFailure(new KeyServiceError('boom', 'RPC_UNAVAILABLE'))).toBe('service-unreachable');
    expect(isTransientProtectedPlaybackFailure('service-unreachable')).toBe(true);
  });

  it('separates a refused key from a missing account and a slow audio file', () => {
    expect(classifyProtectedPlaybackFailure(new KeyServiceError('denied', 'LISTENER_ACCESS_REQUIRED'))).toBe('access-not-confirmed');
    expect(classifyProtectedPlaybackFailure(new KeyServiceError('connect', 'WALLET_REQUIRED'))).toBe('account-required');
    expect(classifyProtectedPlaybackFailure(new Error('Unable to fetch DAV2 audio (504)'))).toBe('audio-unavailable');
    expect(classifyProtectedPlaybackFailure(new ProtectedPlaybackError('access-not-confirmed', 'not allowed'))).toBe('access-not-confirmed');
  });

  it('keeps unrecognized failures out of the retry loop', () => {
    expect(classifyProtectedPlaybackFailure(new Error('E2E full key request denied before payment.'))).toBe('unknown');
    expect(isTransientProtectedPlaybackFailure('unknown')).toBe(false);
    expect(classifyProtectedPlaybackFailure(new KeyServiceError('bad signature', 'SIGNATURE_INVALID'))).toBe('unknown');
    expect(isTransientProtectedPlaybackFailure('account-required')).toBe(false);
  });

  it('gives every kind plain copy without infrastructure vocabulary', () => {
    const kinds: ProtectedPlaybackFailureKind[] = [
      'signature-declined',
      'service-unreachable',
      'access-not-confirmed',
      'audio-unavailable',
      'account-required',
      'unknown'
    ];
    for (const kind of kinds) {
      const copy = protectedPlaybackFailureCopy(kind);
      expect(copy.title).toBeTruthy();
      expect(copy.action).toBeTruthy();
      expect(`${copy.title} ${copy.message}`).not.toMatch(/content key|key service|runtime|RPC|IPFS|nonce/i);
    }
  });
});
