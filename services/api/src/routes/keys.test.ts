import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { rateLimitKey } from '../app.js';
import { createKeyRoutes, type KeyRouteDeps } from './keys.js';
import { PRODUCT_SR25519_SIGNATURE_SCHEME, type KeySignatureRequest } from '../services/signatures.js';
import type { CanonicalRelease } from '../services/chainAccess.js';
import { RELEASE_BOUND_CONTENT_KEY_VERSION, type ContentKeyDerivationScope } from '../services/keyVault.js';

const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const REQUESTER = '0x1111111111111111111111111111111111111111';
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const ARTIST = '0x4444444444444444444444444444444444444444' as const;
const KEY = `0x${'cd'.repeat(32)}` as const;
const RELEASE_ID = `${RUNTIME}:${CONTENT_HASH}`;
const AUDIO_REF = 'dotify:enc:v3:key-v2:ipfs://QmJDpB1CnV64v3wDSPCzu5UxfXJSabDGG4S6grpvcyoXGy';
const KEY_SCOPE: ContentKeyDerivationScope = {
  contentHash: CONTENT_HASH,
  keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
  chainId: 420420417,
  runtimeAddress: RUNTIME
};

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
  checkTrackAccess: async () => ({ allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE }),
  checkPublicAccess: async () => ({ allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE }),
  deriveContentKey: () => ({ ok: true, contentKey: KEY })
};

let app: FastifyInstance | null = null;

async function buildApp(deps: Partial<KeyRouteDeps> = {}, limited = false): Promise<FastifyInstance> {
  app = Fastify();
  if (limited) await app.register(rateLimit, { max: 100, timeWindow: '1 minute', keyGenerator: request => rateLimitKey(request, 'fly') });
  await app.register(createKeyRoutes({ ...allowAll, ...deps }), { prefix: '/api/tracks' });
  return app;
}

function releaseIdentity(): CanonicalRelease {
  return {
    releaseId: RELEASE_ID,
    contentHash: CONTENT_HASH as `0x${string}`,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    audioRef: AUDIO_REF,
    keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
    sourceBlock: 10
  };
}

