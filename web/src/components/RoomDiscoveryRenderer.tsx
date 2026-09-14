import { RoomGalaxyScene } from './RoomGalaxyScene';
import { SkyOfRooms } from './SkyOfRooms';
import type { OpenRoom, SessionAction } from '../shared/types';

export type RoomDiscoveryRendererKind = 'galaxy-3d' | 'sky-2d';

type RoomDiscoveryRendererProps = {
  renderer?: RoomDiscoveryRendererKind;
  rooms: OpenRoom[];
  selectedRoomId?: string;
  sessionAction: SessionAction;
  onSelectRoom: (roomId: string) => void;
  onJoinRoom: (roomId: string) => void;
};

// Boundary for immersive renderers. The 3D galaxy is an enhancement over the
// same real open-room data; the 2D sky and card grid remain the complete path
// for reduced motion, mobile, unsupported graphics, and rollback.
export function RoomDiscoveryRenderer({ renderer = 'sky-2d', rooms, selectedRoomId, sessionAction, onSelectRoom, onJoinRoom }: RoomDiscoveryRendererProps) {
  if (renderer === 'galaxy-3d') {
    return <RoomGalaxyScene rooms={rooms} selectedRoomId={selectedRoomId} sessionAction={sessionAction} onSelectRoom={onSelectRoom} onJoinRoom={onJoinRoom} />;
  }

  return <SkyOfRooms rooms={rooms} selectedRoomId={selectedRoomId} sessionAction={sessionAction} onSelectRoom={onSelectRoom} onJoinRoom={onJoinRoom} />;
}
