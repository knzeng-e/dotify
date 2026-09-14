import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([undefined, 'off', 'true', 'ON'])('keeps room experiments off for %s', async value => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', value);
  vi.stubEnv('VITE_DOTIFY_HOST_LINEUP', value);
  vi.stubEnv('VITE_DOTIFY_NEARBY_PREVIEW', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: false, hostLineup: false, nearby: false });
});

it('requires an independent explicit opt-in for each experiment', async () => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', 'on');
  vi.stubEnv('VITE_DOTIFY_HOST_LINEUP', 'off');
  vi.stubEnv('VITE_DOTIFY_NEARBY_PREVIEW', 'on');
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: true, hostLineup: false, nearby: true });
});