function releaseRequestFields() {
  return {
    releaseId: RELEASE_ID,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    audioRef: AUDIO_REF,
    keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION
  };
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('POST /api/tracks/:contentHash/key-request', () => {
  it('delivers the content key when signature and on-chain access pass', async () => {
    let keyInput: unknown = null;
    const server = await buildApp({
      deriveContentKey: input => {
        keyInput = input;
        return { ok: true, contentKey: KEY };
      }
    });
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
    assert.deepEqual(keyInput, KEY_SCOPE);
  });

  it('passes canonical release identity through verification and access checks', async () => {
    let verifiedRequest: KeySignatureRequest | null = null;
    let accessRequest: unknown = null;
    const server = await buildApp({
      verifySignedRequest: async request => {
        verifiedRequest = request;
        return { valid: true };
      },
      checkTrackAccess: async request => {
        accessRequest = request;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody(releaseRequestFields())
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual((verifiedRequest as KeySignatureRequest | null)?.release, releaseRequestFields());
    assert.deepEqual((accessRequest as { release?: unknown }).release, releaseRequestFields());
  });

  it('rejects partial canonical release identity before verification or access checks', async () => {
    let verificationCalled = false;
    let accessChecked = false;
    const server = await buildApp({
      verifySignedRequest: async () => {
        verificationCalled = true;
        return { valid: true };
      },
      checkTrackAccess: async () => {
        accessChecked = true;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({ releaseId: RELEASE_ID })
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, 'Invalid release identity');
    assert.equal(verificationCalled, false);
    assert.equal(accessChecked, false);
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

  it('passes Product sr25519 proof fields to signature verification', async () => {
    let verifiedRequest: KeySignatureRequest | null = null;
    const server = await buildApp({
      verifySignedRequest: async request => {
        verifiedRequest = request;
        return { valid: true };
      }
    });
    const productPublicKey = `0x${'22'.repeat(32)}`;
    const signature = `0x${'33'.repeat(64)}`;
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({
        signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
        productPublicKey,
        signature
      })
    });

    assert.equal(response.statusCode, 200);
    const productRequest = verifiedRequest as Extract<KeySignatureRequest, { signatureScheme: typeof PRODUCT_SR25519_SIGNATURE_SCHEME }> | null;
    assert.ok(productRequest);
    assert.equal(productRequest.signatureScheme, PRODUCT_SR25519_SIGNATURE_SCHEME);
    assert.equal(productRequest.productPublicKey, productPublicKey);
    assert.equal(productRequest.signature, signature);
  });

  it('rejects unknown signature schemes before verification or access checks', async () => {
    let verificationCalled = false;
    let accessChecked = false;
    const server = await buildApp({
      verifySignedRequest: async () => {
        verificationCalled = true;
        return { valid: true };
      },
      checkTrackAccess: async () => {
        accessChecked = true;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({ signatureScheme: 'product-unknown-v1' })
    });

    assert.equal(response.statusCode, 400);
    assert.equal(verificationCalled, false);
    assert.equal(accessChecked, false);
  });

  it('forwards a MultiSignature-tagged Product signature to verification', async () => {
    // 65-byte tagged signatures are a legitimate Substrate signRaw shape; the
    // route must not reject them at the schema before the verifier can check
    // the tag.
    let verifiedRequest: KeySignatureRequest | null = null;
    const server = await buildApp({
      verifySignedRequest: async request => {
        verifiedRequest = request;
        return { valid: true };
      }
    });
    const signature = `0x01${'33'.repeat(64)}`;
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({
        signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
        productPublicKey: `0x${'22'.repeat(32)}`,
        signature
      })
    });

    assert.equal(response.statusCode, 200);
    assert.equal((verifiedRequest as KeySignatureRequest | null)?.signature, signature);
  });

  it('requires Product public key for Product sr25519 requests', async () => {
    let verificationCalled = false;
    const server = await buildApp({
      verifySignedRequest: async () => {
        verificationCalled = true;
        return { valid: true };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({
        signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
        signature: `0x${'33'.repeat(64)}`
      })
    });

    assert.equal(response.statusCode, 400);
    assert.equal(verificationCalled, false);
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

  it('rejects a signed request for a different chain before verification or access checks', async () => {
    let verificationCalled = false;
    let accessChecked = false;
    const server = await buildApp({
      verifySignedRequest: async () => {
        verificationCalled = true;
        return { valid: true };
      },
      checkTrackAccess: async () => {
        accessChecked = true;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: baseBody({ chainId: 420420418 })
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'CHAIN_ID_MISMATCH');
    assert.equal(verificationCalled, false);
    assert.equal(accessChecked, false);
  });
});

describe('POST /api/tracks/:contentHash/key-request (session token path)', () => {
  it('delivers the key for a valid session without any signature', async () => {
    let checkedRequester = '';
    const server = await buildApp({
      checkTrackAccess: async request => {
        checkedRequester = request.requester;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
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

  it('passes canonical release identity through session access checks', async () => {
    let accessRequest: unknown = null;
    const server = await buildApp({
      checkTrackAccess: async request => {
        accessRequest = request;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: { sessionToken: 'a'.repeat(32), purpose: 'individual', ...releaseRequestFields() }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual((accessRequest as { release?: unknown }).release, releaseRequestFields());
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

  it('rejects a session for a different chain before access checks or key derivation', async () => {
    let accessChecked = false;
    let keyDerived = false;
    const server = await buildApp({
      verifySessionToken: () => ({ valid: true, address: SESSION_ADDRESS, chainId: 420420418, jti: 'wrong-chain' }),
      checkTrackAccess: async () => {
        accessChecked = true;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      },
      deriveContentKey: () => {
        keyDerived = true;
        return { ok: true, contentKey: KEY };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/key-request`,
      payload: { sessionToken: 'a'.repeat(32), purpose: 'individual' }
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'CHAIN_ID_MISMATCH');
    assert.equal(accessChecked, false);
    assert.equal(keyDerived, false);
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

  it('passes canonical release identity through free-track access checks', async () => {
    let accessRequest: unknown = null;
    const server = await buildApp({
      checkPublicAccess: async request => {
        accessRequest = request;
        return { allowed: true, runtime: RUNTIME, release: releaseIdentity(), keyScope: KEY_SCOPE };
      }
    });
    const response = await server.inject({
      method: 'POST',
      url: `/api/tracks/${CONTENT_HASH}/free-key`,
      payload: releaseRequestFields()
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual((accessRequest as { release?: unknown }).release, releaseRequestFields());
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

describe('content-key response caching', () => {
  it('marks allowed, denied and invalid key responses as no-store', async () => {
    const allowed = await buildApp();
    const grant = await allowed.inject({ method: 'POST', url: `/api/tracks/${CONTENT_HASH}/free-key`, payload: {} });
    assert.equal(grant.statusCode, 200);
    assert.equal(grant.json().access, 'allowed');
    assert.equal(grant.headers['cache-control'], 'no-store');
    await allowed.close();

    const denied = await buildApp({
      checkPublicAccess: async () => ({ allowed: false, code: 'NOT_FREE', reason: 'This track is not free.' })
    });
    const denial = await denied.inject({ method: 'POST', url: `/api/tracks/${CONTENT_HASH}/free-key`, payload: {} });
    assert.equal(denial.json().access, 'denied');
    assert.equal(denial.headers['cache-control'], 'no-store');
    const invalid = await denied.inject({ method: 'POST', url: '/api/tracks/not-a-hash/key-request', payload: baseBody() });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.headers['cache-control'], 'no-store');
  });
});

describe('W34 session queue preparation', () => {
  const payload = () => ({ sessionToken: 'valid-session-token', purpose: 'individual', tracks: [{ contentHash: CONTENT_HASH, ...releaseRequestFields() }] });
  it('checks each track as the authenticated session and returns mixed results without denied keys', async () => {
    const requests: unknown[] = [];
    const hashB = `0x${'ef'.repeat(32)}`;
    const server = await buildApp({
      checkTrackAccess: async input => {
        requests.push(input);
        return input.contentHash === CONTENT_HASH
          ? allowAll.checkTrackAccess(input)
          : { allowed: false, code: 'LISTENER_ACCESS_REQUIRED', reason: 'Unlock this track.' };
      }
    });
    const body = payload();
    body.tracks.push({ ...body.tracks[0], contentHash: hashB, releaseId: `${RUNTIME}:${hashB}` });
    const response = await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: body });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    const result = response.json();
    assert.equal(result.tracks[0].contentKey, KEY);
    assert.equal(result.tracks[1].access, 'denied');
    assert.equal('contentKey' in result.tracks[1], false);
    assert.equal(requests.length, 2);
    for (const input of requests) assert.equal((input as { requester: string }).requester, SESSION_ADDRESS);
  });
  it('rejects anonymous, guest, oversized and partial identity requests before chain access', async () => {
    let reads = 0;
    const server = await buildApp({
      checkTrackAccess: async input => {
        reads++;
        return allowAll.checkTrackAccess(input);
      }
    });
    const invalid = [
      { tracks: payload().tracks },
      { ...payload(), purpose: 'room_listener' },
      { ...payload(), tracks: Array(6).fill(payload().tracks[0]) },
      { ...payload(), tracks: [{ contentHash: CONTENT_HASH }] }
    ];
    for (const body of invalid) assert.equal((await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: body })).statusCode, 400);
    assert.equal(reads, 0);
  });
  for (const code of ['SESSION_REVOKED', 'SESSION_EXPIRED'] as const)
    it(`rejects ${code} without reads or keys`, async () => {
      let reads = 0;
      const server = await buildApp({
        verifySessionToken: () => ({ valid: false, code, reason: 'Session ended' }),
        checkTrackAccess: async input => {
          reads++;
          return allowAll.checkTrackAccess(input);
        }
      });
      const response = await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: payload() });
      assert.equal(response.statusCode, 401);
      assert.equal(reads, 0);
      assert.equal(response.json().contentKey, undefined);
    });
  it('rejects wrong-chain sessions and revocation while access reads are pending', async () => {
    const server = await buildApp({ verifySessionToken: () => ({ valid: true, address: SESSION_ADDRESS, chainId: 1, jti: 'wrong' }) });
    assert.equal((await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: payload() })).statusCode, 401);
    let current = true;
    let derived = 0;
    await server.close();
    const revoked = await buildApp({
      verifySessionToken: () => (current ? allowAll.verifySessionToken('token') : { valid: false, code: 'SESSION_REVOKED', reason: 'Signed out' }),
      checkTrackAccess: async input => {
        current = false;
        return allowAll.checkTrackAccess(input);
      },
      deriveContentKey: input => {
        derived++;
        return allowAll.deriveContentKey(input);
      }
    });
    assert.equal((await revoked.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: payload() })).statusCode, 401);
    assert.equal(derived, 0);
  });
  it('does not extend an old cached verdict with another 30-second client lifetime', async () => {
    const until = Date.now() + 1000;
    const server = await buildApp({ checkTrackAccess: async input => ({ ...(await allowAll.checkTrackAccess(input)), validUntil: until }) });
    const response = await server.inject({ method: 'POST', url: '/api/tracks/keys/prepare', payload: payload() });
    assert.equal(Date.parse(response.json().expiresAt), until);
  });
});

// Uses the production W30 resolver: separate real clients and route buckets.
it('applies independent batch/free budgets per trusted client without caching keys', async () => {
  const server = await buildApp({}, true);
  const headers = { 'fly-client-ip': '198.51.100.1' };
  const batch = {
    method: 'POST' as const,
    url: '/api/tracks/keys/prepare',
    headers,
    payload: { sessionToken: 'valid-session-token', purpose: 'individual', tracks: [{ contentHash: CONTENT_HASH, ...releaseRequestFields() }] }
  };
  for (let n = 0; n < 12; n++) assert.equal((await server.inject(batch)).statusCode, 200);
  assert.equal((await server.inject(batch)).statusCode, 429);
  assert.equal((await server.inject({ ...batch, headers: { 'fly-client-ip': '198.51.100.2' } })).statusCode, 200);
  const free = { method: 'POST' as const, url: `/api/tracks/${CONTENT_HASH}/free-key`, headers, payload: releaseRequestFields() };
  for (let n = 0; n < 30; n++) assert.equal((await server.inject(free)).statusCode, 200);
  const limit = await server.inject(free);
  assert.equal(limit.statusCode, 429);
  assert.equal(limit.headers['cache-control'], 'no-store');
  assert.equal((await server.inject({ ...free, headers: { 'fly-client-ip': '198.51.100.2' } })).statusCode, 200);
});
