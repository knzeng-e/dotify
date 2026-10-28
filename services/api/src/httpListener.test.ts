import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { listenApi } from './httpListener.js';

test('one API listener accepts private IPv6 and public IPv4 HTTP requests', async () => {
  const app = Fastify();
  app.get('/health', async () => ({ status: 'ok' }));
  try {
    await listenApi(app, 0);
    const address = app.server.address();
    assert.ok(address && typeof address === 'object');
    for (const host of ['[::1]', '127.0.0.1']) {
      const response: Response = await fetch(`http://${host}:${address.port}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    }
  } finally {
    await app.close();
  }
});
