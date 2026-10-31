import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { BoundedWebSocket, RPC_MESSAGE_MAX } from './protected-operator.mjs';

test('operator socket rejects an oversized fragmented response before a message reaches JSON-RPC', { timeout: 10_000 }, async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  t.after(
    () =>
      new Promise(resolve => {
        for (const c of server.clients) c.terminate();
        server.close(resolve);
      })
  );
  let messages = 0;
  server.once('connection', socket => {
    socket.on('error', () => {});
    socket.send(Buffer.alloc(RPC_MESSAGE_MAX / 2), { fin: false });
    socket.send(Buffer.alloc(RPC_MESSAGE_MAX / 2 + 1), { fin: true });
  });
  const client = new BoundedWebSocket(`ws://127.0.0.1:${server.address().port}`);
  t.after(() => client.terminate());
  client.on('message', () => messages++);
  const [error] = await once(client, 'error');
  assert.equal(error.code, 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH');
  assert.equal(messages, 0);
});
