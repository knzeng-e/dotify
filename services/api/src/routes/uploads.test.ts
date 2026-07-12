import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { config } from '../config.js';
import { uploadRoutes } from './uploads.js';

// These tests run without Pinata configured, so a request that passes
// validation reaches the pin step and returns 503 (PinataUnconfiguredError).
// That lets us distinguish "rejected at validation" (4xx) from "accepted,
// pinning unavailable" (503) without any network or secret.

let app: FastifyInstance | null = null;
const originalContentKeyMasterSecret = config.CONTENT_KEY_MASTER_SECRET;
const originalPinataJwt = config.PINATA_JWT;

async function buildApp(): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(multipart);
  await app.register(uploadRoutes, { prefix: '/api/uploads' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
  config.CONTENT_KEY_MASTER_SECRET = originalContentKeyMasterSecret;
  config.PINATA_JWT = originalPinataJwt;
});

const BOUNDARY = '----dotifytest';

function multipartHeaders() {
  return { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };
}

// A file part. @fastify/multipart's streaming iterator hangs on any file part
// the route does not consume, so a "no file" case must use a plain field.
function multipartFile(fieldName: string, filename: string, contentType: string, content: string) {
  return Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n` +
      `${content}\r\n` +
      `--${BOUNDARY}--\r\n`
  );
}

function multipartField(fieldName: string, value: string) {
  return Buffer.from(`--${BOUNDARY}\r\n` + `Content-Disposition: form-data; name="${fieldName}"\r\n\r\n` + `${value}\r\n` + `--${BOUNDARY}--\r\n`);
}

function multipartAudio(content: Buffer, contentHash: string) {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\n` + 'Content-Disposition: form-data; name="audio"; filename="track.mp3"\r\n' + 'Content-Type: audio/mpeg\r\n\r\n'),
    content,
    Buffer.from(`\r\n--${BOUNDARY}\r\n` + 'Content-Disposition: form-data; name="contentHash"\r\n\r\n' + `${contentHash}\r\n` + `--${BOUNDARY}--\r\n`)
  ]);
}

describe('POST /api/uploads/audio (content hash verification)', () => {
  const audioBytes = Buffer.from('abc', 'utf8');
  // Published BLAKE2b-256 test vector for "abc". Keeping the expected digest
  // independent of the route implementation catches accidental BLAKE2b-512
  // truncation or a switch to another 256-bit hash.
  const audioHash = '0xbddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319';

  it('accepts multipart audio when contentHash matches the exact received bytes', async () => {
    config.CONTENT_KEY_MASTER_SECRET = '11'.repeat(32);
    config.PINATA_JWT = undefined;
    const server = await buildApp();

    const res = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(),
      payload: multipartAudio(audioBytes, audioHash)
    });

    // Hash verification, key derivation, and encryption succeeded; the request
    // reached the deliberately unconfigured Pinata boundary.
    assert.equal(res.statusCode, 503);
    assert.match(res.json().error, /upload service is not configured/i);
  });

  it('rejects multipart audio when contentHash does not match the received bytes', async () => {
    config.CONTENT_KEY_MASTER_SECRET = '11'.repeat(32);
    config.PINATA_JWT = undefined;
    const server = await buildApp();

    const res = await server.inject({
      method: 'POST',
      url: '/api/uploads/audio',
      headers: multipartHeaders(),
      payload: multipartAudio(audioBytes, `0x${'ab'.repeat(32)}`)
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /contentHash does not match the uploaded audio file/i);
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

describe('POST /api/uploads/metadata (previewCID schema)', () => {
  it('accepts a manifest carrying assets.previewCID', async () => {
    const server = await buildApp();
    const res = await server.inject({ method: 'POST', url: '/api/uploads/metadata', payload: validManifest });
    // Passed schema validation (would be 400 otherwise), reached the pin step.
    assert.equal(res.statusCode, 503);
  });

  it('accepts a Free access-mode manifest', async () => {
    const server = await buildApp();
    const freeManifest = {
      ...validManifest,
      assets: { ...validManifest.assets, previewCID: undefined },
      track: {
        ...validManifest.track,
        accessMode: 'free',
        priceDot: '0',
        requiredPersonhood: 'None'
      },
      settlement: { ...validManifest.settlement, pricePlanck: '0' }
    };

    const res = await server.inject({ method: 'POST', url: '/api/uploads/metadata', payload: freeManifest });
    // Passed schema validation (would be 400 otherwise), reached the pin step.
    assert.equal(res.statusCode, 503);
  });

  it('rejects a manifest with a non-string previewCID', async () => {
    const server = await buildApp();
    const bad = { ...validManifest, assets: { ...validManifest.assets, previewCID: 123 } };
    const res = await server.inject({ method: 'POST', url: '/api/uploads/metadata', payload: bad });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /manifest/i);
  });
});
