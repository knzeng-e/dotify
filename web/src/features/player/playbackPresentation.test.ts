import { describe, expect, it } from 'vitest';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { playbackTrack, playbackTrackDetails, roomPlaybackPresentation, roomReleaseDetails } from './playbackPresentation';

const solo = {
  title: 'Solo track',
  artist: 'Solo artist',
  imageRef: 'solo-cover',
  duration: 240,
  accessMode: 'free',
  priceDot: '0',
  description: 'Solo release note'
} as CatalogTrack;
const room = {
  title: 'Room track',
  artist: 'Room artist',
  duration: 120,
  accessMode: 'classic',
  priceDot: '4.2',
  description: 'Room access note'
} as TrackInfo;

describe('playback metadata authority', () => {
  it('uses the complete room snapshot even with a different local selection', () => {
    expect(playbackTrack('listener', room, solo)).toBe(room);
    expect(playbackTrack('listener', room, solo)?.imageRef).toBeUndefined();
  });
  it('never substitutes a solo track while waiting for room metadata', () => {
    expect(playbackTrack('listener', null, solo)).toBeNull();
  });
  it('restores the local track after leaving, even while remote metadata remains', () => {
    expect(playbackTrack('host', room, solo)).toBe(solo);
    expect(playbackTrack('host', null, solo)).toBe(solo);
    expect(playbackTrack('host', room, undefined)).toBe(room);
  });
  it('uses the same authority for access labels and release copy', () => {
    expect(playbackTrackDetails('host', room, solo, { accessMode: 'human-free', priceDot: '1' })).toEqual({
      accessMode: 'free',
      priceDot: '0',
      description: 'Solo release note'
    });
    expect(playbackTrackDetails('listener', room, solo, { accessMode: 'human-free', priceDot: '1' })).toEqual({
      accessMode: 'classic',
      priceDot: '4.2',
      description: 'Room access note'
    });
  });
});

describe('room release discovery', () => {
  const hash = `0x${'1'.repeat(64)}` as const;
  const firstRuntime = '0x0000000000000000000000000000000000000001' as const;
  const secondRuntime = '0x0000000000000000000000000000000000000002' as const;
  const first = { ...solo, source: 'artist', id: `${firstRuntime}:${hash}`, hash } as CatalogTrack;
  const second = { ...first, id: `${secondRuntime}:${hash}`, title: 'Another release' };
  const snapshot = { ...room, hash, runtimeAddress: firstRuntime };

  it('enriches only the room hash/runtime, independently of a personal selection', () => {
    expect(roomReleaseDetails(snapshot, [second, first])).toBe(first);
    expect(roomReleaseDetails(null, [first])).toBeNull();
    expect(roomReleaseDetails({ ...snapshot, title: '' }, [first])).toBeNull();
  });
  it('keeps a useful host snapshot for missing or ambiguous catalog identity', () => {
    expect(roomReleaseDetails({ ...snapshot, runtimeAddress: undefined }, [first, second])?.title).toBe('Room track');
    expect(roomReleaseDetails({ ...snapshot, runtimeAddress: secondRuntime }, [first])?.title).toBe('Room track');
    expect(roomReleaseDetails({ ...snapshot, hash: '' }, [first])?.title).toBe('Room track');
    // Extra wire fields cannot make an unverified host snapshot a CatalogTrack.
    const extraFields = { ...snapshot, id: 'not-a-catalog-release', royaltySplits: [] };
    expect(roomReleaseDetails(extraFields, [])).not.toHaveProperty('id');
    expect(roomReleaseDetails(extraFields, [])).not.toHaveProperty('royaltySplits');
  });
  it('does not follow arbitrary room-provided metadata URLs', () => {
    expect(roomReleaseDetails({ ...snapshot, metadataRef: 'https://private.test/key' }, [])?.metadataRef).toBeUndefined();
    const ref = `ipfs://bafy${'a'.repeat(50)}/release.json`;
    expect(roomReleaseDetails({ ...snapshot, metadataRef: ref }, [])?.metadataRef).toBe(ref);
  });
});

describe('room playback context', () => {
  it('distinguishes receiving and hosting live audio', () => {
    expect(roomPlaybackPresentation('listener', 'playing', 'online')).toEqual({ label: 'Room live', live: true });
    expect(roomPlaybackPresentation('host', 'playing', 'online')).toEqual({ label: 'Hosting live', live: true });
  });
  it('does not claim live playback on stale signaling or interrupted audio', () => {
    expect(roomPlaybackPresentation('listener', 'playing', 'offline')).toEqual({ label: 'Room · Reconnecting', live: false });
    expect(roomPlaybackPresentation('listener', 'syncing', 'online')).toEqual({ label: 'Room · Syncing with host', live: false });
    expect(roomPlaybackPresentation('listener', 'host-paused', 'online')).toEqual({ label: 'Room · Host paused', live: false });
    expect(roomPlaybackPresentation('listener', 'listener-paused', 'online')).toEqual({ label: 'Room · Paused for you', live: false });
    expect(roomPlaybackPresentation('listener', 'autoplay-blocked', 'online').live).toBe(false);
    expect(roomPlaybackPresentation('listener', 'no-audio', 'online').live).toBe(false);
  });
});
