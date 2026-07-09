import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createKeyRoutes, type KeyRouteDeps } from './keys.js';

const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const REQUESTER = '0x1111111111111111111111111111111111111111';
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const KEY = `0x${'cd'.repeat(32)}` as const;

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    requester: REQUESTER,
    signature: `0x${'11'.repeat(65)}`,
    nonce: 'a'.repeat(48),
    chainId: 420420417,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    purpose: 'individual',
    ...overrides
  };
}

const SESSION_ADDRESS = '0x3333333333333333333333333333333333333333' as const;

const allowAll: KeyRouteDeps = {
  verifySignedRequest: async () => ({ valid: true }),
  verifySessionToken: () => ({ valid: true, address: SESSION_ADDRESS, chainId: 420420417, jti: 'jti-1' }),
  checkTrackAccess: async () => ({ allowed: true, runtime: RUNTIME }),
  checkPublicAccess: async () => ({ allowed: true, runtime: RUNTIME }),
  deriveContentKey: () => ({ ok: true, contentKey: KEY })
};

let app: FastifyInstance | null = null;

async function buildApp(deps: Partial<KeyRouteDeps> = {}): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(createKeyRoutes({ ...allowAll, ...deps }), { prefix: '/api/tracks' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('POST /api/tracks/:contentHash/key-request', () => {
  it('delivers the content key when signature and on-chain access pass', async () => {
    const server = await buildApp();
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody()
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'allowed');
    assert.equal(body.playbackMode, 'full');
    assert.equal(body.contentKey, KEY);
    assert.equal(body.runtime, RUNTIME);
  });

  it('rejects room_listener purpose at the schema boundary', async () => {
    const server = await buildApp();
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({ purpose: 'room_listener' })
    });

    assert.equal(response.statusCode, 400);
  });

  it('returns 401 with the verification code on an invalid signature', async () => {
    const server = await buildApp({
      verifySignedRequest: async () => ({ valid: false, code: 'SIGNATURE_INVALID', reason: 'bad signature' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody()
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'SIGNATURE_INVALID');
  });

  it('answers a denied individual listener with an unlock CTA, never a key or a preview mode', async () => {
    const server = await buildApp({
      checkTrackAccess: async () => ({ allowed: false, code: 'LISTENER_ACCESS_REQUIRED', reason: 'no access' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody()
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'denied');
    // Access model v2: the 42% preview framing is retired from denials.
    assert.equal(body.playbackMode, undefined);
    assert.equal(body.previewRatio, undefined);
    assert.equal(body.reason, 'LISTENER_ACCESS_REQUIRED');
    assert.equal(body.hostAction.type, 'unlock');
    assert.equal(body.contentKey, undefined);
  });

  it('answers an unauthorized room host with an unlock CTA, not a hard failure', async () => {
    const server = await buildApp({
      checkTrackAccess: async () => ({ allowed: false, code: 'HOST_ACCESS_REQUIRED', reason: 'host lacks access' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({ purpose: 'room_host' })
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'denied');
    assert.equal(body.reason, 'HOST_ACCESS_REQUIRED');
    assert.equal(body.hostAction.type, 'unlock');
    assert.equal(body.hostAction.label, 'Unlock full stream');
    assert.equal(body.contentKey, undefined);
  });

  it('fails closed when the chain RPC is unavailable', async () => {
    const server = await buildApp({
      checkTrackAccess: async () => ({ allowed: false, code: 'RPC_UNAVAILABLE', reason: 'rpc down' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody()
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'denied');
    assert.equal(body.reason, 'RPC_UNAVAILABLE');
    assert.equal(body.hostAction.type, 'none');
    assert.equal(body.contentKey, undefined);
  });

  it('returns 503 when the key vault is not configured', async () => {
    const server = await buildApp({
      deriveContentKey: () => ({ ok: false, code: 'KEY_SERVICE_NOT_CONFIGURED', reason: 'no master secret' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody()
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'KEY_SERVICE_NOT_CONFIGURED');
  });
});

describe('POST /api/tracks/:contentHash/key-request (session token path)', () => {
  it('delivers the key for a valid session without any signature', async () => {
    let checkedRequester = '';
    const server = await buildApp({
      checkTrackAccess: async request => {
        checkedRequester = request.requester;
        return { allowed: true, runtime: RUNTIME };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: { sessionToken: 'a'.repeat(32), purpose: 'individual' }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'allowed');
    assert.equal(body.contentKey, KEY);
    // The on-chain check ran against the token's address, not client input.
    assert.equal(checkedRequester, SESSION_ADDRESS);
  });

  it('rejects an invalid or expired session with 401 and its code', async () => {
    const server = await buildApp({
      verifySessionToken: () => ({ valid: false, code: 'SESSION_EXPIRED', reason: 'Session has expired. Sign in again.' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: { sessionToken: 'a'.repeat(32), purpose: 'individual' }
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'SESSION_EXPIRED');
  });

  it('still answers a denied session-based request with the unlock CTA, never a key', async () => {
    const server = await buildApp({
      checkTrackAccess: async () => ({ allowed: false, code: 'LISTENER_ACCESS_REQUIRED', reason: 'no access' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: { sessionToken: 'a'.repeat(32), purpose: 'individual' }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'denied');
    assert.equal(body.contentKey, undefined);
  });
});

describe('POST /api/tracks/:contentHash/free-key', () => {
  it('delivers the key for a Free track with no signature and no requester', async () => {
    const server = await buildApp();
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/free-key`,
      payload: {}
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'allowed');
    assert.equal(body.contentKey, KEY);
    assert.equal(body.runtime, RUNTIME);
  });

  it('refuses a non-free track: denial, no key, and the signed route stays the only path', async () => {
    const server = await buildApp({
      checkPublicAccess: async () => ({ allowed: false, code: 'NOT_FREE', reason: 'policy requires payment' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/free-key`,
      payload: {}
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.access, 'denied');
    assert.equal(body.reason, 'NOT_FREE');
    assert.equal(body.contentKey, undefined);
  });

  it('fails closed when the chain RPC is unavailable', async () => {
    const server = await buildApp({
      checkPublicAccess: async () => ({ allowed: false, code: 'RPC_UNAVAILABLE', reason: 'rpc down' })
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/free-key`,
      payload: {}
    });

    assert.equal(response.json().access, 'denied');
    assert.equal(response.json().reason, 'RPC_UNAVAILABLE');
  });

  it('rejects an invalid content hash at the schema boundary', async () => {
    const server = await buildApp();
    const response = await server.inject({
      method: 'POST',
      url: '/api/tracks/not-a-hash/free-key',
      payload: {}
    });

    assert.equal(response.statusCode, 400);
  });
});
