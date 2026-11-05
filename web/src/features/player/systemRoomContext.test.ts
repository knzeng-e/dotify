import { expect, it } from 'vitest';
import { systemRoomContext, systemRoomAlbum } from './systemRoomContext';

it('uses the same room status, observed people count and chosen host as the dock', () => {
  const guest = systemRoomContext('listener', 'PRIVATE-CODE', 'playing', 'online', 'Music host', 2);
  expect(guest).toEqual({ label: 'Room live', presence: '3 here', attribution: 'With Music host' });
  expect(systemRoomAlbum(guest)).toBe('Dotify · Room live · 3 here · With Music host');
  expect(systemRoomAlbum(guest)).not.toContain('PRIVATE-CODE');
  expect(systemRoomContext('host', 'ROOM', 'playing', 'online', 'Music host', 0)).toEqual({
    label: 'Hosting live',
    presence: '1 here',
    attribution: 'Your room'
  });
});

it('never advertises a live count during reconnect or invents a host identity', () => {
  expect(systemRoomContext('listener', 'ROOM', 'playing', 'offline', 'Host', 12)).toEqual({
    label: 'Room · Reconnecting',
    presence: '',
    attribution: 'Listening together'
  });
  expect(systemRoomContext('listener', 'ROOM', 'playing', 'online', '', NaN)?.presence).toBe('');
  expect(systemRoomContext('listener', 'ROOM', 'playing', 'online', '', -1)?.presence).toBe('');
});

it('retiring a room removes all room metadata, including from solo playback', () => {
  expect(systemRoomContext('host', '', 'playing', 'online', 'Former host', 10)).toBeNull();
  expect(systemRoomAlbum(null)).toBe('');
});
