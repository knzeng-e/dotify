import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createTurnRoutes } from './turn.js';
import { createTurnGrant, type TurnGrant } from '../services/turnGrants.js';

let app: FastifyInstance | null = null;

async function buildApp(createGrant: () => TurnGrant | null = () => null): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(createTurnRoutes({ createGrant }), { prefix: '/api/turn' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('GET /api/turn/grant', () => {
  it('returns a short-lived TURN REST credential without leaking the shared secret', async () => {
    const secret = 'server-only-turn-secret';
    const server = await buildApp(() =>
      createTurnGrant({
        urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:443?transport=tcp'],
        restSecret: secret,
        ttlSeconds: 600,
        now: new Date('2026-08-05T01:00:00.000Z'),
        subject: 'listener-1',
      }),
    );

    const response = await server.inject({ method: 'GET', url: '/api/turn/grant' });

    assert.equal(response.statusCode, 200);
    assert.ok(!response.body.includes(secret), 'response must not leak TURN_REST_SECRET');
    const body = response.json();
    assert.equal(body.credentialMode, 'rest');
    assert.equal(body.ttlSeconds, 600);
    assert.equal(body.expiresAt, '2026-08-05T01:10:00.000Z');
    assert.deepEqual(body.iceServers[0].urls, ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:443?transport=tcp']);
    assert.equal(body.iceServers[0].username, '1785892200:listener-1');
    assert.equal(body.iceServers[0].credential, createHmac('sha1', secret).update(body.iceServers[0].username).digest('base64'));
  });

  it('can expose rotated static DevNet credentials when no REST secret is configured', async () => {
    const server = await buildApp(() =>
      createTurnGrant({
        urls: ['turn:turn.example.org:3478?transport=udp'],
        staticUsername: 'dotify-devnet',
        staticCredential: 'rotated-password',
        ttlSeconds: 300,
        now: new Date('2026-08-05T01:00:00.000Z'),
      }),
    );

    const response = await server.inject({ method: 'GET', url: '/api/turn/grant' });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.credentialMode, 'static');
    assert.equal(body.iceServers[0].username, 'dotify-devnet');
    assert.equal(body.iceServers[0].credential, 'rotated-password');
  });

  it('fails closed when the deployment has no TURN relay configured', async () => {
    const server = await buildApp();

    const response = await server.inject({ method: 'GET', url: '/api/turn/grant' });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'TURN_NOT_CONFIGURED');
  });
});
