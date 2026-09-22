import { describe, expect, it } from 'vitest';
import {
  COVER_GATEWAY_TIMEOUT_MS,
  createCoverFallbackDataUri,
  resolveCoverPresentation,
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
    expect(decodeDataUri(first)).not.toContain('<text');
  });

  it('never embeds track text in the generated artwork', () => {
    const svg = decodeDataUri(createCoverFallbackDataUri('<script>&'));

    expect(svg).not.toContain('&lt;script&gt;&amp;');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<text');
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

  it('keeps a slow remote cover loading while its local fallback is visible', () => {
    const remote = 'https://gateway.pinata.cloud/ipfs/QmCoverCid';
    const fallback = 'data:image/svg+xml;utf8,fallback';

    expect(resolveCoverPresentation(remote, fallback, null, false, true)).toEqual({
      source: remote,
      showFallbackBackground: true,
      isReady: true
    });
  });

  it('uses the fallback as the image source only after every gateway fails', () => {
    const fallback = 'data:image/svg+xml;utf8,fallback';

    expect(resolveCoverPresentation('https://gateway.pinata.cloud/ipfs/QmCoverCid', fallback, null, true, true)).toEqual({
      source: fallback,
      showFallbackBackground: false,
      isReady: false
    });
  });
});
