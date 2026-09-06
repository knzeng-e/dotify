import { describe, expect, it } from 'vitest';
import {
  COVER_GATEWAY_TIMEOUT_MS,
  createCoverFallbackDataUri,
  shouldArmCoverGatewayTimeout,
  shouldUseLocalCoverFallbackAfterGatewayTimeout
} from './coverArtwork';

function decodeDataUri(uri: string): string {
  return decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
}

describe('cover artwork fallbacks', () => {
  it('creates a deterministic SVG data URI for missing or failed artwork', () => {
    const first = createCoverFallbackDataUri('Street Scriptures', 'street');
    const second = createCoverFallbackDataUri('Street Scriptures', 'street');

    expect(first).toBe(second);
    expect(first).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(decodeDataUri(first)).toContain('Street Scriptures');
  });

  it('escapes labels before embedding them in the SVG', () => {
    const svg = decodeDataUri(createCoverFallbackDataUri('<script>&'));

    expect(svg).toContain('&lt;script&gt;&amp;');
    expect(svg).not.toContain('<script>');
  });

  it('keeps slow gateway recovery inside the W08 cover budget', () => {
    expect(COVER_GATEWAY_TIMEOUT_MS).toBeLessThanOrEqual(1_200);
  });

  it('does not start lazy cover gateway timers before the image enters load range', () => {
    expect(shouldArmCoverGatewayTimeout('lazy', false)).toBe(false);
    expect(shouldArmCoverGatewayTimeout('lazy', true)).toBe(true);
    expect(shouldArmCoverGatewayTimeout('eager', false)).toBe(true);
    expect(shouldArmCoverGatewayTimeout(undefined, false)).toBe(true);
  });

  it('recovers slow covers with the local fallback instead of racing public gateways', () => {
    expect(shouldUseLocalCoverFallbackAfterGatewayTimeout('https://gateway.pinata.cloud/ipfs/QmCoverCid', null, false)).toBe(true);
    expect(
      shouldUseLocalCoverFallbackAfterGatewayTimeout('https://gateway.pinata.cloud/ipfs/QmCoverCid', 'https://gateway.pinata.cloud/ipfs/QmCoverCid', false)
    ).toBe(false);
    expect(shouldUseLocalCoverFallbackAfterGatewayTimeout(undefined, null, false)).toBe(false);
    expect(shouldUseLocalCoverFallbackAfterGatewayTimeout('https://gateway.pinata.cloud/ipfs/QmCoverCid', null, true)).toBe(false);
  });
});
