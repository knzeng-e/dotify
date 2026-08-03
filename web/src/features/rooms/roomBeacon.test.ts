import { describe, expect, it } from 'vitest';
import {
  MAX_ACCOUNT_BYTES,
  MAX_BEACON_BYTES,
  assertBeaconBudget,
  beaconByteLength,
  buildRoomBeacon,
  parseRoomBeacon,
  roomBeaconChannel,
  roomBeaconTopic
} from './roomBeacon';

const base = { roomCode: 'AB12CD', hostName: 'Kevin', listenerCount: 3 };

describe('buildRoomBeacon', () => {
  it('builds a compact beacon well inside the statement ceiling', () => {
    const beacon = buildRoomBeacon(base);
    expect(beacon).toEqual({ version: 1, room: 'AB12CD', host: 'Kevin', listenerCount: 3 });
    expect(beaconByteLength(beacon!)).toBeLessThan(MAX_BEACON_BYTES);
  });

  it('omits now-playing unless the host opted in', () => {
    // Publishing what someone is listening to is a different exposure than
    // sharing a link, so it must never appear by default.
    expect(buildRoomBeacon(base)).not.toHaveProperty('title');
    expect(buildRoomBeacon({ ...base, nowPlaying: null })).not.toHaveProperty('title');

    const opted = buildRoomBeacon({ ...base, nowPlaying: { title: 'Kwenda', artist: 'Muzinga' } });
    expect(opted).toMatchObject({ title: 'Kwenda', artist: 'Muzinga' });
  });

  it('never carries listener identities, only an aggregate count', () => {
    const beacon = buildRoomBeacon({ ...base, listenerCount: 7 });
    expect(Object.keys(beacon!).sort()).toEqual(['host', 'listenerCount', 'room', 'version']);
    expect(beacon!.listenerCount).toBe(7);
  });

  it('rejects a room code that could not be joined anyway', () => {
    expect(buildRoomBeacon({ ...base, roomCode: '' })).toBeNull();
    expect(buildRoomBeacon({ ...base, roomCode: 'AB' })).toBeNull();
    expect(buildRoomBeacon({ ...base, roomCode: 'not-a-code!' })).toBeNull();
  });

  it('clamps a hostile listener count instead of publishing it', () => {
    expect(buildRoomBeacon({ ...base, listenerCount: -5 })!.listenerCount).toBe(0);
    expect(buildRoomBeacon({ ...base, listenerCount: 10 ** 9 })!.listenerCount).toBe(9999);
    expect(buildRoomBeacon({ ...base, listenerCount: Number.NaN })!.listenerCount).toBe(0);
  });

  it('stays inside the ceiling when every field is oversized', () => {
    const beacon = buildRoomBeacon({
      roomCode: 'ZZZZZZZZZZZZ',
      hostName: 'x'.repeat(500),
      listenerCount: 9999,
      nowPlaying: { title: 'y'.repeat(500), artist: 'z'.repeat(500) }
    });

    expect(beacon).not.toBeNull();
    expect(beaconByteLength(beacon!)).toBeLessThanOrEqual(MAX_BEACON_BYTES);
    expect(beacon!.room).toBe('ZZZZZZZZZZZZ');
  });

  it('stays inside the ceiling for multi-byte text, where character bounds are not byte bounds', () => {
    // A 4-byte emoji clamped to 40 characters is 160 bytes, so the byte check
    // has to be the authority rather than the length bound.
    const beacon = buildRoomBeacon({
      roomCode: 'AB12CD',
      hostName: '🎧'.repeat(200),
      listenerCount: 1,
      nowPlaying: { title: '音楽'.repeat(200), artist: '🎵'.repeat(200) }
    });

    expect(beacon).not.toBeNull();
    expect(beaconByteLength(beacon!)).toBeLessThanOrEqual(MAX_BEACON_BYTES);
  });

  it('sheds now-playing before the room identity when space runs out', () => {
    const beacon = buildRoomBeacon({
      roomCode: 'AB12CD',
      hostName: 'h'.repeat(40),
      listenerCount: 1,
      nowPlaying: { title: '🎼'.repeat(60), artist: '🎹'.repeat(60) }
    });

    // Degrades to "a room exists here" rather than failing to announce at all.
    expect(beacon!.room).toBe('AB12CD');
    expect(beaconByteLength(beacon!)).toBeLessThanOrEqual(MAX_BEACON_BYTES);
  });
});

