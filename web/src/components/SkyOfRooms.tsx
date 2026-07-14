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
// The desktop sky is a navigable camera: drag, wheel/controls, keyboard pan,
// room-by-room centering, and reset. Mobile and prefers-reduced-motion hide it
// entirely; the room card grid below remains the complete experience.

import { ChevronLeft, ChevronRight, LocateFixed, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
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
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 1.72;
const ZOOM_STEP = 0.16;

type SkyCamera = { x: number; y: number; scale: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

// Deterministic constellation layout: a golden-angle spiral by index, with a
// small jitter hashed from the roomId so the sky never looks mechanical while
// staying stable for a given set of rooms.
function dotPosition(index: number, total: number, roomId: string) {
  const jitter = hashHue(roomId);
  const angle = ((index * GOLDEN_ANGLE + (jitter % 21) - 10) * Math.PI) / 180;
  const spread = total <= 1 ? 0 : Math.sqrt(index / (total - 1));
  const radius = spread * (34 + (jitter % 7)); // percent of container half-size
  return {
    // Default framing keeps the complete sphere + label visible. Zoom and pan
    // may crop it by choice, with Reset always restoring this safe overview.
    x: clamp(50 + Math.cos(angle) * radius, 16, 84),
    y: clamp(50 + Math.sin(angle) * radius * 0.72, 20, 68)
  };
}

export function SkyOfRooms({ rooms, sessionAction, onJoinRoom }: SkyOfRoomsProps) {
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [camera, setCamera] = useState<SkyCamera>({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const [centeredRoomId, setCenteredRoomId] = useState<string | null>(null);
  const skyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const roomLayouts = rooms.map((room, index) => dotPosition(index, rooms.length, room.roomId));
  const centeredRoomIndex = Math.max(
    0,
    rooms.findIndex(room => room.roomId === centeredRoomId)
  );

  useEffect(() => {
    if (centeredRoomId && !rooms.some(room => room.roomId === centeredRoomId)) {
      setCenteredRoomId(null);
      setCamera({ x: 0, y: 0, scale: 1 });
    }
  }, [centeredRoomId, rooms]);

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

  function cameraBounds() {
    const rect = skyRef.current?.getBoundingClientRect();
    return {
      x: (rect?.width ?? 800) * 0.68,
      y: (rect?.height ?? 400) * 0.68
    };
  }

  function panCamera(deltaX: number, deltaY: number) {
    const bounds = cameraBounds();
    setCenteredRoomId(null);
    setCamera(current => ({
      ...current,
      x: clamp(current.x + deltaX, -bounds.x, bounds.x),
      y: clamp(current.y + deltaY, -bounds.y, bounds.y)
    }));
  }

  function zoomCamera(delta: number) {
    setCamera(current => {
      const scale = clamp(current.scale + delta, MIN_ZOOM, MAX_ZOOM);
      const ratio = scale / current.scale;
      return { x: current.x * ratio, y: current.y * ratio, scale };
    });
  }

  function resetCamera() {
    setCenteredRoomId(null);
    setCamera({ x: 0, y: 0, scale: 1 });
  }

  function centerRoom(index: number) {
    if (rooms.length === 0) return;
    const normalizedIndex = (index + rooms.length) % rooms.length;
    const room = rooms[normalizedIndex];
    const layout = roomLayouts[normalizedIndex];
    const rect = skyRef.current?.getBoundingClientRect();
    if (!room || !layout || !rect) return;

    setCenteredRoomId(room.roomId);
    setCamera(current => {
      const scale = Math.max(current.scale, 1);
      return {
        x: -((layout.x - 50) / 100) * rect.width * scale,
        y: -((layout.y - 50) / 100) * rect.height * scale,
        scale
      };
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: camera.x,
      originY: camera.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = cameraBounds();
    setCenteredRoomId(null);
    setCamera(current => ({
      ...current,
      x: clamp(drag.originX + event.clientX - drag.startX, -bounds.x, bounds.x),
      y: clamp(drag.originY + event.clientY - drag.startY, -bounds.y, bounds.y)
    }));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - rect.width / 2;
    const pointerY = event.clientY - rect.top - rect.height / 2;

    setCenteredRoomId(null);
    setCamera(current => {
      const scale = clamp(current.scale + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), MIN_ZOOM, MAX_ZOOM);
      const contentX = (pointerX - current.x) / current.scale;
      const contentY = (pointerY - current.y) / current.scale;
      return {
        x: pointerX - contentX * scale,
        y: pointerY - contentY * scale,
        scale
      };
    });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const panStep = event.shiftKey ? 72 : 36;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panCamera(panStep, 0),
      ArrowRight: () => panCamera(-panStep, 0),
      ArrowUp: () => panCamera(0, panStep),
      ArrowDown: () => panCamera(0, -panStep),
      '+': () => zoomCamera(ZOOM_STEP),
      '=': () => zoomCamera(ZOOM_STEP),
      '-': () => zoomCamera(-ZOOM_STEP),
      '0': resetCamera,
      Home: resetCamera
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  return (
    <div
      className='sky'
      ref={skyRef}
      role='region'
      tabIndex={0}
      aria-label='Navigable galaxy of open rooms'
      aria-describedby='sky-navigation-help'
      data-dragging={dragging}
      data-testid='sky-of-rooms'
      onDoubleClick={resetCamera}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
    >
      <div
        className='sky-camera'
        style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}
        aria-hidden={joiningId ? 'true' : undefined}
      >
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
              data-centered={centeredRoomId === room.roomId}
              data-testid='sky-dot'
              disabled={sessionAction !== 'idle'}
              style={
                {
                  left: `${roomLayouts[index].x}%`,
                  top: `${roomLayouts[index].y}%`,
                  '--dot-size': `${size}px`,
                  '--dot-a': aura.a,
                  '--dot-b': aura.b,
                  '--dot-accent': aura.accent
                } as CSSProperties
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

      <div className='sky-navigation-note' id='sky-navigation-help'>
        <Move size={14} aria-hidden='true' />
        Drag to explore · scroll to zoom
      </div>

      <div className='sky-controls' aria-label='Galaxy navigation controls'>
        <div className='sky-control-group'>
          <button type='button' onClick={() => centerRoom(centeredRoomIndex - 1)} disabled={rooms.length < 2} aria-label='Center previous room'>
            <ChevronLeft size={16} />
          </button>
          <button type='button' onClick={() => centerRoom(centeredRoomIndex)} aria-label={`Center ${rooms[centeredRoomIndex]?.track?.title ?? 'current room'}`}>
            <LocateFixed size={16} />
          </button>
          <button type='button' onClick={() => centerRoom(centeredRoomIndex + 1)} disabled={rooms.length < 2} aria-label='Center next room'>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className='sky-control-group'>
          <button type='button' onClick={() => zoomCamera(-ZOOM_STEP)} disabled={camera.scale <= MIN_ZOOM} aria-label='Zoom out'>
            <Minus size={16} />
          </button>
          <output className='sky-zoom-level' aria-label='Galaxy zoom level'>
            {Math.round(camera.scale * 100)}%
          </output>
          <button type='button' onClick={() => zoomCamera(ZOOM_STEP)} disabled={camera.scale >= MAX_ZOOM} aria-label='Zoom in'>
            <Plus size={16} />
          </button>
          <button type='button' onClick={resetCamera} aria-label='Reset galaxy view'>
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      <span className='sr-only' aria-live='polite'>
        {centeredRoomId
          ? `Centered on ${rooms[centeredRoomIndex]?.track?.title ?? 'audio session'} hosted by ${rooms[centeredRoomIndex]?.hostName}`
          : 'Galaxy overview'}
      </span>
    </div>
  );
}
