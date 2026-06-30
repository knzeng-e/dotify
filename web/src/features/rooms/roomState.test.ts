import { describe, expect, it } from 'vitest';
import { buildSessionLink, getInitialRoomCode, roomPresenceCount } from './roomState';

describe('getInitialRoomCode', () => {
  it('reads and uppercases the preferred #/rooms/<id> form', () => {
    expect(getInitialRoomCode('#/rooms/ab12cd')).toBe('AB12CD');
  });

  it('reads the legacy #/?room=<id> form', () => {
    expect(getInitialRoomCode('#/?room=xy99')).toBe('XY99');
  });

  it('returns empty string when no code is present', () => {
    expect(getInitialRoomCode('#/listen')).toBe('');
    expect(getInitialRoomCode('')).toBe('');
  });

  it('ignores room ids outside the 4-12 char range', () => {
    expect(getInitialRoomCode('#/rooms/abc')).toBe('');
  });
});

describe('buildSessionLink', () => {
  it('sets the hash route on the current origin', () => {
    expect(buildSessionLink('AB12CD', 'https://dotify.example/app?x=1')).toBe('https://dotify.example/app?x=1#/rooms/AB12CD');
  });

  it('replaces any existing hash', () => {
    expect(buildSessionLink('NEW1', 'https://dotify.example/#/rooms/OLD9')).toBe('https://dotify.example/#/rooms/NEW1');
  });

  it('returns empty string without a room id or href', () => {
    expect(buildSessionLink('', 'https://dotify.example/')).toBe('');
    expect(buildSessionLink('AB12CD', '')).toBe('');
  });
});

describe('roomPresenceCount', () => {
  it('counts listeners plus the host when in a room', () => {
    expect(roomPresenceCount(3, true)).toBe(4);
    expect(roomPresenceCount(0, true)).toBe(1);
  });

  it('is zero when not in a room', () => {
    expect(roomPresenceCount(5, false)).toBe(0);
  });
});
