import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { normalizeBaseUrl, redactUrl, runSignalingSmoke } from '../scripts/signaling-smoke.mjs';
import { startSignalingServer } from './signaling.mjs';

let server;

async function startServer(overrides = {}) {
  server = startSignalingServer({
    host: '127.0.0.1',
    logger: () => {},
    port: 0,
    ...overrides
  });
  const port = await server.listen();
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('signaling smoke check', () => {
  it('checks health and public status without mutating room state', async () => {
    const url = await startServer();
    const result = await runSignalingSmoke({ url, includeRoom: false, timeoutMs: 2_000 });

    assert.equal(result.health.ok, true);
    assert.equal(result.health.rooms, 0);
    assert.equal(result.status.rooms, 0);
    assert.equal(result.room, null);
  });

  it('checks allowed origin, denied origin, and a temporary room join flow', async () => {
    const url = await startServer({ origins: ['https://dotify.example'] });
    const result = await runSignalingSmoke({
      deniedOrigin: 'https://not-dotify.example',
      includeRoom: true,
      origin: 'https://dotify.example',
      timeoutMs: 2_000,
      url
    });

    assert.equal(result.cors.allowedOriginHeader, 'https://dotify.example');
    assert.equal(result.cors.deniedOriginHeader, null);
    assert.equal(result.cors.deniedSocketRejected, true);
    assert.equal(result.room.listenersNeedWalletAccess, false);
    assert.equal(result.room.playbackMode, 'full');
  });

  it('normalizes and redacts smoke endpoint URLs', () => {
    assert.equal(normalizeBaseUrl('https://dotify.example/signal/?token=secret#fragment'), 'https://dotify.example/signal');
    assert.equal(redactUrl('https://user:pass@dotify.example/signal?token=secret#fragment'), 'https://dotify.example/signal');
  });
});
