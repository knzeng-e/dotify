import { ChevronLeft, ChevronRight, Headphones, LocateFixed, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  WheelEvent as ReactWheelEvent
} from 'react';
import type {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Texture,
  WebGLRenderer
} from 'three';

import { CoverImage } from './CoverImage';
import { SkyOfRooms } from './SkyOfRooms';
import { roomConstellationPosition, shouldShowConstellationLabel } from '../features/rooms/roomConstellationLayout';
import { roomHostDisplayName, roomPresenceCount } from '../features/rooms/roomState';
import { getGatewayUrlsForAssetRef } from '../services/pinata';
import { auraForTrack } from '../shared/utils/aura';
import type { OpenRoom, SessionAction } from '../shared/types';

type RoomGalaxySceneProps = {
  rooms: OpenRoom[];
  selectedRoomId?: string;
  sessionAction: SessionAction;
  onSelectRoom?: (roomId: string) => void;
  onJoinRoom: (roomId: string) => void;
};

type ThreeModule = typeof import('three');
type SceneStatus = 'loading' | 'ready' | 'unsupported' | 'context-lost' | 'error';
type GalaxyControls = { theta: number; phi: number; distance: number; paused: boolean };
type DragState = { pointerId: number; startX: number; startY: number; theta: number; phi: number };
type GalaxyOverlay = { roomId: string; x: number; y: number; visible: boolean; depth: number };

type RoomRenderObject = {
  group: Group;
  core: Mesh<BufferGeometry, MeshStandardMaterial>;
  halo: Mesh<BufferGeometry, MeshBasicMaterial>;
  petals: Group;
  texture?: Texture;
  textureRef?: string;
  petalCount: number;
  disposed?: boolean;
};

type GalaxyRuntime = {
  THREE: ThreeModule;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  root: Group;
  roomObjects: Map<string, RoomRenderObject>;
  frameId: number;
  frameCount: number;
  hidden: boolean;
  resizeObserver?: ResizeObserver;
  syncRooms: (rooms: OpenRoom[], selectedRoomId?: string) => void;
  renderOnce: () => void;
  dispose: () => void;
};

type DotifyGalaxyQa = {
  snapshot: () => {
    status: SceneStatus;
    renderer: 'galaxy-3d';
    roomCount: number;
    visibleOverlayCount: number;
    frameCount: number;
    pixelRatio: number;
    paused: boolean;
  };
};

declare global {
  interface Window {
    __DOTIFY_ROOM_GALAXY__?: DotifyGalaxyQa;
  }
}

const JOIN_FLOOD_MS = 420;
const MIN_DISTANCE = 5.6;
const MAX_DISTANCE = 11.5;
const ZOOM_STEP = 0.6;
const DEFAULT_CONTROLS: GalaxyControls = { theta: -0.35, phi: 0.18, distance: 8.2, paused: false };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function hslToColor(THREE: ThreeModule, value: string) {
  const match = value.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) return new THREE.Color('#04e6a0');
  return new THREE.Color().setHSL(Number(match[1]) / 360, Number(match[2]) / 100, Number(match[3]) / 100);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(query).matches));

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

function updateControls(setControls: Dispatch<SetStateAction<GalaxyControls>>, patch: Partial<GalaxyControls>) {
  setControls(current => ({
    ...current,
    ...patch,
    phi: clamp(patch.phi ?? current.phi, -0.42, 0.52),
    distance: clamp(patch.distance ?? current.distance, MIN_DISTANCE, MAX_DISTANCE)
  }));
}

function disposeMaterial(material: Material | Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) item.dispose();
}

function disposeObject(object: Object3D) {
  object.traverse(child => {
    const mesh = child as Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) disposeMaterial(mesh.material);
  });
}

function disposeRoomObject(object: RoomRenderObject) {
  object.disposed = true;
  object.texture?.dispose();
  disposeObject(object.group);
}

function colorStyleForRoom(room: OpenRoom) {
  const aura = auraForTrack(room.track);
  return {
    '--dot-a': aura.a,
    '--dot-b': aura.b,
    '--dot-accent': aura.accent
  } as CSSProperties;
}

function createRoomObject(THREE: ThreeModule): RoomRenderObject {
  const group = new THREE.Group();
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: '#04e6a0',
    emissive: '#02131f',
    emissiveIntensity: 0.28,
    roughness: 0.52,
    metalness: 0.08
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: '#04e6a0',
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 20), coreMaterial);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 20), haloMaterial);
  const petals = new THREE.Group();

  halo.renderOrder = -1;
  group.add(halo);
  group.add(core);
  group.add(petals);

  return { group, core, halo, petals, petalCount: -1 };
}

