import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createTurnRoutes } from './turn.js';
import { createTurnGrant, type TurnGrant } from '../services/turnGrants.js';
import { verifyTurnCapability, type TurnCapability } from '../services/turnCapabilities.js';

let app: FastifyInstance | null = null;

const secret = 'room-capability-secret-with-at-least-32-bytes';
function createTurnCapability(payload: TurnCapability, signingSecret = secret): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

const capabilityPayload: TurnCapability = {
  v: 1,
  aud: 'dotify-turn',
  roomId: 'ABC234',
  participantId: 'socket-1',
  role: 'listener',
  iat: 1_785_891_540,
  exp: 1_785_891_720
};
const capability = createTurnCapability(capabilityPayload);

async function buildApp(createGrant: (subject: string) => TurnGrant | null = () => null): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(
    createTurnRoutes({
      capabilityConfigured: true,
      createGrant,
      verifyCapability: token => verifyTurnCapability(token, secret, new Date('2026-08-05T01:00:00.000Z'))
    }),
    { prefix: '/api/turn' }
  );
  return app;
}

const authorizedRequest = { method: 'GET' as const, url: '/api/turn/grant', headers: { authorization: `Bearer ${capability}` } };

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('GET /api/turn/grant', () => {
  it('returns a short-lived TURN REST credential without leaking the shared secret', async () => {
    const secret = 'server-only-turn-secret';
    const server = await buildApp(subject => {
      assert.equal(subject, 'listener-ABC234-socket-1');
      return createTurnGrant({
        urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:443?transport=tcp'],
        restSecret: secret,
        ttlSeconds: 600,
        now: new Date('2026-08-05T01:00:00.000Z'),
        subject
      });
    });

    const response = await server.inject(authorizedRequest);

    assert.equal(response.statusCode, 200);
    assert.ok(!response.body.includes(secret), 'response must not leak TURN_REST_SECRET');
    const body = response.json();
    assert.equal(body.credentialMode, 'rest');
    assert.equal(body.ttlSeconds, 600);
    assert.equal(body.expiresAt, '2026-08-05T01:10:00.000Z');
    assert.deepEqual(body.iceServers[0].urls, ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:443?transport=tcp']);
    assert.equal(body.iceServers[0].username, '1785892200:listener-ABC234-socket-1');
    assert.equal(body.iceServers[0].credential, createHmac('sha1', secret).update(body.iceServers[0].username).digest('base64'));
  });

  it('can expose rotated static DevNet credentials when no REST secret is configured', async () => {
    const server = await buildApp(() =>
      createTurnGrant({
        urls: ['turn:turn.example.org:3478?transport=udp'],
        staticUsername: 'dotify-devnet',
        staticCredential: 'rotated-password',
        ttlSeconds: 300,
        now: new Date('2026-08-05T01:00:00.000Z')
      })
    );

    const response = await server.inject(authorizedRequest);

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.credentialMode, 'static');
    assert.equal(body.iceServers[0].username, 'dotify-devnet');
    assert.equal(body.iceServers[0].credential, 'rotated-password');
  });

  it('fails closed when the deployment has no TURN relay configured', async () => {
    const server = await buildApp();

    const response = await server.inject(authorizedRequest);

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'TURN_NOT_CONFIGURED');
  });

  it('rejects callers that have not joined or opened a room', async () => {
    const server = await buildApp(() => createTurnGrant({ urls: ['turn:turn.example.org:3478'], restSecret: 'turn-secret', ttlSeconds: 600 }));

    const missing = await server.inject({ method: 'GET', url: '/api/turn/grant' });
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.json().code, 'TURN_CAPABILITY_REQUIRED');

    const invalid = await server.inject({ method: 'GET', url: '/api/turn/grant', headers: { authorization: 'Bearer forged' } });
    assert.equal(invalid.statusCode, 403);
    assert.equal(invalid.json().code, 'TURN_CAPABILITY_INVALID');
  });

  it('rejects expired and overlong room capabilities before creating relay credentials', async () => {
    let grantCalls = 0;
    const server = await buildApp(() => {
      grantCalls += 1;
      return createTurnGrant({ urls: ['turn:turn.example.org:3478'], restSecret: 'turn-secret', ttlSeconds: 600 });
    });
    const expired = createTurnCapability({ ...capabilityPayload, iat: 1_785_891_000, exp: 1_785_891_500 });
    const overlong = createTurnCapability({ ...capabilityPayload, iat: 1_785_891_540, exp: 1_785_891_900 });

    for (const token of [expired, overlong]) {
      const response = await server.inject({ method: 'GET', url: '/api/turn/grant', headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, 'TURN_CAPABILITY_INVALID');
    }
    assert.equal(grantCalls, 0);
  });

  it('fails closed when room capability verification is not configured', async () => {
    app = Fastify();
    await app.register(createTurnRoutes({ capabilityConfigured: false, createGrant: () => null, verifyCapability: () => null }), { prefix: '/api/turn' });

    const response = await app.inject({ method: 'GET', url: '/api/turn/grant' });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'TURN_CAPABILITY_NOT_CONFIGURED');
  });
});
