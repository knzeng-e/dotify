import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function fixture(enabled: boolean, search: string) {
  vi.resetModules();
  vi.stubEnv('VITE_E2E_ARTIST_PUBLISH', enabled ? 'true' : 'false');
  const location = { search };
  vi.stubGlobal('window', { location });
  const mock = await import('./artistPublishMock');
  return { location, requested: mock.isArtistPublishE2eScenarioRequested };
}

describe('explicit artist publishing fixture context', () => {
  it('survives the Room-to-Studio SPA navigation that removes its query', async () => {
    const context = await fixture(true, '?e2eRoom=public&e2eArtist=happy');
    expect(context.requested()).toBe(true);
    context.location.search = '';
    expect(context.requested()).toBe(true);
  });

  it('does not activate for another fixture or a persisted mock runtime', async () => {
    const context = await fixture(true, '?e2eRoom=public');
    Object.assign(window, { __DOTIFY_E2E_ARTIST_PUBLISH__: { runtimeCreated: true } });
    context.location.search = '';
    expect(context.requested()).toBe(false);
  });

  it('requires the build-time artist fixture flag even with an explicit query', async () => {
    const context = await fixture(false, '?e2eArtist=happy');
    expect(context.requested()).toBe(false);
    context.location.search = '';
    expect(context.requested()).toBe(false);
  });

  it('does not carry activation into a fresh document without the query', async () => {
    expect((await fixture(true, '?e2eArtist=happy')).requested()).toBe(true);
    expect((await fixture(true, '')).requested()).toBe(false);
  });
});