function syncPetals(THREE: ThreeModule, object: RoomRenderObject, petalCount: number, accent: string) {
  if (object.petalCount === petalCount) {
    object.petals.children.forEach(child => {
      const mesh = child as Mesh<BufferGeometry, MeshBasicMaterial>;
      mesh.material.color.copy(hslToColor(THREE, accent));
    });
    return;
  }

  disposeObject(object.petals);
  object.petals.clear();
  object.petalCount = petalCount;

  for (let index = 0; index < petalCount; index += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 8),
      new THREE.MeshBasicMaterial({ color: hslToColor(THREE, accent), transparent: true, opacity: 0.92 })
    );
    const angle = (index / Math.max(petalCount, 1)) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.78, Math.sin(angle) * 0.16, Math.sin(angle) * 0.78);
    object.petals.add(petal);
  }
}

function loadCoverTexture(runtime: GalaxyRuntime, object: RoomRenderObject, room: OpenRoom) {
  const imageRef = room.track?.imageRef ?? '';
  if (!imageRef || object.textureRef === imageRef) return;

  object.texture?.dispose();
  object.texture = undefined;
  object.textureRef = imageRef;
  object.core.material.map = null;
  object.core.material.needsUpdate = true;

  const [url] = getGatewayUrlsForAssetRef(imageRef);
  if (!url) return;

  const loader = new runtime.THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  loader.load(
    url,
    texture => {
      if (object.disposed || object.textureRef !== imageRef) {
        texture.dispose();
        return;
      }
      texture.colorSpace = runtime.THREE.SRGBColorSpace;
      object.texture = texture;
      object.core.material.map = texture;
      object.core.material.needsUpdate = true;
    },
    undefined,
    () => {
      if (object.disposed || object.textureRef !== imageRef) return;
      object.texture = undefined;
      object.core.material.map = null;
      object.core.material.needsUpdate = true;
    }
  );
}

