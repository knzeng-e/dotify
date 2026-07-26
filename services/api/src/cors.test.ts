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
      apiOrigins: ['https://muzinga.netlify.app', 'https://dotify.dev-dot.li'],
    });

    for (const origin of ['https://muzinga.netlify.app', 'https://dotify.dev-dot.li']) {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin },
      });
      assert.equal(response.headers['access-control-allow-origin'], origin);
    }

    const unrelated = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://unrelated.example' },
    });
    assert.equal(unrelated.headers['access-control-allow-origin'], undefined);
  });
});
