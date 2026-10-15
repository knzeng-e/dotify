import { describe, expect, it } from 'vitest';
import type { OpenRoom } from '../../shared/types';
import { resolveRoomEntryState } from './roomEntryState';

const liveRoom = { roomId: '6WYKB8' } as OpenRoom;

describe('resolveRoomEntryState', () => {
  it('keeps a signaling failure retryable instead of declaring the room expired', () => {
    expect(
      resolveRoomEntryState({
        initialRoomCode: '6WYKB8',
        joinedRoomId: '',
        openRooms: [],
        socketStatus: 'error',
        isRefreshingRooms: false
      })
    ).toBe('service-unavailable');
  });

  it('allows a shared code to join even when the private room is absent from discovery', () => {
    expect(
      resolveRoomEntryState({
        initialRoomCode: '6WYKB8',
        joinedRoomId: '',
        openRooms: [],
        socketStatus: 'online',
        isRefreshingRooms: false
      })
    ).toBe('ready');
  });

  it('prefers a matching live room over stale transport state', () => {
    expect(
      resolveRoomEntryState({
        initialRoomCode: '6WYKB8',
        joinedRoomId: '',
        openRooms: [liveRoom],
        socketStatus: 'error',
        isRefreshingRooms: false
      })
    ).toBe('ready');
  });
});
