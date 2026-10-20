import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, createTransport } from '@parity/truapi';

// Fixed codec-1 wire samples, independent of the installed encoder. SDK fake
// clients bypass transport and could not detect the codec-3 rollout regression.
function wireHost() {
  const listeners = new Set();
  const sent = [];
  const provider = {
    postMessage: frame => sent.push(Array.from(frame)),
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
  return { provider, sent, receive: bytes => listeners.forEach(listener => listener(Uint8Array.from(bytes))) };
}

test('installed transport answers a codec-1 host-initiated handshake with a codec-1 acknowledgement', () => {
  const host = wireHost();
  const transport = createTransport(host.provider);
  try {
    // SCALE string "h", request discriminant 0, V1, codecVersion 1.
    host.receive([4, 104, 0, 0, 1]);
    // Same id, response discriminant 1, V1, Ok(void).
    assert.deepEqual(host.sent, [[4, 104, 1, 0, 0]]);
  } finally {
    transport.dispose();
  }
});

test('product-initiated handshake negotiates the supported codec with a raw host response', async () => {
  const host = wireHost();
  const transport = createTransport(host.provider);
  try {
    const client = createClient(transport);
    const handshake = Promise.resolve(client.system.handshake());
    // A failed wire assertion disposes the transport; consume that cancellation
    // so a codec regression reports the assertion rather than an extra rejection.
    void handshake.catch(() => {});
    const request = host.sent[0];
    // The correlation id varies; the protocol tail must stay codec 1.
    assert.deepEqual(request.slice(-3), [0, 0, 1]);
    host.receive([...request.slice(0, -3), 1, 0, 0]);
    const result = await handshake;
    assert.equal(result.isOk(), true);
  } finally {
    transport.dispose();
  }
});
