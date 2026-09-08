import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { blake2b } from '@noble/hashes/blake2';
import { createUploadRoutes, type UploadRouteDeps } from './uploads.js';
import { createUploadAuthorizationService } from '../services/uploadAuthorizations.js';
import { RELEASE_BOUND_CONTENT_KEY_VERSION } from '../services/keyVault.js';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME = '0x2222222222222222222222222222222222222222' as const;
const CHAIN_ID = 420420417;
const SESSION_TOKEN = 'valid-session-token';
const BOUNDARY = '----dotifytest';
function mpegFrame(): Buffer {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x64]);
  return frame;
}
const audioBytes = Buffer.concat([mpegFrame(), mpegFrame()]);
const audioHash = `0x${Buffer.from(blake2b(audioBytes, { dkLen: 32 })).toString('hex')}`;
const truncatedMpegBytes = mpegFrame();
const truncatedMpegHash = `0x${Buffer.from(blake2b(truncatedMpegBytes, { dkLen: 32 })).toString('hex')}`;
const pngBytes = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('IHDR'),
  Buffer.alloc(17),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('IEND'),
  Buffer.alloc(4)
]);

let app: FastifyInstance | null = null;

type BuildOptions = {
  routeDeps?: Partial<UploadRouteDeps>;
  authorizationOptions?: Parameters<typeof createUploadAuthorizationService>[0];
};

async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const authorizations = createUploadAuthorizationService({
    epoch: 'upload-test-process',
    masterSecret: () => '11'.repeat(32),
    authorizationTtlMs: 60_000,
    quotaWindowMs: 60_000,
    principalByteLimit: 200 * 1024 * 1024,
    globalByteLimit: 2 * 1024 * 1024 * 1024,
    principalConcurrencyLimit: 2,
    globalConcurrencyLimit: 8,
    ...options.authorizationOptions
  });
  const deps: UploadRouteDeps = {
    verifySessionToken: token =>
      token === SESSION_TOKEN
        ? { valid: true, address: ADDRESS, chainId: CHAIN_ID, jti: 'session-jti' }
        : { valid: false, code: 'SESSION_INVALID', reason: 'bad session' },
    checkArtistAuthority: async () => ({ allowed: true, runtime: RUNTIME }),
    authorizations,
    deriveContentKeyBytes: () => Buffer.alloc(32, 7),
    encryptAudio: bytes => Buffer.from(bytes),
    pinFile: async () => 'file-cid',
    pinJson: async () => 'json-cid',
    ...options.routeDeps
  };

  app = Fastify();
  await app.register(multipart);
  await app.register(createUploadRoutes(deps), { prefix: '/api/uploads' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

function multipartHeaders(authorization?: string) {
  return {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    ...(authorization ? { authorization: `Bearer ${authorization}` } : {})
  };
}

function multipartFile(fieldName: string, filename: string, contentType: string, content: Buffer) {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`)
  ]);
}

function multipartAudio(content: Buffer, contentHash: string, contentType = 'audio/mpeg') {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="audio"; filename="track.bin"\r\nContent-Type: ${contentType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="contentHash"\r\n\r\n${contentHash}\r\n--${BOUNDARY}--\r\n`)
  ]);
}

async function authorize(server: FastifyInstance, purpose: 'audio' | 'cover' | 'metadata', bytes: number) {
  return server.inject({
    method: 'POST',
    url: '/api/uploads/authorize',
    headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    payload: { purpose, bytes }
  });
}

