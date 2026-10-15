import type { OpenRoom, SocketStatus } from '../../shared/types';

export type RoomEntryState = 'idle' | 'resolving' | 'ready' | 'service-unavailable' | 'room-unavailable';

type ResolveRoomEntryStateInput = {
  initialRoomCode: string;
  joinedRoomId: string;
  openRooms: OpenRoom[];
  socketStatus: SocketStatus;
  isRefreshingRooms: boolean;
};

/**
 * Resolve the share-link threshold without confusing transport failure with an
 * expired room. Discovery is opt-in and cannot establish whether a shared
 * room code exists. Only the room:join reply can declare that room unavailable.
 */
export function resolveRoomEntryState({
  initialRoomCode,
  joinedRoomId,
  openRooms,
  socketStatus,
  isRefreshingRooms
}: ResolveRoomEntryStateInput): RoomEntryState {
  if (!initialRoomCode || joinedRoomId) return 'idle';
  if (openRooms.some(room => room.roomId === initialRoomCode)) return 'ready';
  if (socketStatus === 'error') return 'service-unavailable';
  if (socketStatus === 'online' && !isRefreshingRooms) return 'ready';
  return 'resolving';
}
