import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { startSignalingServer } from './signaling.mjs';

const track = { id: 'runtime:track-1', title: 'A shared moment', artist: 'Ada' };
const change = (revision, tracks, operationId = 'operation-00000001', extra = {}) => ({ operationId, revision, tracks, ...extra });
async function setup(t, enabled = true) {
  const server = startSignalingServer({ port: 0, host: '127.0.0.1', hostLineupEnabled: enabled, logger: () => {} });
  const port = await server.listen();
  const clients = [];
  t.after(async () => {
    clients.forEach(client => client.disconnect());
    await server.close();
  });
  const connect = async () => {
    const client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    clients.push(client);
    await once(client, 'connect');
    return client;
  };
  const host = await connect();
  const created = await host.emitWithAck('room:create', { displayName: 'Ada' });
  return { host, created, connect, port };
}

test('queue is host-only, shared with late joiners, ephemeral, and private to its room', async t => {
  const { host, created, connect, port } = await setup(t);
  const guest = await connect();
  await guest.emitWithAck('room:join', { roomId: created.roomId });
  assert.equal((await guest.emitWithAck('room:lineup:update', change(0, [track]))).ok, false);
  const broadcast = once(guest, 'room:lineup');
  const accepted = await host.emitWithAck('room:lineup:update', change(0, [track]));
  assert.equal(accepted.lineup.revision, 1);
  assert.deepEqual((await broadcast)[0].lineup, accepted.lineup);
  const late = await connect();
  assert.deepEqual((await late.emitWithAck('room:join', { roomId: created.roomId })).lineup, accepted.lineup);
  assert.equal(JSON.stringify(await (await fetch(`http://127.0.0.1:${port}/status`)).json()).includes('A shared moment'), false);
  const closed = once(guest, 'room:closed');
  host.emit('room:leave');
  await closed;
  const next = await host.emitWithAck('room:create', {});
  assert.deepEqual(next.lineup, { revision: 0, tracks: [] });
});

test('queue rejects stale edits and unsafe payloads; retry is idempotent across host resume', async t => {
  const { host, created, connect } = await setup(t);
  const original = change(0, [track]);
  const first = await host.emitWithAck('room:lineup:update', original);
  assert.deepEqual((await host.emitWithAck('room:lineup:update', original)).lineup, first.lineup);
  assert.equal((await host.emitWithAck('room:lineup:update', change(0, [], 'operation-00000002'))).ok, false);
  assert.equal((await host.emitWithAck('room:lineup:update', change(1, [{ ...track, audioRef: 'secret' }], 'operation-00000003'))).ok, false);
  assert.equal((await host.emitWithAck('room:lineup:update', change(1, [track, track], 'operation-00000004'))).ok, false);
  assert.equal(
    (
      await host.emitWithAck(
        'room:lineup:update',
        change(
          1,
          Array.from({ length: 13 }, (_, i) => ({ ...track, id: `track-${i}` })),
          'operation-00000005'
        )
      )
    ).ok,
    false
  );
  assert.equal((await host.emitWithAck('room:lineup:update', change(1, [], original.operationId))).ok, false);
  const guest = await connect();
  await guest.emitWithAck('room:join', { roomId: created.roomId });
  const lost = once(guest, 'room:host-connection');
  host.disconnect();
  await lost;
  await guest.emitWithAck('room:request', { text: 'While you were reconnecting' });
  await guest.emitWithAck('room:chat', { text: 'Still here' });
  const resumedHost = await connect();
  const resumed = await resumedHost.emitWithAck('room:resume', { roomId: created.roomId, hostResumeToken: created.hostResumeToken });
  assert.deepEqual(resumed.lineup, first.lineup);
  assert.equal(resumed.requests[0].text, 'While you were reconnecting');
  assert.equal(resumed.chatHistory[0].text, 'Still here');
  assert.deepEqual((await resumedHost.emitWithAck('room:lineup:update', original)).lineup, first.lineup);
});

test('host can accept one request atomically while choosing its catalog track', async t => {
  const { host, created, connect } = await setup(t);
  const guest = await connect();
  await guest.emitWithAck('room:join', { roomId: created.roomId });
  const requested = once(host, 'room:requests');
  await guest.emitWithAck('room:request', { text: 'Something warm' });
  const requestId = (await requested)[0][0].id;
  const cleared = once(guest, 'room:requests');
  const result = await host.emitWithAck('room:lineup:update', change(0, [track], undefined, { acceptedRequestId: requestId }));
  assert.equal(result.ok, true);
  assert.deepEqual((await cleared)[0], []);
  assert.equal((await host.emitWithAck('room:lineup:update', change(1, [], 'operation-00000002', { acceptedRequestId: requestId }))).ok, false);
});

test('server default-off rejects queue collection', async t => {
  const { host, created } = await setup(t, false);
  assert.equal(created.lineup, undefined);
  assert.equal((await host.emitWithAck('room:lineup:update', change(0, [track]))).ok, false);
});