function createGalaxyRuntime(
  THREE: ThreeModule,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  controlsRef: MutableRefObject<GalaxyControls>,
  overlaysRef: MutableRefObject<GalaxyOverlay[]>,
  setOverlays: Dispatch<SetStateAction<GalaxyOverlay[]>>
): GalaxyRuntime {
  const preserveDrawingBuffer = import.meta.env.VITE_E2E_ROOM_JOIN === 'true';
  const contextAttributes: WebGLContextAttributes = { alpha: true, antialias: true, preserveDrawingBuffer };
  const context = (canvas.getContext('webgl2', contextAttributes) ?? canvas.getContext('webgl', contextAttributes)) as WebGLRenderingContext | null;
  if (!context) throw new Error('WebGL unavailable');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050d1a, 8, 15);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.AmbientLight(0xd9f6ff, 0.85));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(1.5, 4, 6);
  scene.add(keyLight);

  const runtime: GalaxyRuntime = {
    THREE,
    renderer,
    scene,
    camera,
    root,
    roomObjects: new Map<string, RoomRenderObject>(),
    frameId: 0,
    frameCount: 0,
    hidden: document.hidden,
    syncRooms(rooms: OpenRoom[], selectedRoomId?: string) {
      const nextIds = new Set(rooms.map(room => room.roomId));
      for (const [roomId, object] of runtime.roomObjects) {
        if (!nextIds.has(roomId)) {
          runtime.root.remove(object.group);
          disposeRoomObject(object);
          runtime.roomObjects.delete(roomId);
        }
      }

      rooms.forEach(room => {
        const layout = roomConstellationPosition(room.roomId);
        const aura = auraForTrack(room.track);
        const presence = roomPresenceCount(room.listenerCount, true);
        const isSelected = selectedRoomId === room.roomId;
        const isLive = room.playerState?.playing === true;
        const isFull = room.isFull === true;
        const scale = room.track ? Math.min(0.66 + presence * 0.035, 1.06) : 0.46;
        let object = runtime.roomObjects.get(room.roomId);

        if (!object) {
          object = createRoomObject(THREE);
          runtime.roomObjects.set(room.roomId, object);
          runtime.root.add(object.group);
        }

        object.group.position.set(layout.x3d, layout.y3d, layout.z3d);
        object.group.userData = { roomId: room.roomId, live: isLive, selected: isSelected, full: isFull, scale };
        object.core.scale.setScalar(scale);
        object.halo.scale.setScalar(scale * (isSelected ? 2.05 : isLive ? 1.82 : 1.54));
        object.core.material.color.copy(hslToColor(THREE, aura.a));
        object.core.material.emissive.copy(hslToColor(THREE, aura.b));
        object.core.material.emissiveIntensity = isLive ? 0.42 : 0.22;
        object.halo.material.color.copy(hslToColor(THREE, aura.accent));
        object.halo.material.opacity = isFull ? 0.08 : isSelected ? 0.3 : isLive ? 0.24 : 0.14;
        syncPetals(THREE, object, room.track ? Math.min(presence, 12) : 0, aura.accent);
        loadCoverTexture(runtime, object, room);
      });
    },
    renderOnce() {
      renderer.render(scene, camera);
    },
    dispose() {
      cancelAnimationFrame(runtime.frameId);
      runtime.resizeObserver?.disconnect();
      for (const object of runtime.roomObjects.values()) disposeRoomObject(object);
      runtime.roomObjects.clear();
      scene.clear();
      renderer.dispose();
    }
  };

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function projectOverlays() {
    const rect = container.getBoundingClientRect();
    const vector = new THREE.Vector3();
    const next: GalaxyOverlay[] = [];

    for (const [roomId, object] of runtime.roomObjects) {
      vector.copy(object.group.position);
      vector.project(camera);
      const visible = vector.z > -1 && vector.z < 1;
      next.push({
        roomId,
        x: ((vector.x + 1) / 2) * rect.width,
        y: ((-vector.y + 1) / 2) * rect.height,
        visible,
        depth: vector.z
      });
    }

    if (next.length > 0 && !next.some(overlay => overlay.visible)) {
      for (const overlay of next) {
        const fallback = roomConstellationPosition(overlay.roomId);
        overlay.x = (fallback.xPercent / 100) * rect.width;
        overlay.y = (fallback.yPercent / 100) * rect.height;
        overlay.visible = true;
        overlay.depth = 0;
      }
    }

    overlaysRef.current = next;
    setOverlays(next);
  }

  function animate(time: number) {
    runtime.frameId = window.requestAnimationFrame(animate);
    runtime.frameCount += 1;
    if (runtime.hidden) return;

    const controls = controlsRef.current;
    const distance = controls.distance;
    const cosPhi = Math.cos(controls.phi);
    camera.position.set(Math.sin(controls.theta) * distance * cosPhi, 2.1 + Math.sin(controls.phi) * distance, Math.cos(controls.theta) * distance * cosPhi);
    camera.lookAt(0, 0, 0);

    for (const object of runtime.roomObjects.values()) {
      const live = object.group.userData.live === true;
      const selected = object.group.userData.selected === true;
      const baseScale = Number(object.group.userData.scale ?? 1);
      const pulse = !controls.paused && live ? 1 + Math.sin(time / 520) * 0.055 : 1;
      object.core.scale.setScalar(baseScale * pulse);
      object.halo.scale.setScalar(baseScale * (selected ? 2.05 : live ? 1.82 + Math.sin(time / 760) * 0.08 : 1.54));
      if (!controls.paused) object.petals.rotation.y += live ? 0.012 : 0.004;
    }

    renderer.render(scene, camera);
    if (runtime.frameCount % 4 === 0) projectOverlays();
  }

  resize();
  runtime.resizeObserver = new ResizeObserver(resize);
  runtime.resizeObserver.observe(container);
  runtime.frameId = window.requestAnimationFrame(animate);

  return runtime;
}

