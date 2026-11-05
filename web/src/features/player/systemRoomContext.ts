import type { Mode, SocketStatus } from '../../shared/types';
import type { AudioStatus } from './playbackStatus';
import { roomPlaybackPresentation } from './playbackPresentation';
import { roomHostDisplayName, roomPresenceCount } from '../rooms/roomState';

export type SystemRoomContext = { label: string; presence: string; attribution: string };

/** Same observed state as the dock; no participant names, room code or authority. */
export function systemRoomContext(
  mode: Mode,
  roomId: string,
  status: AudioStatus,
  socketStatus: SocketStatus,
  hostName: string,
  listenerCount: number
): SystemRoomContext | null {
  if (!roomId) return null;
  const host = roomHostDisplayName(hostName);
  return {
    label: roomPlaybackPresentation(mode, status, socketStatus).label,
    presence: socketStatus === 'online' && Number.isSafeInteger(listenerCount) && listenerCount >= 0 ? `${roomPresenceCount(listenerCount, true)} here` : '',
    attribution: mode === 'host' ? 'Your room' : host ? `With ${host}` : 'Listening together'
  };
}

export function systemRoomAlbum(room: SystemRoomContext | null): string {
  return room ? ['Dotify', room.label, room.presence, room.attribution].filter(Boolean).join(' · ') : '';
}
