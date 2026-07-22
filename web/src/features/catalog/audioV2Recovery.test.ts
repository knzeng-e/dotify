import { describe, expect, it, vi } from 'vitest';
import { AudioV2ChunkAuthenticationError, routeAudioV2MseFailure } from './audioV2Recovery';

function handlers(error: unknown, contextActive = true) {
  return {
    error,
    contextActive,
    retire: vi.fn(),
    recover: vi.fn(),
    reportAuthenticationFailure: vi.fn()
  };
}

describe('DAV2 MSE failure routing', () => {
  it('fails closed on chunk authentication errors without invoking full-file recovery', () => {
    const authenticationError = new AudioV2ChunkAuthenticationError(new Error('AES-GCM tag mismatch'));
    const options = handlers(authenticationError);

    routeAudioV2MseFailure(options);

    expect(options.reportAuthenticationFailure).toHaveBeenCalledOnce();
    expect(options.reportAuthenticationFailure).toHaveBeenCalledWith(authenticationError);
    expect(options.retire).toHaveBeenCalledOnce();
    expect(options.recover).not.toHaveBeenCalled();
  });

  it('routes recoverable gateway and parser errors to the authenticated full-file path', () => {
    const gatewayError = new Error('DAV2 range request failed');
    const options = handlers(gatewayError);

    routeAudioV2MseFailure(options);

    expect(options.recover).toHaveBeenCalledOnce();
    expect(options.recover).toHaveBeenCalledWith(gatewayError);
    expect(options.reportAuthenticationFailure).not.toHaveBeenCalled();
    expect(options.retire).not.toHaveBeenCalled();
  });

  it.each([
    ['an aborted request', new DOMException('cancelled', 'AbortError'), true],
    ['an inactive playback context', new Error('stale playback'), false]
  ])('retires playback without recovery for %s', (_label, error, contextActive) => {
    const options = handlers(error, contextActive);

    routeAudioV2MseFailure(options);

    expect(options.retire).toHaveBeenCalledOnce();
    expect(options.recover).not.toHaveBeenCalled();
    expect(options.reportAuthenticationFailure).not.toHaveBeenCalled();
  });
});
