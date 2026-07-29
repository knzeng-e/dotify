import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

let app: FastifyInstance | null = null;

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('frontend origin boundary', () => {
  it('allows each configured Dotify frontend and rejects unrelated origins', async () => {
    app = await buildApp({
      logging: false,
      apiOrigins: ['https://muzinga.netlify.app', 'https://dotify-test01.dev-dot.li'],
    });
    const server = app;

    for (const origin of ['https://muzinga.netlify.app', 'https://dotify-test01.dev-dot.li']) {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
        headers: { origin },
      });
      assert.equal(response.headers['access-control-allow-origin'], origin);
    }

    const unrelated = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://unrelated.example' },
    });
    assert.equal(unrelated.headers['access-control-allow-origin'], undefined);
  });

  it('allows the Product host container origin, which uses a custom scheme', async () => {
    // Inside the Product host the app is served from polkadot://, not the DotNS
    // web gateway. Without this the container gets rooms but no content keys.
    const hostOrigin = 'polkadot://app.dotify-test01.dot';
    app = await buildApp({ logging: false, apiOrigins: [hostOrigin] });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: hostOrigin },
    });

    assert.equal(response.headers['access-control-allow-origin'], hostOrigin);
  });

  it('refuses a null origin even when a custom-scheme origin is allowed', async () => {
    // `polkadot:` is a non-special scheme, so browsers may send `Origin: null`.
    // Answering that would admit every sandboxed iframe and file:// page to the
    // authenticated upload and content-key routes, so it must stay refused
    // until the real header is observed and allowlisted deliberately.
    app = await buildApp({ logging: false, apiOrigins: ['polkadot://app.dotify-test01.dot'] });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'null' },
    });

    assert.equal(response.headers['access-control-allow-origin'], undefined);
  });
});