export function RoomGalaxyScene({ rooms, selectedRoomId, sessionAction, onSelectRoom, onJoinRoom }: RoomGalaxySceneProps) {
  const compactOrReducedMotion = useMediaQuery('(max-width: 860px), (prefers-reduced-motion: reduce)');
  const [status, setStatus] = useState<SceneStatus>('loading');
  const [controls, setControls] = useState<GalaxyControls>(DEFAULT_CONTROLS);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<GalaxyOverlay[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<GalaxyRuntime | null>(null);
  const controlsRef = useRef(controls);
  const overlaysRef = useRef<GalaxyOverlay[]>([]);
  const roomsRef = useRef(rooms);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const dragRef = useRef<DragState | null>(null);
  const joinTimeoutRef = useRef<number | null>(null);
  const selectedRoomIndex = Math.max(
    0,
    rooms.findIndex(room => room.roomId === selectedRoomId)
  );
  const overlayByRoom = useMemo(() => new Map(overlays.map(overlay => [overlay.roomId, overlay])), [overlays]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    roomsRef.current = rooms;
    selectedRoomIdRef.current = selectedRoomId;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (compactOrReducedMotion) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    setStatus('loading');

    function handleContextLost(event: Event) {
      event.preventDefault();
      setStatus('context-lost');
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    }

    canvas.addEventListener('webglcontextlost', handleContextLost);

    void import('three')
      .then(THREE => {
        if (cancelled) return;
        const runtime = createGalaxyRuntime(THREE, canvas, container, controlsRef, overlaysRef, setOverlays);
        runtimeRef.current = runtime;
        runtime.syncRooms(roomsRef.current, selectedRoomIdRef.current);
        runtime.renderOnce();
        setStatus('ready');

        const handleVisibility = () => {
          runtime.hidden = document.hidden;
        };
        document.addEventListener('visibilitychange', handleVisibility);
        const originalDispose = runtime.dispose;
        runtime.dispose = () => {
          document.removeEventListener('visibilitychange', handleVisibility);
          originalDispose();
        };
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      delete window.__DOTIFY_ROOM_GALAXY__;
    };
  }, [compactOrReducedMotion]);

  useEffect(() => {
    runtimeRef.current?.syncRooms(rooms, selectedRoomId);
    runtimeRef.current?.renderOnce();
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    window.__DOTIFY_ROOM_GALAXY__ = {
      snapshot: () => ({
        status,
        renderer: 'galaxy-3d',
        roomCount: rooms.length,
        visibleOverlayCount: overlaysRef.current.filter(overlay => overlay.visible).length,
        frameCount: runtimeRef.current?.frameCount ?? 0,
        pixelRatio: runtimeRef.current?.renderer.getPixelRatio() ?? 0,
        paused: controlsRef.current.paused
      })
    };

    return () => {
      delete window.__DOTIFY_ROOM_GALAXY__;
    };
  }, [rooms.length, status]);

  useEffect(
    () => () => {
      if (joinTimeoutRef.current !== null) {
        window.clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    },
    []
  );

  const enterRoom = useCallback(
    (roomId: string) => {
      if (sessionAction !== 'idle' || joiningId) return;
      if (rooms.find(room => room.roomId === roomId)?.isFull) return;
      setJoiningId(roomId);
      joinTimeoutRef.current = window.setTimeout(() => {
        joinTimeoutRef.current = null;
        setJoiningId(null);
        onJoinRoom(roomId);
      }, JOIN_FLOOD_MS);
    },
    [joiningId, onJoinRoom, rooms, sessionAction]
  );

  const selectRoom = useCallback(
    (roomId: string) => {
      onSelectRoom?.(roomId);
    },
    [onSelectRoom]
  );

  const focusRoomAt = useCallback(
    (index: number) => {
      if (rooms.length === 0) return;
      const normalized = (index + rooms.length) % rooms.length;
      const room = rooms[normalized];
      if (!room) return;
      const position = roomConstellationPosition(room.roomId);
      selectRoom(room.roomId);
      updateControls(setControls, { theta: Math.atan2(position.x3d, position.z3d), phi: clamp(position.y3d / 7, -0.24, 0.24) });
    },
    [rooms, selectRoom]
  );

  function resetCamera() {
    setControls(DEFAULT_CONTROLS);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      theta: controlsRef.current.theta,
      phi: controlsRef.current.phi
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateControls(setControls, {
      theta: drag.theta - (event.clientX - drag.startX) * 0.006,
      phi: drag.phi + (event.clientY - drag.startY) * 0.004
    });
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    updateControls(setControls, { distance: controlsRef.current.distance + (event.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP) });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 0.3 : 0.16;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => updateControls(setControls, { theta: controlsRef.current.theta + step }),
      ArrowRight: () => updateControls(setControls, { theta: controlsRef.current.theta - step }),
      ArrowUp: () => updateControls(setControls, { phi: controlsRef.current.phi + step * 0.5 }),
      ArrowDown: () => updateControls(setControls, { phi: controlsRef.current.phi - step * 0.5 }),
      '+': () => updateControls(setControls, { distance: controlsRef.current.distance - ZOOM_STEP }),
      '=': () => updateControls(setControls, { distance: controlsRef.current.distance - ZOOM_STEP }),
      '-': () => updateControls(setControls, { distance: controlsRef.current.distance + ZOOM_STEP }),
      Home: resetCamera,
      '0': resetCamera
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  if (compactOrReducedMotion || status === 'unsupported' || status === 'context-lost' || status === 'error') {
    return <SkyOfRooms rooms={rooms} selectedRoomId={selectedRoomId} sessionAction={sessionAction} onSelectRoom={onSelectRoom} onJoinRoom={onJoinRoom} />;
  }

  return (
    <div
      className='room-galaxy'
      ref={containerRef}
      role='region'
      tabIndex={0}
      aria-label='3D galaxy of open rooms'
      data-status={status}
      data-testid='room-galaxy-scene'
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className='room-galaxy-canvas' data-testid='room-galaxy-canvas' aria-hidden='true' />
      {status === 'loading' && <div className='room-galaxy-status'>Loading room galaxy</div>}

      <div className='room-galaxy-overlays' aria-label='Room galaxy selection'>
        {rooms.map((room, index) => {
          const overlay = overlayByRoom.get(room.roomId);
          const presence = roomPresenceCount(room.listenerCount, true);
          const hostDisplayName = roomHostDisplayName(room.hostName);
          const selected = selectedRoomId === room.roomId;
          const full = room.isFull === true;
          const label = shouldShowConstellationLabel(room.roomId, rooms.length, selected);
          const markerStyle = {
            ...colorStyleForRoom(room),
            left: overlay ? `${overlay.x}px` : '50%',
            top: overlay ? `${overlay.y}px` : '50%',
            opacity: overlay?.visible === false ? 0 : 1,
            pointerEvents: overlay?.visible === false ? 'none' : 'auto',
            zIndex: overlay ? Math.round((1 - overlay.depth) * 100) : 1
          } as CSSProperties;

          return (
            <div className='room-galaxy-marker' key={room.roomId} data-selected={selected} data-label={label ? 'visible' : 'compact'} style={markerStyle}>
              <button
                className='room-galaxy-room'
                type='button'
                onClick={() => selectRoom(room.roomId)}
                onFocus={() => focusRoomAt(index)}
                aria-pressed={selected}
                aria-label={`Inspect room ${room.roomId}: ${room.track?.title ?? 'audio session'}${hostDisplayName ? ` with ${hostDisplayName}` : ''}, ${presence} listening`}
              >
                <span className='room-galaxy-cover' aria-hidden='true'>
                  {room.track?.imageRef ? <CoverImage src={room.track.imageRef} alt='' fallbackLabel={room.track.title} loading='lazy' /> : null}
                </span>
                <span className='room-galaxy-copy'>
                  <strong>{room.track?.title ?? 'Audio session'}</strong>
                  <span>
                    {hostDisplayName ? `${hostDisplayName} · ` : ''}
                    {presence} here
                    {full && ' - full'}
                  </span>
                </span>
              </button>
              <button
                className='room-galaxy-join'
                type='button'
                title={full ? 'Room full' : 'Join room'}
                aria-label={full ? `Room ${room.roomId} is full` : `Join room ${room.roomId}`}
                disabled={sessionAction !== 'idle' || full || joiningId === room.roomId}
                onClick={() => enterRoom(room.roomId)}
              >
                <Headphones size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {rooms.length > 1 && (
        <div className='room-galaxy-controls' aria-label='3D galaxy navigation controls'>
          <div className='sky-control-group'>
            <button type='button' onClick={() => focusRoomAt(selectedRoomIndex - 1)} aria-label='Center previous room'>
              <ChevronLeft size={16} />
            </button>
            <button type='button' onClick={() => focusRoomAt(selectedRoomIndex)} aria-label='Center selected room'>
              <LocateFixed size={16} />
            </button>
            <button type='button' onClick={() => focusRoomAt(selectedRoomIndex + 1)} aria-label='Center next room'>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className='sky-control-group'>
            <button
              type='button'
              onClick={() => updateControls(setControls, { distance: controls.distance + ZOOM_STEP })}
              disabled={controls.distance >= MAX_DISTANCE}
              aria-label='Zoom out'
            >
              <Minus size={16} />
            </button>
            <button
              type='button'
              onClick={() => updateControls(setControls, { distance: controls.distance - ZOOM_STEP })}
              disabled={controls.distance <= MIN_DISTANCE}
              aria-label='Zoom in'
            >
              <Plus size={16} />
            </button>
            <button
              type='button'
              onClick={() => updateControls(setControls, { paused: !controls.paused })}
              aria-label={controls.paused ? 'Resume room galaxy motion' : 'Pause room galaxy motion'}
            >
              {controls.paused ? <Play size={15} fill='currentColor' /> : <Pause size={15} />}
            </button>
            <button type='button' onClick={resetCamera} aria-label='Reset galaxy view'>
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
