#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { io as ioClient } from 'socket.io-client';

const DEFAULT_SIGNAL_URL = 'http://127.0.0.1:8788';
const DEFAULT_TIMEOUT_MS = 8_000;
const ROOM_TRACK_HASH = 'dotify-smoke-track';

export function normalizeBaseUrl(rawUrl) {
  const url = new URL(String(rawUrl || DEFAULT_SIGNAL_URL).trim());
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function redactUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function parseBoolean(value) {
  return /^(1|true|yes)$/i.test(String(value ?? '').trim());
}

function parseTimeout(value) {
  const timeoutMs = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${value}`);
  }
  return timeoutMs;
}

function printHelp() {
  console.log(`Dotify signaling smoke check

Usage:
  npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://<netlify-app>

Options:
  --url <url>             Signaling base URL. Defaults to SIGNAL_SMOKE_URL, VITE_SIGNAL_URL, or ${DEFAULT_SIGNAL_URL}.
  --origin <origin>       Expected allowed browser origin for CORS and Socket.IO handshakes.
  --denied-origin <url>   Origin expected to be denied by CORS and Socket.IO handshakes.
  --room                  Create a temporary room and join it as a guest.
  --timeout-ms <ms>       Per-check timeout. Defaults to ${DEFAULT_TIMEOUT_MS}.
  --json                  Print machine-readable JSON.
  --help                  Show this message.

Environment aliases:
  SIGNAL_SMOKE_URL, SIGNAL_SMOKE_ORIGIN, SIGNAL_SMOKE_DENIED_ORIGIN,
  SIGNAL_SMOKE_ROOM=1, SIGNAL_SMOKE_TIMEOUT_MS, SIGNAL_SMOKE_JSON=1
`);
}

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    url: env.SIGNAL_SMOKE_URL || env.VITE_SIGNAL_URL || DEFAULT_SIGNAL_URL,
    origin: env.SIGNAL_SMOKE_ORIGIN || '',
    deniedOrigin: env.SIGNAL_SMOKE_DENIED_ORIGIN || '',
    includeRoom: parseBoolean(env.SIGNAL_SMOKE_ROOM),
    timeoutMs: parseTimeout(env.SIGNAL_SMOKE_TIMEOUT_MS),
    json: parseBoolean(env.SIGNAL_SMOKE_JSON),
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--room') {
      options.includeRoom = true;
      continue;
    }
    if (arg === '--no-room') {
      options.includeRoom = false;
      continue;
    }
    if (arg === '--url') {
      options.url = argv[++index];
      continue;
    }
    if (arg === '--origin') {
      options.origin = argv[++index];
      continue;
    }
    if (arg === '--denied-origin') {
      options.deniedOrigin = argv[++index];
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = parseTimeout(argv[++index]);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  options.url = normalizeBaseUrl(options.url);
  options.origin = options.origin.trim().replace(/\/$/, '');
  options.deniedOrigin = options.deniedOrigin.trim().replace(/\/$/, '');
  return options;
}

function assertSmoke(condition, message) {
  if (!condition) throw new Error(message);
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchJson(baseUrl, path, { origin, timeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      signal: controller.signal,
      headers: origin ? { origin } : undefined
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(`${path} returned non-JSON response: ${error.message}`);
    }
    assertSmoke(response.ok, `${path} returned HTTP ${response.status}`);
    return {
      body,
      status: response.status,
      accessControlAllowOrigin: response.headers.get('access-control-allow-origin')
    };
  } finally {
    clearTimeout(timer);
  }
}

function assertAllowedCorsHeader(header, origin, path) {
  if (!origin) return;
  assertSmoke(header === '*' || header === origin, `${path} did not allow expected origin ${origin}; received ${header ?? 'no CORS header'}`);
}

async function connectSocket(baseUrl, { origin, timeoutMs, label }) {
  const socket = ioClient(baseUrl, {
    extraHeaders: origin ? { Origin: origin } : undefined,
    reconnection: false,
    timeout: timeoutMs,
    transports: ['websocket']
  });

  await withTimeout(
    new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', error => reject(new Error(`${label} connection failed: ${error.message}`)));
    }),
    timeoutMs,
    `${label} connection`
  );

  return socket;
}

function emitAck(socket, event, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (error, response) => {
      if (error) {
        reject(new Error(`${event} timed out after ${timeoutMs}ms`));
        return;
      }
      resolve(response);
    });
  });
}

async function expectSocketOriginDenied(baseUrl, { origin, timeoutMs }) {
  const socket = ioClient(baseUrl, {
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: timeoutMs,
    transports: ['websocket']
  });

  try {
    const rejection = await withTimeout(
      new Promise((resolve, reject) => {
        socket.once('connect', () => reject(new Error(`Socket.IO accepted denied origin ${origin}`)));
        socket.once('connect_error', error => resolve(error.message || 'connect_error'));
      }),
      timeoutMs,
      `denied-origin socket check for ${origin}`
    );
    return { rejected: true, message: rejection };
  } finally {
    socket.disconnect();
  }
}

async function runRoomSmoke(baseUrl, { origin, timeoutMs }) {
  let host;
  let listener;

  try {
    host = await connectSocket(baseUrl, { origin, timeoutMs, label: 'host' });
    const created = await emitAck(
      host,
      'room:create',
      {
        displayName: 'Dotify Smoke Host',
        playbackMode: 'full',
        track: {
          accessMode: 'free',
          artist: 'Dotify Ops',
          hash: ROOM_TRACK_HASH,
          title: 'Hosted signaling smoke check'
        }
      },
      timeoutMs
    );
    assertSmoke(created?.ok === true, `room:create failed: ${created?.error ?? 'missing ok response'}`);
    assertSmoke(/^[A-Z2-9]{6}$/.test(created.roomId), `room:create returned invalid roomId ${created?.roomId}`);

    listener = await connectSocket(baseUrl, { origin, timeoutMs, label: 'listener' });
    const joined = await emitAck(listener, 'room:join', { roomId: created.roomId, displayName: 'Dotify Smoke Guest' }, timeoutMs);
    assertSmoke(joined?.ok === true, `room:join failed: ${joined?.error ?? 'missing ok response'}`);
    assertSmoke(joined.roomId === created.roomId, 'room:join returned a different roomId');
    assertSmoke(joined.listenerCount >= 1, 'room:join did not report a listener');
    assertSmoke(joined.playbackMode === 'full', `room:join returned playbackMode=${joined.playbackMode}`);

    const status = await fetchJson(baseUrl, '/status', { origin, timeoutMs });
    const room = status.body.rooms.find(candidate => candidate.roomId === created.roomId);
    assertSmoke(room, `created room ${created.roomId} was not visible on /status`);
    assertSmoke(room.listenersNeedWalletAccess === false, 'room metadata must preserve walletless guest listening');
    assertSmoke(room.listenerCount >= 1, 'room status did not report the joined guest');

    return {
      roomId: created.roomId,
      hostName: created.hostName,
      listenerCount: joined.listenerCount,
      listenersNeedWalletAccess: room.listenersNeedWalletAccess,
      playbackMode: room.playbackMode
    };
  } finally {
    listener?.disconnect();
    host?.disconnect();
  }
}

export async function runSignalingSmoke(options) {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(options.url);
  const origin = options.origin || '';
  const deniedOrigin = options.deniedOrigin || '';
  const timeoutMs = parseTimeout(options.timeoutMs);

  const health = await fetchJson(baseUrl, '/health', { origin, timeoutMs, fetchImpl: options.fetchImpl });
  assertSmoke(health.body?.ok === true, '/health did not return ok=true');
  assertSmoke(Number.isFinite(health.body.rooms), '/health did not include a numeric rooms count');
  assertSmoke(Number.isFinite(health.body.listeners), '/health did not include a numeric listeners count');
  assertAllowedCorsHeader(health.accessControlAllowOrigin, origin, '/health');

  const status = await fetchJson(baseUrl, '/status', { origin, timeoutMs, fetchImpl: options.fetchImpl });
  assertSmoke(Array.isArray(status.body?.rooms), '/status did not include a rooms array');
  assertSmoke(
    status.body?.soloListeningByTrackHash && typeof status.body.soloListeningByTrackHash === 'object',
    '/status did not include solo presence totals'
  );
  assertAllowedCorsHeader(status.accessControlAllowOrigin, origin, '/status');

  let deniedCors = null;
  let deniedSocket = null;
  if (deniedOrigin) {
    deniedCors = await fetchJson(baseUrl, '/status', { origin: deniedOrigin, timeoutMs, fetchImpl: options.fetchImpl });
    assertSmoke(!deniedCors.accessControlAllowOrigin, `/status allowed denied origin ${deniedOrigin}`);
    deniedSocket = await expectSocketOriginDenied(baseUrl, { origin: deniedOrigin, timeoutMs });
  }

  const room = options.includeRoom ? await runRoomSmoke(baseUrl, { origin, timeoutMs }) : null;

  return {
    checkedAt: new Date().toISOString(),
    endpoint: redactUrl(baseUrl),
    origin: origin || null,
    elapsedMs: Date.now() - startedAt,
    health: {
      ok: health.body.ok,
      rooms: health.body.rooms,
      listeners: health.body.listeners,
      soloListeners: health.body.soloListeners,
      allowedOrigins: health.body.allowedOrigins,
      roomTtlMs: health.body.roomTtlMs,
      hostHeartbeatTimeoutMs: health.body.hostHeartbeatTimeoutMs,
      maxListenersPerRoom: health.body.maxListenersPerRoom
    },
    status: {
      rooms: status.body.rooms.length,
      soloTracks: Object.keys(status.body.soloListeningByTrackHash).length
    },
    cors: {
      allowedOriginHeader: status.accessControlAllowOrigin,
      deniedOrigin: deniedOrigin || null,
      deniedOriginHeader: deniedCors?.accessControlAllowOrigin ?? null,
      deniedSocketRejected: deniedSocket?.rejected ?? null,
      deniedSocketMessage: deniedSocket?.message ?? null
    },
    room
  };
}

function printTextResult(result) {
  console.log('Dotify signaling smoke passed');
  console.log(`- endpoint: ${result.endpoint}`);
  console.log(`- health: ok=${result.health.ok}, rooms=${result.health.rooms}, listeners=${result.health.listeners}`);
  console.log(`- status: rooms=${result.status.rooms}, soloTracks=${result.status.soloTracks}`);
  if (result.origin) {
    console.log(`- allowed origin: ${result.origin} -> ${result.cors.allowedOriginHeader ?? 'no CORS header'}`);
  }
  if (result.cors.deniedOrigin) {
    console.log(
      `- denied origin: ${result.cors.deniedOrigin} -> ${result.cors.deniedSocketRejected ? 'HTTP CORS omitted and Socket.IO rejected' : 'not checked'}`
    );
  }
  if (result.room) {
    console.log(
      `- room flow: created ${result.room.roomId}, joined guest, listenersNeedWalletAccess=${result.room.listenersNeedWalletAccess}, playbackMode=${result.room.playbackMode}`
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const options = parseArgs();
    if (options.help) {
      printHelp();
      process.exitCode = 0;
    } else {
      const result = await runSignalingSmoke(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printTextResult(result);
      }
    }
  } catch (error) {
    console.error(`Dotify signaling smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
