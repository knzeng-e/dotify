import { describe, expect, it } from 'vitest';
import { hasReleaseChronology, recentListeningTracks, rememberRecentPlay } from './discoveryShelves';

describe('discovery shelves', () => {
  it('deduplicates actual plays and bounds in-memory history', () => {
    const history = ['a', 'b'];
    expect(rememberRecentPlay(history, 'a')).toBe(history);
    expect(rememberRecentPlay(history, 'b')).toEqual(['b', 'a']);
    expect(rememberRecentPlay(history, '')).toBe(history);
    expect(
      rememberRecentPlay(
        Array.from({ length: 12 }, (_, i) => String(i)),
        'new'
      )
    ).toHaveLength(12);
    expect(history).toEqual(['a', 'b']);
  });
  it('omits missing and inactive releases instead of inventing catalog records', () => {
    expect(recentListeningTracks([{ id: 'a' }, { id: 'b', active: false }, { id: 'c' }], ['c', 'b', 'missing', 'a', 'c'])).toEqual([{ id: 'c' }, { id: 'a' }]);
  });
  it('requires real registration blocks for the novelty label', () => {
    expect(hasReleaseChronology([])).toBe(false);
    expect(hasReleaseChronology([{ source: 'artist' }])).toBe(false);
    expect(hasReleaseChronology([{ source: 'seed', registeredAtBlock: 10 }])).toBe(false);
    expect(hasReleaseChronology([{ source: 'artist', registeredAtBlock: 0 }])).toBe(false);
    expect(hasReleaseChronology([{ source: 'artist', registeredAtBlock: 10 }])).toBe(true);
  });
});
