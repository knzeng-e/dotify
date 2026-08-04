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
    const allowedOrigins = [
      'https://muzinga.netlify.app',
      'https://dotify-test01.dev-dot.li',
      'https://dotify-test01.app.dev-dot.li',
      'https://dotify-test01.app.dot.li',
      'https://dotify-test01.dot',
    ];
    app = await buildApp({
      logging: false,
      apiOrigins: allowedOrigins,
    });
    const server = app;

    for (const origin of allowedOrigins) {
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

  it('allows the native Product host origin when it uses the custom scheme', async () => {
    // Current browser-hosted Products can use app.dev-dot.li or the mobile
    // host's dot pseudo-domain, while native hosts may use this custom scheme.
    // Keep each exact origin tracked instead of widening to null.
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
