import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuthRoutes, type AuthRouteDeps } from './auth.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';

function sessionBody(overrides: Record<string, unknown> = {}) {
  return {
    address: ADDRESS,
    signature: `0x${'11'.repeat(65)}`,
    nonce: 'a'.repeat(48),
    chainId: 420420417,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides
  };
}

const happyDeps: AuthRouteDeps = {
  verifySignInRequest: async () => ({ valid: true }),
  isSessionAuthConfigured: () => true,
  issueSessionToken: () => ({ ok: true, token: 'payload.signature', expiresAt: new Date(Date.now() + 1000).toISOString() }),
  revokeSessionToken: () => true
};

let app: FastifyInstance | null = null;

async function buildApp(deps: Partial<AuthRouteDeps> = {}): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(createAuthRoutes({ ...happyDeps, ...deps }), { prefix: '/api/auth' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('GET /api/auth/session', () => {
  it('advertises session auth before the client prompts for SIGN_IN', async () => {
    const server = await buildApp();
    const response = await server.inject({ method: 'GET', url: '/api/auth/session' });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().available, true);
  });

  it('returns 503 when sessions are unavailable so clients can fall back unsigned', async () => {
    const server = await buildApp({ isSessionAuthConfigured: () => false });
    const response = await server.inject({ method: 'GET', url: '/api/auth/session' });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'SESSION_NOT_CONFIGURED');
  });
});

describe('POST /api/auth/nonce', () => {
  it('rejects a challenge request for a different chain', async () => {
    const server = await buildApp();
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/nonce',
      payload: { address: ADDRESS, chainId: 420420418 }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'CHAIN_ID_MISMATCH');
    assert.match(response.json().error, /wrong network/i);
  });
});

describe('POST /api/auth/session', () => {
  it('exchanges a valid sign-in signature for a session token', async () => {
    const server = await buildApp();
    const response = await server.inject({ method: 'POST', url: '/api/auth/session', payload: sessionBody() });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.sessionToken, 'payload.signature');
    assert.equal(body.address, ADDRESS);
  });

  it('rejects an invalid signature with 401 and the verification code', async () => {
    const server = await buildApp({
      verifySignInRequest: async () => ({ valid: false, code: 'SIGNATURE_INVALID', reason: 'bad signature' })
    });
    const response = await server.inject({ method: 'POST', url: '/api/auth/session', payload: sessionBody() });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'SIGNATURE_INVALID');
  });

  it('returns 503 when session auth is not configured (per-request signing still works)', async () => {
    const server = await buildApp({
      issueSessionToken: () => ({ ok: false, code: 'SESSION_NOT_CONFIGURED', reason: 'no master secret' })
    });
    const response = await server.inject({ method: 'POST', url: '/api/auth/session', payload: sessionBody() });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'SESSION_NOT_CONFIGURED');
  });

  it('rejects a malformed body at the schema boundary', async () => {
    const server = await buildApp();
    const response = await server.inject({ method: 'POST', url: '/api/auth/session', payload: sessionBody({ address: 'not-an-address' }) });
    assert.equal(response.statusCode, 400);
  });

  it('rejects a different-chain sign-in before verification or token issuance', async () => {
    let verificationCalled = false;
    let issuanceCalled = false;
    const server = await buildApp({
      verifySignInRequest: async () => {
        verificationCalled = true;
        return { valid: true };
      },
      issueSessionToken: () => {
        issuanceCalled = true;
        return { ok: true, token: 'payload.signature', expiresAt: new Date(Date.now() + 1000).toISOString() };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: '/api/auth/session',
      payload: sessionBody({ chainId: 420420418 })
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'CHAIN_ID_MISMATCH');
    assert.equal(verificationCalled, false);
    assert.equal(issuanceCalled, false);
  });
});

describe('POST /api/auth/logout', () => {
  it('is idempotent: ok whether or not the token was live', async () => {
    const server = await buildApp({ revokeSessionToken: () => false });
    const response = await server.inject({ method: 'POST', url: '/api/auth/logout', payload: { sessionToken: 'a'.repeat(32) } });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);
  });
});