describe('assertBeaconBudget', () => {
  it('accepts what one account can actually hold', () => {
    const beacons = [buildRoomBeacon(base)!, buildRoomBeacon({ ...base, roomCode: 'EF34GH' })!];
    const budget = assertBeaconBudget(beacons);

    expect(budget.ok).toBe(true);
    expect(budget.usedBytes).toBeLessThanOrEqual(MAX_ACCOUNT_BYTES);
  });

  it('refuses a set that the chain would silently reject', () => {
    // Over the account total the chain rejects the write, which a user sees as a
    // room that never appears. An explainable refusal beats a vanishing room.
    const many = Array.from({ length: 12 }, (_, index) =>
      buildRoomBeacon({
        roomCode: `ROOM${String(index).padStart(2, '0')}`,
        hostName: 'a-fairly-long-host-name-here',
        listenerCount: index,
        nowPlaying: { title: 'A reasonably long track title', artist: 'A reasonably long artist name' }
      })
    ).filter((beacon): beacon is NonNullable<typeof beacon> => Boolean(beacon));

    const budget = assertBeaconBudget(many);
    expect(budget.ok).toBe(false);
    expect(budget.ok === false && budget.reason).toMatch(/account limit/);
  });
});

describe('parseRoomBeacon', () => {
  it('round-trips a beacon it built', () => {
    const beacon = buildRoomBeacon({ ...base, nowPlaying: { title: 'Kwenda', artist: 'Muzinga' } })!;
    expect(parseRoomBeacon(JSON.parse(JSON.stringify(beacon)))).toEqual(beacon);
  });

  it('rejects anything that is not a version 1 beacon', () => {
    // Statements come from arbitrary accounts, so shape cannot be assumed.
    for (const bad of [null, undefined, 42, 'beacon', [], {}, { version: 2, room: 'AB12CD', host: 'K' }]) {
      expect(parseRoomBeacon(bad)).toBeNull();
    }
  });

  it('rejects a malformed room or missing host rather than listing a dead room', () => {
    expect(parseRoomBeacon({ version: 1, room: '!!', host: 'K', listenerCount: 1 })).toBeNull();
    expect(parseRoomBeacon({ version: 1, room: 'AB12CD', host: '', listenerCount: 1 })).toBeNull();
  });

  it('clamps hostile values from a remote publisher', () => {
    const parsed = parseRoomBeacon({
      version: 1,
      room: 'ab12cd',
      host: 'h'.repeat(500),
      listenerCount: Number.MAX_SAFE_INTEGER,
      title: 't'.repeat(500),
      artist: 'a'.repeat(500)
    });

    expect(parsed!.room).toBe('AB12CD');
    expect(parsed!.host.length).toBeLessThanOrEqual(40);
    expect(parsed!.listenerCount).toBe(9999);
    expect(parsed!.title!.length).toBeLessThanOrEqual(60);
  });

  it('ignores a negative count instead of rendering it', () => {
    expect(parseRoomBeacon({ version: 1, room: 'AB12CD', host: 'K', listenerCount: -10 })!.listenerCount).toBe(0);
  });
});

describe('channel and topic naming', () => {
  it('gives one last-write-wins channel per room', () => {
    // Without this every heartbeat would be a new statement and the account
    // budget would be gone within a couple of beats.
    expect(roomBeaconChannel('ab12cd')).toBe('room/AB12CD');
    expect(roomBeaconChannel('AB12CD')).toBe(roomBeaconChannel('ab12cd'));
  });

  it('scopes a subscriber to one room', () => {
    expect(roomBeaconTopic('ab12cd')).toBe('dotify-room-AB12CD');
  });
});
