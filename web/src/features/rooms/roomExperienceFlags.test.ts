import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each(['off', 'true', 'ON', ''])('disables Nearby for an explicit off or invalid setting (%s)', async value => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', value);
  vi.stubEnv('VITE_DOTIFY_NEARBY', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: false, nearby: false });
});

it.each([undefined, 'on'])('includes Nearby and the optional 3D choice by default (%s)', async value => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', undefined);
  vi.stubEnv('VITE_DOTIFY_NEARBY', value);
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: true, nearby: true });
});

it('retains explicit on for the optional 3D choice', async () => {
  vi.stubEnv('VITE_DOTIFY_ROOM_GALAXY', 'on');
  vi.stubEnv('VITE_DOTIFY_NEARBY', 'on');
  const { roomExperienceFlags } = await import('./roomExperienceFlags');
  expect(roomExperienceFlags).toEqual({ galaxy: true, nearby: true });
});