describe('POST /api/uploads/authorize', () => {
  it('rejects unauthenticated callers', async () => {
    const server = await buildApp();
    const response = await server.inject({ method: 'POST', url: '/api/uploads/authorize', payload: { purpose: 'audio', bytes: 8 } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'SESSION_REQUIRED');
  });

  it('issues a purpose- and byte-bound capability to a verified artist', async () => {
    const server = await buildApp();
    const response = await authorize(server, 'audio', audioBytes.length);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().purpose, 'audio');
    assert.equal(response.json().maxBytes, audioBytes.length);
    assert.equal(typeof response.json().uploadAuthorization, 'string');
  });

  it('rejects a signed-in address without an artist runtime', async () => {
    const server = await buildApp({
      routeDeps: {
        checkArtistAuthority: async () => ({
          allowed: false,
          code: 'ARTIST_RUNTIME_REQUIRED',
          reason: 'Create an artist runtime before uploading release assets.'
        })
      }
    });
    const response = await authorize(server, 'cover', pngBytes.length);
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, 'ARTIST_RUNTIME_REQUIRED');
  });

  it('rejects reservations that exhaust the principal byte quota', async () => {
    const server = await buildApp({ authorizationOptions: { principalByteLimit: 10, globalByteLimit: 100 } });
    assert.equal((await authorize(server, 'audio', 8)).statusCode, 200);
    const exhausted = await authorize(server, 'cover', 3);
    assert.equal(exhausted.statusCode, 429);
    assert.equal(exhausted.json().code, 'UPLOAD_PRINCIPAL_QUOTA_EXCEEDED');
  });
});

describe('authorized upload routes', () => {
  it('accepts detected audio bytes even when the declared MIME is untrusted', async () => {
    const server = await buildApp();
    const grant = (await authorize(server, 'audio', audioBytes.length)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(grant),
      payload: multipartAudio(audioBytes, audioHash, 'application/octet-stream')
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ref, 'dotify:enc:v2:key-v2:ipfs://file-cid');
    assert.equal(response.json().keyVersion, RELEASE_BOUND_CONTENT_KEY_VERSION);
  });

  it('derives backend audio keys from the artist runtime-bound key scope', async () => {
    let derivationScope: unknown = null;
    const server = await buildApp({
      routeDeps: {
        deriveContentKeyBytes: input => {
          derivationScope = input;
          return Buffer.alloc(32, 7);
        }
      }
    });
    const grant = (await authorize(server, 'audio', audioBytes.length)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(grant),
      payload: multipartAudio(audioBytes, audioHash)
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(derivationScope, {
      contentHash: audioHash,
      keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION,
      chainId: CHAIN_ID,
      runtimeAddress: RUNTIME
    });
  });

  it('rejects spoofed audio MIME when the received bytes are an image', async () => {
    const server = await buildApp();
    const grant = (await authorize(server, 'audio', pngBytes.length)).json().uploadAuthorization;
    const spoofedHash = `0x${Buffer.from(blake2b(pngBytes, { dkLen: 32 })).toString('hex')}`;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(grant),
      payload: multipartAudio(pngBytes, spoofedHash, 'audio/mpeg')
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'UPLOAD_MEDIA_INVALID');
  });

  it('rejects a lone MPEG frame header without a complete frame sequence', async () => {
    const server = await buildApp();
    const grant = (await authorize(server, 'audio', truncatedMpegBytes.length)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(grant),
      payload: multipartAudio(truncatedMpegBytes, truncatedMpegHash, 'audio/mpeg')
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'UPLOAD_MEDIA_INVALID');
  });

  it('rejects a content hash that does not match the received audio bytes', async () => {
    const server = await buildApp();
    const grant = (await authorize(server, 'audio', audioBytes.length)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(grant),
      payload: multipartAudio(audioBytes, `0x${'ab'.repeat(32)}`)
    });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /contentHash does not match/i);
  });

  it('rejects replay after one successful upload', async () => {
    const server = await buildApp();
    const grant = (await authorize(server, 'cover', pngBytes.length)).json().uploadAuthorization;
    const first = await server.inject({
      method: 'POST',
      url: '/api/uploads/cover',
      headers: multipartHeaders(grant),
      payload: multipartFile('cover', 'cover.txt', 'text/plain', pngBytes)
    });
    assert.equal(first.statusCode, 200);

    const replay = await server.inject({
      method: 'POST',
      url: '/api/uploads/cover',
      headers: multipartHeaders(grant),
      payload: multipartFile('cover', 'cover.png', 'image/png', pngBytes)
    });
    assert.equal(replay.statusCode, 409);
    assert.equal(replay.json().code, 'UPLOAD_AUTH_REPLAYED');
  });

  it('rejects an expired upload authorization', async () => {
    let now = 1_000;
    const server = await buildApp({ authorizationOptions: { now: () => now, authorizationTtlMs: 10 } });
    const grant = (await authorize(server, 'cover', pngBytes.length)).json().uploadAuthorization;
    now = 1_011;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/cover',
      headers: multipartHeaders(grant),
      payload: multipartFile('cover', 'cover.png', 'image/png', pngBytes)
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'UPLOAD_AUTH_EXPIRED');
  });

  it('releases quota after an interrupted outbound upload', async () => {
    const interrupted = new Error('client aborted');
    interrupted.name = 'AbortError';
    const server = await buildApp({
      authorizationOptions: { principalByteLimit: pngBytes.length, globalByteLimit: pngBytes.length },
      routeDeps: { pinFile: async () => Promise.reject(interrupted) }
    });
    const grant = (await authorize(server, 'cover', pngBytes.length)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/cover',
      headers: multipartHeaders(grant),
      payload: multipartFile('cover', 'cover.png', 'image/png', pngBytes)
    });
    assert.equal(response.statusCode, 499);
    assert.equal(response.json().code, 'UPLOAD_CANCELLED');
    assert.equal((await authorize(server, 'cover', pngBytes.length)).statusCode, 200);
  });
});

