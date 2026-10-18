import { useState } from 'react';
import { EyeOff, Flag, MoreHorizontal } from 'lucide-react';
import { RoomScopeIcon } from './RoomScopeIcon';
import { ArtistPresenceBadge } from './ArtistPresenceBadge';
import { CoverImage } from './CoverImage';
import { discoveryPresenceLabel } from '../features/rooms/roomDiscoveryPresentation';
import type { NearbySession } from '../features/rooms/nearbySession';
import type { NearbyResult } from '../features/rooms/nearbyTypes';

type Props = {
  session: NearbySession | ((room: NearbyResult) => NearbySession);
  results: (NearbyResult & { scope?: 'nearby' | 'worldwide' })[];
  label: string;
  joining?: boolean;
  ownRoomId?: string;
  onOpenOwnRoom?: () => void;
  onJoin: (room: NearbyResult) => void;
  onHide?: (room: NearbyResult) => void;
  onInspect?: (room: NearbyResult) => void;
};

/** Discovered rooms with Join, plus Hide and Report for every public listing. */
export function DiscoveryRoomList({ session, results, label, joining, onJoin, onInspect, onHide, ownRoomId, onOpenOwnRoom }: Props) {
  const [reportId, setReportId] = useState<string | null>(null);
  return (
    <ul className='nearby-results' aria-label={label}>
      {results.map(room => (
        <li key={room.discoveryId} className='nearby-room' data-own={room.roomId === ownRoomId}>
          <span className='nearby-room-mark' aria-hidden='true'>
            <CoverImage src={room.imageRef ?? undefined} alt='' fallbackLabel={room.title} sizes='56px' />
          </span>
          <div className='nearby-room-copy'>
            <small>
              <RoomScopeIcon worldwide={room.scope === 'worldwide' || room.distanceBand === null} />
              {room.roomId === ownRoomId ? 'Your room' : `${room.hostName} hosts`} · {discoveryPresenceLabel(room)}
            </small>
            <h3>
              {onInspect ? (
                <button className='discovery-inspect' type='button' onClick={() => onInspect(room)}>
                  {room.roomName || room.title}
                </button>
              ) : (
                room.roomName || room.title
              )}
            </h3>
            <p>{room.roomName ? `${room.title} · ${room.artist}` : room.artist}</p>
            <div className='discovery-room-presence'>
              {room.artistPresent && <ArtistPresenceBadge />}
              {room.connection === 'reconnecting' && <span className='room-reconnecting'>Reconnecting</span>}
              <span className='discovery-distance'>
                {room.scope === 'worldwide' || room.distanceBand === null
                  ? 'Worldwide'
                  : room.distanceBand
                    ? `≈ ${room.distanceBand.replace(/\u2013/g, '-')}`
                    : 'Nearby'}
              </span>
            </div>
          </div>
          <button
            type='button'
            className='primary-action'
            disabled={joining || room.connection === 'reconnecting' || (room.isFull && room.roomId !== ownRoomId)}
            onClick={() => (room.roomId === ownRoomId && onOpenOwnRoom ? onOpenOwnRoom() : onJoin(room))}
          >
            {room.connection === 'reconnecting' ? 'Reconnecting' : room.roomId === ownRoomId ? 'Open' : room.isFull ? 'Full' : 'Join'}
          </button>
          {room.roomId !== ownRoomId && (
            <details className='nearby-room-actions'>
              <summary aria-label={`Options for ${room.title}`} title='Room options'>
                <MoreHorizontal size={19} aria-hidden='true' />
              </summary>
              <div className='nearby-room-menu'>
                <button
                  type='button'
                  className='text-action'
                  onClick={() =>
                    onHide ? onHide(room) : (typeof session === 'function' ? session(room) : session).hide(room.roomId, room.roomName || room.title)
                  }
                >
                  <EyeOff size={15} aria-hidden='true' />
                  Hide
                </button>
                <button
                  type='button'
                  className='text-action'
                  aria-expanded={reportId === room.discoveryId}
                  onClick={() => setReportId(reportId === room.discoveryId ? null : room.discoveryId)}
                >
                  <Flag size={15} aria-hidden='true' />
                  Report
                </button>
              </div>
            </details>
          )}
          {reportId === room.discoveryId && (
            <div className='nearby-report'>
              <p>This hides the room for you and adds an anonymous safety count. No moderator is notified. You can show the room again in Hidden rooms.</p>
              {(['unwanted', 'misleading', 'offensive'] as const).map(reason => (
                <button
                  className='secondary-action'
                  type='button'
                  key={reason}
                  onClick={() => {
                    setReportId(null);
                    onHide?.(room);
                    void (typeof session === 'function' ? session(room) : session).report(room, reason);
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
