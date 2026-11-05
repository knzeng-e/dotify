import { expect, it } from 'vitest';
import { resolveSystemArtwork, systemArtworkCandidates } from './systemArtwork';

it('resolves full IPFS references rather than embedding the scheme in a gateway path', () => {
  const ref = 'ipfs://QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu/cover/640.webp';
  const candidates = systemArtworkCandidates(ref);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every(image => /^https?:\/\//.test(image.src) && !image.src.includes('/ipfs/ipfs://'))).toBe(true);
  expect(candidates[0].src).toContain('/ipfs/QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu/cover/640.webp');
});

it('keeps public image URLs and never exposes a Dotify marker as an artwork URL', () => {
  expect(systemArtworkCandidates('https://covers.test/art.png')[0]).toEqual({ src: 'https://covers.test/art.png' });
  expect(systemArtworkCandidates('dotify:cover:0x1234')).toEqual([]);
  expect(systemArtworkCandidates(undefined)).toEqual([]);
  expect(systemArtworkCandidates('dotify:enc:v3:key-v2:ipfs://private')).toEqual([]);
});

it('cancels before decoding or fetching when the source is already retired', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(resolveSystemArtwork({ title: 'Retired', artist: 'Artist' }, controller.signal)).rejects.toThrow();
});
