import { describe, expect, it } from 'vitest';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { playbackTrack, roomPlaybackPresentation } from './playbackPresentation';

const solo = { title: 'Solo track', artist: 'Solo artist', imageRef: 'solo-cover', duration: 240 } as CatalogTrack;
const room = { title: 'Room track', artist: 'Room artist', duration: 120 } as TrackInfo;

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
