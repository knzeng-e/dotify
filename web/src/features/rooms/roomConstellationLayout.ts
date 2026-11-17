export type RoomConstellationPosition = {
  xPercent: number;
  yPercent: number;
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
 * existing dot. Keep room placement independent of the current list so
 * arrivals/departures do not rewrite the whole visual field.
 */
export function roomConstellationPosition(roomId: string): RoomConstellationPosition {
  const identity = roomId.trim() || 'room';
  const angle = unitHash(identity, 'angle') * Math.PI * 2;
  const ring = Math.floor(unitHash(identity, 'ring') * 4);
  const radius = 0.28 + ring * 0.15 + unitHash(identity, 'radius') * 0.13;

  return {
    xPercent: clamp(50 + Math.cos(angle) * radius * 40, 15, 85),
    yPercent: clamp(48 + Math.sin(angle) * radius * 30, 19, 72)
  };
}
