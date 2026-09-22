import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([undefined, 'off', 'true', 'ON'])('keeps room experiments off for %s', async value => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: false });
});

it('requires an explicit opt-in for the galaxy experiment', async () => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', 'on');
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: true });
});
