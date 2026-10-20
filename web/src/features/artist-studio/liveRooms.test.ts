import { expect, it } from 'vitest';
import { artistLiveRooms, liveRoomState } from './liveRooms';
import type { CatalogTrack, OpenRoom } from '../../shared/types';
const runtime = `0x${'11'.repeat(20)}`;
const hash = `0x${'22'.repeat(32)}`;
const track = { id: `${runtime}:${hash}`, hash, active: true, title: 'Canonical' } as CatalogTrack;
const room = { roomId: 'ABC123', hostName: 'Ada', track: { hash, runtimeAddress: runtime }, listenerCount: 2, playerState: { playing: true } } as OpenRoom;
it('matches complete canonical identities and rejects names, collisions, inactive works and beacons', () => {
  expect(artistLiveRooms([room], [track], runtime)).toEqual([{ room, track }]);
  expect(artistLiveRooms([{ ...room, track: { ...room.track!, runtimeAddress: undefined } }], [track], runtime)).toEqual([]);
  expect(artistLiveRooms([{ ...room, discoverySource: 'statement-store' }], [track], runtime)).toEqual([]);
  expect(artistLiveRooms([room], [{ ...track, active: false }], runtime)).toEqual([]);
  expect(artistLiveRooms([room], [{ ...track, id: `another:${hash}` }], runtime)).toEqual([]);
  expect(artistLiveRooms([room], [track], null)).toEqual([]);
});
it('distinguishes activity from pauses and missing or stale playback evidence', () => {
  expect(liveRoomState(room)).toBe('Playing');
  expect(liveRoomState({ ...room, playerState: { ...room.playerState!, playing: false } })).toBe('Paused');
  expect(liveRoomState({ ...room, hostConnected: false })).toBe('Reconnecting');
  expect(liveRoomState({ ...room, playerState: null })).toBe('Waiting for audio');
  expect(liveRoomState({ ...room, playerState: { ...room.playerState!, stale: true } })).toBe('Waiting for audio');
});
