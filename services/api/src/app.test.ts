import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { config } from './config.js';
import { buildApp } from './app.js';

let app: FastifyInstance | null = null;

async function build(): Promise<FastifyInstance> {
  app = await buildApp({ logging: false });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

it('rejects small but structurally oversized JSON before key schema parsing and authentication', async () => {
  const server = await build();
  assert.equal(server.initialConfig.bodyLimit, 1024 * 1024);
  const oversized = await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: { tracks: new Array(257).fill({}) } });
  assert.equal(oversized.statusCode, 413);
  assert.equal(oversized.json().code, 'BODY_STRUCTURE_TOO_LARGE');
  assert(!oversized.body.includes('issues'));
  // Ordinary input reaches the normal validator instead of the structural gate.
  const ordinary = await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: { tracks: new Array(5).fill({}) } });
  assert.equal(ordinary.statusCode, 400);
  assert.equal(typeof ordinary.json().error, 'string');
  assert(Array.isArray(ordinary.json().issues));
  assert.equal((await server.inject({ method: 'GET', url: '/health' })).statusCode, 200);
});

describe('request correlation IDs', () => {
  it('echoes a well-formed incoming x-request-id on the response', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'client-abc-123' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['x-request-id'], 'client-abc-123');
  });

  it('generates a fresh ID when the incoming header is missing or malformed', async () => {
    const server = await build();

    const missing = await server.inject({ method: 'GET', url: '/health' });
    assert.equal(typeof missing.headers['x-request-id'], 'string');
    assert.ok(String(missing.headers['x-request-id']).length > 0);

    const malformed = await server.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id with spaces \u0000' },
    });
    assert.notEqual(malformed.headers['x-request-id'], 'bad id with spaces \u0000');
    assert.ok(String(malformed.headers['x-request-id']).length > 0);
  });
});

describe('typed error envelope', () => {
  it('answers unknown routes with a typed NOT_FOUND body carrying the request ID', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: '/no/such/route',
      headers: { 'x-request-id': 'req-404-check' },
    });

    assert.equal(response.statusCode, 404);
    const body = response.json();
    assert.equal(body.code, 'NOT_FOUND');
    assert.equal(body.requestId, 'req-404-check');
    assert.equal(typeof body.error, 'string');
  });

  it('keeps framework error statuses instead of collapsing them to 500', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/session',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(typeof body.error, 'string');
    assert.equal(typeof body.code, 'string');
    assert.equal(typeof body.requestId, 'string');
  });
});

describe('rate-limit client key', () => {
  it('uses Fly-Client-IP only when the deployment trusts the Fly proxy', async () => {
    const { rateLimitKey } = await import('./app.js');
    const request = { ip: '172.16.0.2', headers: { 'fly-client-ip': '203.0.113.7' } };
    assert.equal(rateLimitKey(request, 'fly'), '203.0.113.7');
    assert.equal(rateLimitKey(request, 'off'), '172.16.0.2');
    assert.equal(rateLimitKey({ ip: '172.16.0.2', headers: {} }, 'fly'), '172.16.0.2');
  });

  it('gives each client behind the proxy its own budget', async () => {
    app = await buildApp({ logging: false, trustProxy: 'fly' });
    const statusFor = async (client: string) =>
      (await app!.inject({ method: 'GET', url: '/health', headers: { 'fly-client-ip': client } })).statusCode;
    for (let index = 0; index < 100; index += 1) assert.equal(await statusFor('198.51.100.1'), 200);
    assert.equal(await statusFor('198.51.100.1'), 429);
    assert.equal(await statusFor('198.51.100.2'), 200);
  });
});


describe('bounded proxy identity diagnostics', () => {
  it('samples only five trusted-header resolutions without logging addresses', async () => {
    const samples: unknown[] = [];
    app = await buildApp({ logging: false, trustProxy: 'fly', identityDiagnostic: fields => samples.push(fields) });
    await app.inject({ method: 'GET', url: '/health' }); // no trusted header
    for (let request = 0; request < 7; request += 1) {
      await app.inject({ method: 'GET', url: '/health', headers: { 'fly-client-ip': '198.51.100.8', 'x-forwarded-for': '203.0.113.9' } });
    }
    assert.equal(samples.length, 5);
    assert.deepEqual(samples[0], { event: 'network:client-identity', source: 'fly-client-ip', clientMatchesPeer: false });
    assert.ok(!JSON.stringify(samples).includes('198.51.100.8'));
    assert.ok(!JSON.stringify(samples).includes('203.0.113.9'));
  });

  it('does not sample forwarded headers when proxy trust is off', async () => {
    const samples: unknown[] = [];
    app = await buildApp({ logging: false, trustProxy: 'off', identityDiagnostic: fields => samples.push(fields) });
    await app.inject({ method: 'GET', url: '/health', headers: { 'fly-client-ip': '198.51.100.8' } });
    assert.deepEqual(samples, []);
  });
});


