import { describe, expect, it } from 'vitest';
import { responsiveCoverSources } from './responsiveCover';

describe('responsive cover sources', () => {
  it('derives same-CID variants and placeholder from a responsive primary ref', () => {
    expect(responsiveCoverSources('https://gateway.example/ipfs/bafy/cover/640.webp')).toEqual({
      srcSet:
        'https://gateway.example/ipfs/bafy/cover/64.webp 64w, https://gateway.example/ipfs/bafy/cover/160.webp 160w, https://gateway.example/ipfs/bafy/cover/320.webp 320w, https://gateway.example/ipfs/bafy/cover/640.webp 640w',
      placeholder: 'https://gateway.example/ipfs/bafy/cover/placeholder.webp'
    });
  });

  it('preserves query strings when replacing the variant filename', () => {
    const result = responsiveCoverSources('https://gateway.example/ipfs/bafy/cover/640.webp?token=read');
    expect(result?.placeholder).toBe('https://gateway.example/ipfs/bafy/cover/placeholder.webp?token=read');
  });

  it('keeps legacy covers on their compatibility path', () => {
    expect(responsiveCoverSources('https://gateway.example/ipfs/QmLegacy')).toBeNull();
  });
});
