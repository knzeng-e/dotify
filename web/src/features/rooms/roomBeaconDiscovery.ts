import type { OpenRoom, TrackInfo } from '../../shared/types';
import type { RoomBeacon } from './roomBeacon';

function beaconTrack(beacon: RoomBeacon): TrackInfo | null {
  if (!beacon.title && !beacon.artist) return null;

  return {
    title: beacon.title || 'Live audio session',
    artist: beacon.artist || 'Live on Dotify',
    duration: 0,
    updatedAt: 0,
    bulletinRef: '',
    hash: ''
  };
}

/**
 * Adapt a globally readable room announcement to the existing discovery model.
 *
 * A beacon is intentionally sparse: it proves only that a recent host-signed
 * announcement exists. It does not prove that Socket.IO, WebRTC, or the audio
 * source is reachable, so transport-specific fields stay empty.
 */
export function roomBeaconToOpenRoom(beacon: RoomBeacon): OpenRoom {
  return {
    roomId: beacon.room,
    hostName: beacon.host,
    createdAt: 0,
    listenerCount: beacon.listenerCount,
    track: beaconTrack(beacon),
    playerState: null,
    discoverySource: 'statement-store'
  };
}

/**
 * Merge additive Product discovery with the signaling server's authoritative
 * room list. When both transports describe the same room, Socket.IO wins: it
 * owns capacity, playback, and join state while the Statement Store owns only
 * a short-lived announcement.
 */
export function mergeDiscoveredRooms(signalRooms: OpenRoom[], beaconRooms: OpenRoom[]): OpenRoom[] {
  const authoritativeIds = new Set(signalRooms.map(room => room.roomId.toUpperCase()));
  return [
    ...signalRooms.map(room => ({ ...room, discoverySource: 'signal' as const })),
    ...beaconRooms.filter(room => !authoritativeIds.has(room.roomId.toUpperCase()))
  ];
}