const validManifest = {
  schema: 'dotify.track.v1',
  createdAt: new Date().toISOString(),
  assets: { audioCID: 'audiocid', coverCID: 'covercid', encrypted: true, previewCID: 'previewcid' },
  track: {
    contentHash: `0x${'ab'.repeat(32)}`,
    title: 'Signal',
    artistName: 'Nova',
    description: '',
    accessMode: 'classic',
    priceDot: '1',
    requiredPersonhood: 'DIM1',
    zone: 'Studio'
  },
  royalties: [{ recipient: 'r', bps: 10000 }],
  settlement: { target: 'evm', royaltyBps: 700, pricePlanck: '1' }
};

describe('POST /api/uploads/metadata', () => {
  it('accepts a valid manifest with a metadata-scoped authorization', async () => {
    const server = await buildApp();
    const bytes = Buffer.byteLength(JSON.stringify(validManifest));
    const grant = (await authorize(server, 'metadata', bytes)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/metadata',
      headers: { authorization: `Bearer ${grant}` },
      payload: validManifest
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ref, 'ipfs://json-cid');
  });

  it('rejects a manifest with a non-string previewCID', async () => {
    const server = await buildApp();
    const bad = { ...validManifest, assets: { ...validManifest.assets, previewCID: 123 } };
    const bytes = Buffer.byteLength(JSON.stringify(bad));
    const grant = (await authorize(server, 'metadata', bytes)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/metadata',
      headers: { authorization: `Bearer ${grant}` },
      payload: bad
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'UPLOAD_MANIFEST_INVALID');
  });

  it('rejects a manifest whose request body exceeds its signed byte budget', async () => {
    const server = await buildApp();
    const bytes = Buffer.byteLength(JSON.stringify(validManifest));
    const grant = (await authorize(server, 'metadata', bytes - 1)).json().uploadAuthorization;
    const response = await server.inject({
      method: 'POST',
      url: '/api/uploads/metadata',
      headers: { authorization: `Bearer ${grant}` },
      payload: validManifest
    });
    assert.equal(response.statusCode, 413);
    assert.equal(response.json().code, 'UPLOAD_BUDGET_EXCEEDED');
  });
});
