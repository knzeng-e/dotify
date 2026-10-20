import { expect, it } from 'vitest';
import { isArtistRoomActivitySnapshot } from './artistRoomActivity';
const runtime = `0x${'11'.repeat(20)}`;
const room = {
  roomId: 'ABC234',
  hostName: 'Host',
  hostConnected: true,
  createdAt: 1000,
  listenerCount: 2,
  isFull: false,
  visibility: 'nearby',
  track: { runtimeAddress: runtime, hash: `0x${'22'.repeat(32)}`, title: 'Song', artist: 'Artist', imageRef: '' },
  playerState: null
};
const snapshot = { ok: true, roomCount: 3, connectedCount: 5, rooms: [room], updatedAt: 1000 };
it('accepts private aggregates with only public artist invitations', () => {
  expect(isArtistRoomActivitySnapshot(snapshot, runtime)).toBe(true);
  expect(isArtistRoomActivitySnapshot({ ...snapshot, rooms: [] }, runtime)).toBe(true);
  expect(isArtistRoomActivitySnapshot({ ...snapshot, roomCount: 0, connectedCount: 0, rooms: [] }, runtime)).toBe(true);
});
it('rejects malformed snapshots, private identities, unbounded counts and unsafe image URLs without throwing', () => {
  for (const candidate of [
    null,
    [],
    { ...snapshot, roomCount: -1 },
    { ...snapshot, connectedCount: Infinity },
    { ...snapshot, privateRoomIds: ['PRIVATE'] },
    { ...snapshot, rooms: [room, room] },
    ...[
      null,
      { ...room, visibility: 'private' },
      { ...room, listenerCount: 10001 },
      { ...room, hostName: 'x'.repeat(33) },
      { ...room, track: { ...room.track, runtimeAddress: 42 } },
      { ...room, track: { ...room.track, imageRef: 'https://tracker.invalid' } },
      { ...room, track: { ...room.track, runtimeAddress: `0x${'33'.repeat(20)}` } }
    ].map(value => ({ ...snapshot, rooms: [value] }))
  ])
    expect(isArtistRoomActivitySnapshot(candidate, runtime)).toBe(false);
});
