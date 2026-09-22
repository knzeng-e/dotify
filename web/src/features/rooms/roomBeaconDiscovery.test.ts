import { describe, expect, it } from 'vitest';

import type { OpenRoom } from '../../shared/types';
import { mergeDiscoveredRooms, roomBeaconToOpenRoom } from './roomBeaconDiscovery';

const signalRoom: OpenRoom = {
  roomId: 'AB12CD',
  hostName: 'Amina',
  createdAt: 42,
  listenerCount: 4,
  maxListeners: 8,
  isFull: false,
  track: null,
  playerState: null
};

describe('roomBeaconToOpenRoom', () => {
  it('keeps a beacon sparse and marks its discovery source', () => {
    expect(
      roomBeaconToOpenRoom({
        version: 1,
        room: 'XY98ZT',
        host: 'Kofi',
        listenerCount: 2
      })
    ).toEqual({
      roomId: 'XY98ZT',
      hostName: 'Kofi',
      createdAt: 0,
      listenerCount: 2,
      track: null,
      playerState: null,
      discoverySource: 'statement-store'
    });
  });

  it('adapts consented now-playing text without inventing playable media', () => {
    const room = roomBeaconToOpenRoom({
      version: 1,
      room: 'XY98ZT',
      host: 'Kofi',
      listenerCount: 2,
      title: 'Night Walk',
      artist: 'Mina'
    });

    expect(room.track).toMatchObject({ title: 'Night Walk', artist: 'Mina', hash: '', bulletinRef: '' });
    expect(room.track?.audioRef).toBeUndefined();
  });
});

describe('mergeDiscoveredRooms', () => {
  it('keeps beacon-only rooms discoverable', () => {
    const beaconRoom = roomBeaconToOpenRoom({ version: 1, room: 'XY98ZT', host: 'Kofi', listenerCount: 2 });

    expect(mergeDiscoveredRooms([], [beaconRoom])).toEqual([beaconRoom]);
  });

  it('uses signaling as the authoritative record for duplicate room codes', () => {
    const staleBeacon = roomBeaconToOpenRoom({ version: 1, room: 'ab12cd', host: 'Old name', listenerCount: 1 });

    expect(mergeDiscoveredRooms([signalRoom], [staleBeacon])).toEqual([{ ...signalRoom, discoverySource: 'signal' }]);
  });

  it('preserves signaling order and appends only beacon-only rooms', () => {
    const secondSignal = { ...signalRoom, roomId: 'CD34EF' };
    const duplicate = roomBeaconToOpenRoom({ version: 1, room: 'CD34EF', host: 'Old name', listenerCount: 1 });
    const beaconOnly = roomBeaconToOpenRoom({ version: 1, room: 'XY98ZT', host: 'Kofi', listenerCount: 2 });

    expect(mergeDiscoveredRooms([signalRoom, secondSignal], [duplicate, beaconOnly]).map(room => room.roomId)).toEqual(['AB12CD', 'CD34EF', 'XY98ZT']);
  });
});
