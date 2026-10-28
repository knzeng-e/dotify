import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each(['off', 'true', 'ON', ''])('disables Nearby for an explicit off or invalid setting (%s)', async value => {
  vi.stubEnv('VITE_DOTIFY_NEARBY', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ nearby: false });
});

it.each([undefined, 'on'])('includes Nearby by default (%s)', async value => {
  vi.stubEnv('VITE_DOTIFY_NEARBY', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ nearby: true });
});
