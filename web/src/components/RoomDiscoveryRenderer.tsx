import { SkyOfRooms } from './SkyOfRooms';
import type { OpenRoom, SessionAction } from '../shared/types';

export type RoomDiscoveryRendererKind = 'sky-2d';

type RoomDiscoveryRendererProps = {
  renderer?: RoomDiscoveryRendererKind;
  rooms: OpenRoom[];
  selectedRoomId?: string;
  sessionAction: SessionAction;
  onSelectRoom: (roomId: string) => void;
  onJoinRoom: (roomId: string) => void;
};

// Boundary for later immersive renderers. W10 keeps the honest DOM/CSS 2D sky
// as the only implementation, so mobile/list users and Product hosts share the
// same room data contract before any optional 3D surface is introduced.
export function RoomDiscoveryRenderer({ renderer = 'sky-2d', rooms, selectedRoomId, sessionAction, onSelectRoom, onJoinRoom }: RoomDiscoveryRendererProps) {
  if (renderer !== 'sky-2d') return null;

  return <SkyOfRooms rooms={rooms} selectedRoomId={selectedRoomId} sessionAction={sessionAction} onSelectRoom={onSelectRoom} onJoinRoom={onJoinRoom} />;
}
