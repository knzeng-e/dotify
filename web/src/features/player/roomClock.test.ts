import { expect, it } from 'vitest';
import { projectRoomClock } from './roomClock';

it('projects a host sample using monotonic receipt age, never cross-device wall time', () => {
  const sample = { playing: true, currentTime: 30, duration: 60, updatedAt: -999999999 };
  expect(projectRoomClock(sample, 750).state.currentTime).toBe(30.75);
  expect(projectRoomClock({ ...sample, updatedAt: 9999999999999 }, 750).state.currentTime).toBe(30.75);
});
it('holds paused position, including after a backward seek, while remote stream time advances', () => {
  const sample = { playing: false, currentTime: 12, duration: 60, updatedAt: 0 };
  expect(projectRoomClock(sample, 60_000)).toEqual({ state: sample, stale: false });
});
it('stops projecting and playing when host updates go stale, then accepts the next position', () => {
  const sample = { playing: true, currentTime: 30, duration: 60, updatedAt: 0 };
  expect(projectRoomClock(sample, 20_000)).toEqual({ state: { ...sample, playing: false, currentTime: 32.5 }, stale: true });
  expect(projectRoomClock({ ...sample, currentTime: 42 }, 0).state).toEqual({ ...sample, currentTime: 42 });
});
it('bounds end-of-track and invalid numeric values', () => {
  expect(projectRoomClock({ playing: true, currentTime: 59, duration: 60, updatedAt: 0 }, 2000).state.currentTime).toBe(60);
  expect(projectRoomClock({ playing: true, currentTime: NaN, duration: Infinity, updatedAt: 0 }, -100).state.currentTime).toBe(0);
  expect(projectRoomClock(null, 1000).state.playing).toBe(false);
});

it('keeps a stale join snapshot interrupted until a fresh host sample arrives', () => {
  const stale = { playing: false, currentTime: 32.5, duration: 60, updatedAt: 1, stale: true };
  expect(projectRoomClock(stale, 0)).toEqual({ state: stale, stale: true });
  expect(projectRoomClock(stale, 60_000)).toEqual({ state: stale, stale: true });
  const fresh = { playing: true, currentTime: 42, duration: 60, updatedAt: 2 };
  expect(projectRoomClock(fresh, 0)).toEqual({ state: fresh, stale: false });
  expect(projectRoomClock({ ...fresh, playing: false }, 60_000).stale).toBe(false);
});
