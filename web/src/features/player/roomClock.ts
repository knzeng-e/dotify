import type { PlayerState } from '../../shared/types';

// Host samples arrive roughly every 900ms. Interpolate only a short gap; never
// invent indefinite progress after signaling stops. Device wall clocks may differ.
export const ROOM_CLOCK_GRACE_MS = 2500;
export const EMPTY_ROOM_CLOCK: PlayerState = { currentTime: 0, duration: 0, playing: false, updatedAt: 0 };

export function projectRoomClock(sample: PlayerState | null, elapsedMs: number) {
  if (!sample) return { state: EMPTY_ROOM_CLOCK, stale: false };
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = Number.isFinite(sample.duration) ? Math.max(0, sample.duration) : 0;
  const position = Number.isFinite(sample.currentTime) ? Math.max(0, sample.currentTime) : 0;
  const currentTime = position + (sample.playing && !sample.stale ? Math.min(elapsed, ROOM_CLOCK_GRACE_MS) / 1000 : 0);
  const stale = sample.stale === true || (sample.playing && elapsed > ROOM_CLOCK_GRACE_MS);
  return {
    state: { ...sample, duration, currentTime: duration > 0 ? Math.min(duration, currentTime) : currentTime, playing: sample.playing && !stale },
    stale
  };
}
