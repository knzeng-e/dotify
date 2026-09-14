export type RoomConstellationPosition = {
  xPercent: number;
  yPercent: number;
  x3d: number;
  y3d: number;
  z3d: number;
  labelWeight: number;
};

const UINT32_MAX = 0xffffffff;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitHash(roomId: string, salt: string) {
  return hashString(`${roomId}:${salt}`) / UINT32_MAX;
}

/**
 * Stable room placement keyed only by room identity.
 *
 * The earlier sky used list index, which meant a new room could rearrange every
 * existing dot. W14 keeps both 2D and 3D renderers on this shared layout so
 * arrivals/departures do not rewrite the whole visual field.
 */
export function roomConstellationPosition(roomId: string): RoomConstellationPosition {
  const identity = roomId.trim() || 'room';
  const angle = unitHash(identity, 'angle') * Math.PI * 2;
  const ring = Math.floor(unitHash(identity, 'ring') * 4);
  const radius = 0.28 + ring * 0.15 + unitHash(identity, 'radius') * 0.13;
  const vertical = unitHash(identity, 'vertical') - 0.5;

  return {
    xPercent: clamp(50 + Math.cos(angle) * radius * 40, 15, 85),
    yPercent: clamp(48 + Math.sin(angle) * radius * 30, 19, 72),
    x3d: Math.cos(angle) * (1.45 + radius * 3.9),
    y3d: vertical * 1.8,
    z3d: Math.sin(angle) * (1.1 + radius * 3.4),
    labelWeight: unitHash(identity, 'label')
  };
}

export function shouldShowConstellationLabel(roomId: string, roomCount: number, isSelected: boolean) {
  if (isSelected || roomCount <= 8) return true;
  return roomConstellationPosition(roomId).labelWeight >= 0.62;
}
