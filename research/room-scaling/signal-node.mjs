import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { createStore } from './room-store.mjs';
import { loopbackUrl } from './boundary.mjs';

const { redisUrl, prefix, nodeId, mode } = JSON.parse(process.env.W39_NODE_CONFIG);
loopbackUrl(redisUrl, ['redis:']);
const pub = new Redis(redisUrl, { lazyConnect: true, retryStrategy: null });
const sub = pub.duplicate();
pub.on('error', () => {});
sub.on('error', () => {});
await Promise.all([pub.connect(), sub.connect()]);
let io,
  listen,
  close,
  drain = async () => {};
if (mode === 'baseline') {
  const { startSignalingServer } = await import('../../web/server/signaling.mjs');
  const server = startSignalingServer({ host: '127.0.0.1', port: 0, logger: () => {}, nearbyEnabled: false });
  io = server.io;
  listen = () => server.listen();
  close = () => server.close();
} else {
  const store = createStore({ redisUrl, prefix, nodeId });
  await store.connect();
  const http = createServer((_, response) => {
    response.writeHead(404);
    response.end();
  });
  io = new Server(http, { transports: ['websocket'], serveClient: false, maxHttpBufferSize: 1024 });
  const hosts = new Map();
  let draining = false;
  const timers = new Set();
  drain = async () => {
    draining = true;
    for (const [id, host] of hosts) {
      const result = await store.mutate('drain', id, host.socketId, host.epoch);
      if (result[0] === 'OK') io.to(id).emit('research:draining', { roomId: id });
    }
    hosts.clear();
  };
  io.on('connection', socket => {
    const reply = (event, work) =>
      socket.on(event, async (payload = {}, ack) => {
        if (typeof ack !== 'function') return;
        try {
          ack(await work(payload));
        } catch {
          ack({ ok: false, code: 'STORE_UNAVAILABLE' });
        }
      });
    reply('room:create', async () => {
      if (draining || socket.data.roomId) return { ok: false, code: 'DRAINING_OR_MEMBER' };
      const roomId = randomBytes(8).toString('hex'),
        token = randomBytes(32).toString('hex');
      const result = await store.mutate('create', roomId, socket.id, '', token);
      if (result[0] !== 'OK') return { ok: false, code: result[0] };
      socket.data = { roomId, role: 'host', epoch: 1 };
      hosts.set(roomId, { socketId: socket.id, epoch: 1 });
      await socket.join(roomId);
      return { ok: true, roomId, hostResumeToken: token, epoch: 1 };
    });
    reply('room:join', async ({ roomId }) => {
      if (socket.data.roomId) return { ok: false, code: 'ALREADY_MEMBER' };
      const result = await store.mutate('join', roomId, socket.id);
      if (result[0] !== 'OK') return { ok: false, code: result[0] };
      socket.data = { roomId, role: 'guest' };
      await socket.join(roomId);
      return { ok: true, listenerCount: Number(result[1]) };
    });
    reply('room:resume', async ({ roomId, hostResumeToken }) => {
      if (draining || socket.data.roomId) return { ok: false, code: 'DRAINING_OR_MEMBER' };
      const nextToken = randomBytes(32).toString('hex');
      const result = await store.mutate('resume', roomId, socket.id, '', hostResumeToken, nextToken);
      if (result[0] !== 'OK') return { ok: false, code: result[0] };
      const epoch = Number(result[1]);
      socket.data = { roomId, role: 'host', epoch };
      hosts.set(roomId, { socketId: socket.id, epoch });
      await socket.join(roomId);
      return { ok: true, epoch, hostResumeToken: nextToken };
    });
    reply('research:publish', async ({ value }) => {
      if (socket.data.role !== 'host' || typeof value !== 'string' || value.length > 32) return { ok: false, code: 'DENIED' };
      const { roomId, epoch } = socket.data;
      const result = await store.mutate('publish', roomId, socket.id, epoch);
      if (result[0] !== 'OK') return { ok: false, code: result[0] };
      io.to(roomId).emit('research:event', { value, epoch, sequence: Number(result[1]) });
      return { ok: true };
    });
    // Kept off during the forced-expiry scenario by stopping this process.
    const timer = setInterval(() => {
      const { roomId, role, epoch } = socket.data;
      if (role === 'host') void store.mutate('heartbeat', roomId, socket.id, epoch).catch(() => {});
    }, 300);
    timers.add(timer);
    socket.on('disconnect', () => {
      clearInterval(timer);
      timers.delete(timer);
      if (socket.data.role === 'guest') void store.mutate('leave', socket.data.roomId, socket.id).catch(() => {});
    });
  });
  listen = () => new Promise(resolve => http.listen(0, '127.0.0.1', () => resolve(http.address().port)));
  close = async () => {
    for (const timer of timers) clearInterval(timer);
    await io.close();
    store.close();
  };
}
io.adapter(createAdapter(pub, sub, { key: `${prefix}:adapter`, requestsTimeout: 1000 }));
const port = await listen();
process.send({ type: 'ready', port });
process.on('message', async message => {
  if (message === 'drain') {
    await drain();
    process.send({ type: 'drained' });
  }
});
process.on('SIGTERM', () => {
  void close().finally(() => {
    pub.disconnect();
    sub.disconnect();
    process.exit(0);
  });
});
