import { useState } from 'react';
import { EyeOff, Flag, MoreHorizontal, Radio } from 'lucide-react';
import type { NearbySession } from '../features/rooms/nearbySession';
import type { NearbyResult } from '../features/rooms/nearbyTypes';

type Props = {
  session: NearbySession | ((room: NearbyResult) => NearbySession);
  results: NearbyResult[];
  label: string;
  joining?: boolean;
  onJoin: (room: NearbyResult) => void;
  onInspect?: (room: NearbyResult) => void;
};

/** Discovered rooms with Join, plus Hide and Report for every public listing. */
export function DiscoveryRoomList({ session, results, label, joining, onJoin, onInspect }: Props) {
  const [reportId, setReportId] = useState<string | null>(null);
  return (
    <ul className='nearby-results' aria-label={label}>
      {results.map(room => (
        <li key={room.discoveryId} className='nearby-room'>
          <span className='nearby-room-mark' aria-hidden='true'>
            <Radio size={23} />
          </span>
          <div className='nearby-room-copy'>
            <small>
              {room.hostName} hosts · {room.presence} here
            </small>
            <h3>
              {onInspect ? (
                <button className='discovery-inspect' type='button' onClick={() => onInspect(room)}>
                  {room.title}
                </button>
              ) : (
                room.title
              )}
            </h3>
            <p>{room.artist}</p>
            <span className='discovery-distance'>{room.distanceBand ? `≈ ${room.distanceBand}` : room.distanceBand === null ? 'Worldwide' : 'Nearby'}</span>
          </div>
          <button type='button' className='primary-action' disabled={joining || room.isFull} onClick={() => onJoin(room)}>
            {room.isFull ? 'Full' : 'Join'}
          </button>
          <details className='nearby-room-actions'>
            <summary aria-label={`Options for ${room.title}`} title='Room options'>
              <MoreHorizontal size={19} aria-hidden='true' />
            </summary>
            <div className='nearby-room-menu'>
              <button type='button' className='text-action' onClick={() => (typeof session === 'function' ? session(room) : session).hide(room.roomId)}>
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
          {reportId === room.discoveryId && (
            <div className='nearby-report'>
              <p>Hide this room and send a safety count. Reports do not open a moderation case.</p>
              {(['unwanted', 'misleading', 'offensive'] as const).map(reason => (
                <button
                  className='secondary-action'
                  type='button'
                  key={reason}
                  onClick={() => {
                    setReportId(null);
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
