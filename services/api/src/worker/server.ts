// Separate image/filesystem/process namespace. No API configuration or custody imports.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { transcodeStreamingAudio } from '../services/streamingTranscoder.js';
import { packStreamingBundle } from '../services/streamingBundle.js';
const forbidden = [
  'CONTENT_KEY_MASTER_SECRET',
  'CONTENT_KEY_MASTER_SECRETS',
  'PINATA_JWT',
  'SESSION_EPOCH',
  'MNEMONIC',
  'BULLETIN_MNEMONIC',
  'PRIVATE_KEY',
  'TURN_REST_SECRET',
  'TURN_CAPABILITY_SECRET',
  'NATIVE_RECEIPT_SERVICE_TOKEN'
];
if (forbidden.some(name => process.env[name])) throw new Error('Custody, signing and API secrets must not be configured on the isolated encoder');
const secret = process.env.STREAMING_WORKER_TOKEN ?? '';
if (secret.length < 32) throw new Error('A dedicated streaming worker token is required');
let busy = false;
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const authorization = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    response.writeHead(401).end();
    request.resume();
    return;
  }
  if (request.method !== 'POST' || request.url !== '/encode') {
    response.writeHead(404).end();
    request.resume();
    return;
  }
  if (busy) {
    response.writeHead(429, { 'Retry-After': '5' }).end();
    request.resume();
    return;
  }
  const length = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 1 || length > 50 * 1024 * 1024) {
    response.writeHead(413).end();
    request.resume();
    return;
  }
  busy = true;
  const controller = new AbortController();
  const aborted = () => controller.abort();
  request.once('aborted', aborted);
  const disconnected = () => {
    if (!response.writableFinished) aborted();
  };
  response.once('close', disconnected);
  const deadline = setTimeout(aborted, 10 * 60_000);
  let master: Buffer | undefined;
  try {
    request.setTimeout(30_000, () => {
      aborted();
      request.destroy();
    });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > length) throw new Error('Invalid input length');
      chunks.push(chunk);
    }
    if (size !== length) throw new Error('Incomplete input');
    request.setTimeout(0);
    master = Buffer.concat(chunks, size);
    for (const chunk of chunks) chunk.fill(0);
    const encoded = await transcodeStreamingAudio({ master, signal: controller.signal, ffmpegPath: '/usr/bin/ffmpeg' });
    const body = packStreamingBundle(encoded);
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length });
    await new Promise<void>((resolve, reject) => {
      response.once('error', reject);
      response.end(body, resolve);
    });
  } catch {
    if (!response.headersSent && !response.destroyed) response.writeHead(422).end();
    else response.destroy();
  } finally {
    clearTimeout(deadline);
    request.off('aborted', aborted);
    response.off('close', disconnected);
    master?.fill(0);
    busy = false;
  }
});
server.headersTimeout = 15_000;
server.requestTimeout = 35_000;
server.maxConnections = 8;
server.listen(Number(process.env.PORT ?? 8791), '::');
process.once('SIGTERM', () => {
  server.close();
  setTimeout(() => process.exit(1), 10_000).unref();
});
