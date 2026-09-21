import { describe, expect, it, vi } from 'vitest';
import { allowNeighborPrefetch, hasPlaybackHeadroom, planTrackNeighbors } from './trackNavigation';

describe('transport neighbors', () => {
  it('wraps in both directions and resolves a reversed selection to the original track', () => {
    const ids = ['a', 'b', 'c'];
    expect(planTrackNeighbors(ids, 'a', false)).toEqual({ previousId: 'c', nextId: 'b' });
    const next = planTrackNeighbors(ids, 'a', false).nextId!;
    expect(planTrackNeighbors(ids, next, false).previousId).toBe('a');
    expect(planTrackNeighbors(ids, 'c', false).nextId).toBe('a');
  });

  it('chooses shuffle once per plan and never chooses the current track', () => {
    const random = vi.fn(() => 0.9);
    const plan = planTrackNeighbors(['a', 'b', 'c'], 'b', true, random);
    expect(plan).toEqual({ previousId: 'a', nextId: 'c' });
    expect(random).toHaveBeenCalledTimes(1);
    // Previous keeps the existing catalog ordering, even in shuffle mode.
    expect(planTrackNeighbors(['a', 'b', 'c'], 'b', true, () => 0).previousId).toBe('a');
  });

  it('deduplicates the intended two-track target and tolerates missing selections', () => {
    expect(planTrackNeighbors(['a', 'b'], 'a', true)).toEqual({ previousId: 'b', nextId: 'b' });
    for (const ids of [[], ['a']]) {
      expect(planTrackNeighbors(ids, 'a', false)).toEqual({ previousId: null, nextId: null });
    }
    expect(planTrackNeighbors(['a', 'b', 'c'], 'missing', false)).toEqual({ previousId: 'c', nextId: 'b' });
  });
});

describe('speculative playback budget', () => {
  it('honors background, offline, and connection hints while supporting browsers without the API', () => {
    expect(allowNeighborPrefetch(true, true)).toBe(true);
    expect(allowNeighborPrefetch(false, true)).toBe(false);
    expect(allowNeighborPrefetch(true, false)).toBe(false);
    expect(allowNeighborPrefetch(true, true, { saveData: true })).toBe(false);
    expect(allowNeighborPrefetch(true, true, { effectiveType: '2g' })).toBe(false);
    expect(allowNeighborPrefetch(true, true, { effectiveType: 'slow-2g' })).toBe(false);
    expect(allowNeighborPrefetch(true, true, { effectiveType: '4g' })).toBe(true);
  });

  it('requires advancing audio with ten seconds buffered or all remaining audio', () => {
    const audio = {
      paused: false,
      seeking: false,
      readyState: 4,
      currentTime: 12,
      duration: 60,
      buffered: { length: 1, start: () => 0, end: () => 22 }
    };
    expect(hasPlaybackHeadroom(audio)).toBe(true);
    expect(hasPlaybackHeadroom({ ...audio, paused: true })).toBe(false);
    expect(hasPlaybackHeadroom({ ...audio, seeking: true })).toBe(false);
    expect(hasPlaybackHeadroom({ ...audio, readyState: 2 })).toBe(false);
    expect(hasPlaybackHeadroom({ ...audio, currentTime: 13 })).toBe(false);
    expect(hasPlaybackHeadroom({ ...audio, duration: Infinity })).toBe(false);
    expect(hasPlaybackHeadroom({ ...audio, currentTime: 20, duration: 22 })).toBe(true);
    expect(hasPlaybackHeadroom({ ...audio, currentTime: 30 })).toBe(false);
  });
});
