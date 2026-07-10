// The Sky of rooms (Constellation phase B) - open rooms as dot-spheres in the
// navy sky. The core is the current track's cover, the halo is its real aura,
// the halo pulses only when the host's playback is actually live
// (room.playerState.playing), and one light petal orbits per genuinely
// connected presence. Joining a room is entering its halo: the sphere grows
// and floods before the join fires. DOM + CSS only: room counts are small, so
// a WebGL canvas would be weight without benefit (bundle discipline for the
// single-file Bulletin build). Spec: docs/design/dotify-constellation-ux.md
// (surface B).
//
// Honesty rule: every visible thing maps to real data. Sphere size and petal
// count come from the real presence count, the pulse from the broadcast player
// state, the "preview" tag from the real playbackMode, and embers are rooms
// with genuinely no track loaded. The visual petal count caps at 10; the true
// count is always printed on the label.
//
// Fallback: on mobile and prefers-reduced-motion the sky is hidden entirely
// (CSS) and the existing room card grid below remains the full experience.

import { useState } from 'react';
import { CoverImage } from './CoverImage';
import { auraForTrack, hashHue } from '../shared/utils/aura';
import { roomPresenceCount } from '../features/rooms/roomState';
import type { OpenRoom, SessionAction } from '../shared/types';

type SkyOfRoomsProps = {
  rooms: OpenRoom[];
  sessionAction: SessionAction;
  onJoinRoom: (roomId: string) => void;
};

const GOLDEN_ANGLE = 137.508;
const MAX_VISIBLE_PETALS = 10;
const JOIN_FLOOD_MS = 420;

// Deterministic constellation layout: a golden-angle spiral by index, with a
// small jitter hashed from the roomId so the sky never looks mechanical while
// staying stable for a given set of rooms.
function dotPosition(index: number, total: number, roomId: string) {
  const jitter = hashHue(roomId);
  const angle = ((index * GOLDEN_ANGLE + (jitter % 21) - 10) * Math.PI) / 180;
  const spread = total <= 1 ? 0 : Math.sqrt(index / (total - 1));
  const radius = spread * (34 + (jitter % 7)); // percent of container half-size
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius * 0.82}%`
  };
}

export function SkyOfRooms({ rooms, sessionAction, onJoinRoom }: SkyOfRoomsProps) {
  const [joiningId, setJoiningId] = useState<string | null>(null);

  if (rooms.length === 0) return null;

  function enterRoom(roomId: string) {
    if (sessionAction !== 'idle' || joiningId) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onJoinRoom(roomId);
      return;
    }
    setJoiningId(roomId);
    window.setTimeout(() => {
      setJoiningId(null);
      onJoinRoom(roomId);
    }, JOIN_FLOOD_MS);
  }

  return (
    <div className='sky' aria-label='Open rooms as a constellation' data-testid='sky-of-rooms'>
      {rooms.map((room, index) => {
        const presence = roomPresenceCount(room.listenerCount, true);
        const aura = auraForTrack(room.track);
        const ember = !room.track;
        const live = room.playerState?.playing === true;
        const size = ember ? 44 : Math.min(72 + presence * 7, 132);
        const petals = ember ? 0 : Math.min(presence, MAX_VISIBLE_PETALS);
        const orbitSeconds = 16 + (hashHue(room.roomId) % 9);
        return (
          <button
            className='sky-dot'
            type='button'
            key={room.roomId}
            data-ember={ember}
            data-live={live}
            data-joining={joiningId === room.roomId}
            data-testid='sky-dot'
            disabled={sessionAction !== 'idle'}
            style={
              {
                ...dotPosition(index, rooms.length, room.roomId),
                '--dot-size': `${size}px`,
                '--dot-a': aura.a,
                '--dot-b': aura.b,
                '--dot-accent': aura.accent
              } as React.CSSProperties
            }
            aria-label={`Enter room ${room.roomId}: ${room.track?.title ?? 'audio session'} with ${room.hostName}, ${presence} listening`}
            onClick={() => enterRoom(room.roomId)}
          >
            <span className='sky-halo' aria-hidden='true' />
            <span className='sky-core' aria-hidden='true'>
              {room.track?.imageRef && <CoverImage src={room.track.imageRef} alt='' loading='lazy' />}
            </span>
            {petals > 0 && (
              <span className='sky-orbit' aria-hidden='true' style={{ animationDuration: `${orbitSeconds}s` }}>
                {Array.from({ length: petals }, (_, petal) => (
                  <i key={petal} style={{ transform: `rotate(${(petal * 360) / petals}deg) translateX(calc(var(--dot-size) / 2 + 14px))` }} />
                ))}
              </span>
            )}
            <span className='sky-label'>
              <strong>{room.track?.title ?? 'Audio session'}</strong>
              <span>
                {room.hostName} - {presence} listening
                {room.playbackMode === 'preview' && <em> preview</em>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
