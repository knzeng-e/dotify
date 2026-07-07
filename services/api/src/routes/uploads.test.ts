import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { uploadRoutes } from './uploads.js';

// These tests run without Pinata configured, so a request that passes
// validation reaches the pin step and returns 503 (PinataUnconfiguredError).
// That lets us distinguish "rejected at validation" (4xx) from "accepted,
// pinning unavailable" (503) without any network or secret.

let app: FastifyInstance | null = null;

async function buildApp(): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(multipart);
  await app.register(uploadRoutes, { prefix: '/api/uploads' });
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
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
      `--${BOUNDARY}--\r\n`,
  );
}

function multipartField(fieldName: string, value: string) {
  return Buffer.from(
    `--${BOUNDARY}\r\n` + `Content-Disposition: form-data; name="${fieldName}"\r\n\r\n` + `${value}\r\n` + `--${BOUNDARY}--\r\n`,
  );
}

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
    zone: 'Studio',
  },
  royalties: [{ recipient: 'r', bps: 10000 }],
  settlement: { target: 'evm', royaltyBps: 700, pricePlanck: '1' },
};

describe('POST /api/uploads/preview', () => {
  it('rejects a request with no preview file', async () => {
    const server = await buildApp();
    const res = await server.inject({ method: 'POST', url: '/api/uploads/preview', headers: multipartHeaders(), payload: multipartField('note', 'x') });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /No preview file/i);
  });

  it('rejects a preview with a non-audio MIME type', async () => {
    const server = await buildApp();
    const res = await server.inject({ method: 'POST', url: '/api/uploads/preview', headers: multipartHeaders(), payload: multipartFile('preview', 'p.txt', 'text/plain', 'hello') });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /not an accepted audio format/i);
  });

  it('accepts a WAV preview and reaches the pin step (503 without Pinata configured)', async () => {
    const server = await buildApp();
    const res = await server.inject({ method: 'POST', url: '/api/uploads/preview', headers: multipartHeaders(), payload: multipartFile('preview', 'p.wav', 'audio/wav', 'RIFFxxxxWAVE') });
    assert.equal(res.statusCode, 503); // validation passed, pinning unavailable
  });
});

describe('POST /api/uploads/metadata (previewCID schema)', () => {
  it('accepts a manifest carrying assets.previewCID', async () => {
    const server = await buildApp();
    const res = await server.inject({ method: 'POST', url: '/api/uploads/metadata', payload: validManifest });
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