describe('Bulletin publisher activation boundary', () => {
  it('pauses every upload path before parsing or storage work on a combined instance', async () => {
    const previous = {
      API_ROLE: config.API_ROLE,
      ARTIST_PUBLICATION_MODE: config.ARTIST_PUBLICATION_MODE,
      STREAMING_AUDIO_STORAGE: config.STREAMING_AUDIO_STORAGE,
      PUBLIC_ASSET_STORAGE: config.PUBLIC_ASSET_STORAGE,
      STREAMING_WORKER_URL: config.STREAMING_WORKER_URL,
      STREAMING_WORKER_TOKEN: config.STREAMING_WORKER_TOKEN,
      BULLETIN_PUBLICATION_PROFILE: config.BULLETIN_PUBLICATION_PROFILE,
      CUSTODY_SERVICE_URL: config.CUSTODY_SERVICE_URL,
      CUSTODY_SERVICE_TOKEN: config.CUSTODY_SERVICE_TOKEN,
      UPLOAD_GLOBAL_CONCURRENCY: config.UPLOAD_GLOBAL_CONCURRENCY
    };
    try {
      Object.assign(config, {
        API_ROLE: 'combined',
        UPLOAD_GLOBAL_CONCURRENCY: 2,
        ARTIST_PUBLICATION_MODE: 'paused',
        STREAMING_AUDIO_STORAGE: 'bulletin',
        PUBLIC_ASSET_STORAGE: 'bulletin',
        // Both would fail initialization if the retired publisher were opened.
        STREAMING_WORKER_URL: 'https://encoder.example/invalid',
        STREAMING_WORKER_TOKEN: 'offline-test-worker-token'.repeat(2),
        BULLETIN_PUBLICATION_PROFILE: '/never-opened/retired-profile.json',
        CUSTODY_SERVICE_URL: 'http://127.0.0.1:1',
        CUSTODY_SERVICE_TOKEN: 'offline-test-custody-token'.repeat(2)
      });
      app = await buildApp({ logging: false, apiOrigins: ['https://dotify.example'] });
      const routes = [
        ['POST', '/authorize'],
        ['POST', '/audio'],
        ['POST', '/cover'],
        ['POST', '/metadata'],
        ['GET', '/audio/jobs/saved'],
        ['POST', '/audio/jobs/saved/retry'],
        ['POST', '/audio/jobs/saved/discard']
      ] as const;
      for (const [method, path] of routes) {
        const response: LightMyRequestResponse = await app!.inject({
          method,
          url: `/api/uploads${path}?source=old-draft`,
          headers: { origin: 'https://dotify.example', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
          // Invalid JSON proves the early refusal precedes body parsing.
          ...(method === 'POST' ? { payload: '{' } : {})
        });
        assert.equal(response.statusCode, 503, path);
        assert.equal(response.json().code, 'PUBLICATION_PAUSED');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers['access-control-allow-origin'], 'https://dotify.example');
        assert(!response.body.includes('retired-profile'));
      }
      assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
      assert.equal((await app.inject({ method: 'POST', url: '/api/uploads-other' })).statusCode, 404);
      {
        const payment = await app.inject({ method: 'GET', url: '/api/royalties/history' });
        assert.notEqual(payment.json().code, 'PUBLICATION_PAUSED');
      }
      {
        const key = await app.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: {} });
        assert.equal(key.statusCode, 400);
        assert.notEqual(key.json().code, 'PUBLICATION_PAUSED');
      }
      await app.close();
      app = null;
      // Restarting enabled must run the ordinary publisher preflight again.
      config.ARTIST_PUBLICATION_MODE = 'enabled';
      await assert.rejects(buildApp({ logging: false }), /Invalid isolated worker endpoint/);
    } finally {
      Object.assign(config, previous);
    }
  });

  it('rejects an invalid worker before opening publication custody or its signer', async () => {
    const previous = {
      API_ROLE: config.API_ROLE,
      NODE_ENV: config.NODE_ENV,
      STREAMING_AUDIO_STORAGE: config.STREAMING_AUDIO_STORAGE,
      STREAMING_WORKER_URL: config.STREAMING_WORKER_URL,
      STREAMING_WORKER_TOKEN: config.STREAMING_WORKER_TOKEN,
      BULLETIN_PUBLICATION_PROFILE: config.BULLETIN_PUBLICATION_PROFILE,
      UPLOAD_GLOBAL_CONCURRENCY: config.UPLOAD_GLOBAL_CONCURRENCY
    };
    try {
      config.API_ROLE = 'combined';
      config.NODE_ENV = 'test';
      config.STREAMING_AUDIO_STORAGE = 'bulletin';
      config.STREAMING_WORKER_URL = 'https://encoder.example/encode';
      config.STREAMING_WORKER_TOKEN = 'offline-test-worker-token'.repeat(2);
      config.UPLOAD_GLOBAL_CONCURRENCY = 2;
      // Deliberately absent: even reading this profile would fail the test.
      // Worker validation must precede all publisher acquisition/side effects.
      config.BULLETIN_PUBLICATION_PROFILE = '/never-opened/bulletin-profile.json';
      await assert.rejects(buildApp({ logging: false }), /Invalid isolated worker endpoint/);
    } finally {
      Object.assign(config, previous);
    }
  });

  it('rejects an edge writer, an incomplete configuration and an implicit provider switch before storage initialization', async () => {
    const previous = { API_ROLE: config.API_ROLE, STREAMING_AUDIO_STORAGE: config.STREAMING_AUDIO_STORAGE, BULLETIN_PUBLICATION_PROFILE: config.BULLETIN_PUBLICATION_PROFILE };
    try {
      config.STREAMING_AUDIO_STORAGE = 'bulletin';
      config.API_ROLE = 'edge';
      await assert.rejects(buildApp({ logging: false }), /private custody role/);
      config.API_ROLE = 'combined';
      await assert.rejects(buildApp({ logging: false }), /explicit profile and isolated worker/);
      config.STREAMING_AUDIO_STORAGE = 'pinata';
      config.BULLETIN_PUBLICATION_PROFILE = '/never-opened/profile.json';
      await assert.rejects(buildApp({ logging: false }), /Select Bulletin audio storage explicitly/);
    } finally { Object.assign(config, previous); }
  });
});
