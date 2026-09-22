import { describe, expect, it } from 'vitest';
import type { CatalogTrack, RoomLineupItem } from '../../shared/types';
import { lineupItemFromTrack, playableLineupTracks, previousTrackDecision, recordPlaybackHistory, ROOM_LINEUP_LIMIT } from './playbackQueue';

function track(id: string, active = true): CatalogTrack {
  return {
    id,
    zone: 'test',
    title: `Track ${id}`,
    artist: 'Artist',
    audioRef: `ipfs://${id}`,
    imageRef: `ipfs://cover-${id}`,
    priceDot: '0',
    hash: `0x${id.padEnd(64, '0')}` as `0x${string}`,
    description: '',
    bulletinRef: '',
    metadataRef: '',
    royaltyBps: 0,
    durationLabel: '1:00',
    accessMode: 'free',
    active,
    source: 'seed',
    royaltySplits: [],
    personhoodLevel: 'DIM1',
    encrypted: false
  };
}

describe('room playback lineup', () => {
  it('resolves active catalog tracks, removes duplicates, and stays bounded', () => {
    const catalog = Array.from({ length: ROOM_LINEUP_LIMIT + 2 }, (_, index) => track(String(index + 1)));
    catalog[1].active = false;
    const lineup: RoomLineupItem[] = [
      ...catalog.map(lineupItemFromTrack),
      lineupItemFromTrack(catalog[0]),
      { ...lineupItemFromTrack(track('missing')), trackId: 'missing' }
    ];
    const resolved = playableLineupTracks(lineup, catalog);
    expect(resolved).toHaveLength(ROOM_LINEUP_LIMIT);
    expect(resolved.map(item => item.id)).not.toContain('2');
    expect(new Set(resolved.map(item => item.id)).size).toBe(resolved.length);
  });

  it('publishes presentation metadata without source references', () => {
    const item = lineupItemFromTrack(track('a'));
    expect(item).toEqual(expect.objectContaining({ trackId: 'a', title: 'Track a', artist: 'Artist', accessMode: 'free' }));
    expect(item).not.toHaveProperty('audioRef');
    expect(item).not.toHaveProperty('metadataRef');
  });
});

describe('real playback history', () => {
  it('records actual transitions without duplicating repeated render updates', () => {
    expect(recordPlaybackHistory(['a'], 'a')).toEqual(['a']);
    expect(recordPlaybackHistory(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('restarts the current song after three seconds and otherwise opens the prior song', () => {
    expect(previousTrackDecision(['a', 'b'], 'b', 3.1)).toEqual({ action: 'restart' });
    expect(previousTrackDecision(['a', 'b'], 'b', 2.9)).toEqual({ action: 'open', trackId: 'a', history: ['a'] });
    expect(previousTrackDecision([], 'a', 0)).toEqual({ action: 'catalog' });
  });
});
