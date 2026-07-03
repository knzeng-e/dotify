import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../shared/types';
import { deriveSupportSummary } from './supportSummary';

function track(id: string, artist: string, artistAddress?: `0x${string}`): CatalogTrack {
  return { id, artist, artistAddress } as CatalogTrack;
}

const tracks = [
  track('t1', 'Nova', '0xAAA'),
  track('t2', 'Nova', '0xAAA'),
  track('t3', 'Mika', '0xBBB'),
  track('t4', 'Free Spirit') // no address: keyed by name
];

describe('deriveSupportSummary', () => {
  it('returns only tracks with a truthy paid-access entry', () => {
    const { paidTracks } = deriveSupportSummary(tracks, { t1: true, t2: false, t3: true });
    expect(paidTracks.map(t => t.id)).toEqual(['t1', 't3']);
  });

  it('ignores paid ids that are not in the catalog', () => {
    const { paidTracks } = deriveSupportSummary(tracks, { t1: true, missing: true });
    expect(paidTracks.map(t => t.id)).toEqual(['t1']);
  });

  it('groups artists by address and counts unlocked tracks', () => {
    const { supportedArtists } = deriveSupportSummary(tracks, { t1: true, t2: true, t3: true });
    expect(supportedArtists).toEqual([
      { artist: 'Nova', artistAddress: '0xAAA', trackCount: 2 },
      { artist: 'Mika', artistAddress: '0xBBB', trackCount: 1 }
    ]);
  });

  it('falls back to the artist name as the key when there is no address', () => {
    const { supportedArtists } = deriveSupportSummary(tracks, { t4: true });
    expect(supportedArtists).toEqual([{ artist: 'Free Spirit', artistAddress: undefined, trackCount: 1 }]);
  });

  it('returns empty rollups when nothing is paid', () => {
    expect(deriveSupportSummary(tracks, {})).toEqual({ paidTracks: [], supportedArtists: [] });
  });
});
