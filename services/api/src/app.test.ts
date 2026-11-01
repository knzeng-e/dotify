import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
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
