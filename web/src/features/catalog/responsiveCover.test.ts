import { describe, expect, it } from 'vitest';
import { coverGatewaySources, responsiveCoverSources } from './responsiveCover';

describe('responsive cover sources', () => {
  it('derives same-CID image variants without requesting a separate remote placeholder', () => {
    expect(responsiveCoverSources('https://gateway.example/ipfs/bafy/cover/640.webp')).toEqual({
      srcSet:
        'https://gateway.example/ipfs/bafy/cover/64.webp 64w, https://gateway.example/ipfs/bafy/cover/160.webp 160w, https://gateway.example/ipfs/bafy/cover/320.webp 320w, https://gateway.example/ipfs/bafy/cover/640.webp 640w'
    });
  });

  it('preserves query strings when replacing the variant filename', () => {
    const result = responsiveCoverSources('https://gateway.example/ipfs/bafy/cover/640.webp?token=read');
    expect(result?.srcSet).toContain('https://gateway.example/ipfs/bafy/cover/160.webp?token=read 160w');
  });

  it('keeps legacy covers on their compatibility path', () => {
    expect(responsiveCoverSources('https://gateway.example/ipfs/QmLegacy')).toBeNull();
  });
});

it('recovers only the known flat cover path at the same CID', () => {
  const nested = 'https://gateway.example/ipfs/QmCover/cover/640.webp';
  expect(coverGatewaySources([nested])).toEqual([nested, 'https://gateway.example/ipfs/QmCover/640.webp']);
  expect(responsiveCoverSources('https://gateway.example/ipfs/QmCover/640.webp')?.srcSet).toContain('/QmCover/160.webp 160w');
  expect(coverGatewaySources(['https://example.com/cover/640.webp', 'https://gateway.example/ipfs/QmOther/photo.png'])).toEqual([
    'https://example.com/cover/640.webp',
    'https://gateway.example/ipfs/QmOther/photo.png'
  ]);
});
