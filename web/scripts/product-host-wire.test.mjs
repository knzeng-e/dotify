import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, createTransport, TRUAPI_CODEC_VERSION, TRUAPI_WIRE_SCHEMA_HASH } from '@parity/truapi';

// Fixed TrUAPI 0.25 / codec-3 wire samples, independent of the installed encoder.
// High-level fake clients cannot detect a Host/client protocol mismatch.
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

test('installed transport answers the Desktop 0.1.4-rc.3 codec-3 handshake', () => {
  const host = wireHost();
  const transport = createTransport(host.provider);
  try {
    // SCALE string "h", system trait 1, handshake method 0, Request, V1, codec 3.
    host.receive([4, 104, 1, 0, 0, 0, 3]);
    // Same id and address, Response, Ok(V1(void)).
    assert.deepEqual(host.sent, [[4, 104, 1, 0, 1, 0, 0]]);
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
    // The correlation id varies; trait/method and codec are fixed independently.
    assert.deepEqual(request.slice(-5), [1, 0, 0, 0, 3]);
    host.receive([...request.slice(0, -5), 1, 0, 1, 0, 0]);
    const result = await handshake;
    assert.equal(result.isOk(), true);
  } finally {
    transport.dispose();
  }
});

test('protocol pin includes the schema, not only codec 3', () => {
  assert.equal(TRUAPI_CODEC_VERSION, 3);
  // TrUAPI 0.26 also calls itself codec 3, but has a different incompatible schema.
  assert.equal(TRUAPI_WIRE_SCHEMA_HASH, '3c45e49b26c1ab97');
});

test('a raw codec-3 account response preserves the product scope, index and public key', async () => {
  const host = wireHost();
  const transport = createTransport(host.provider);
  try {
    const client = createClient(transport);
    const product = 'dotify-test01.dot';
    const lookup = Promise.resolve(client.account.getAccount({ productAccountId: { dotNsIdentifier: product, derivationIndex: { tag: 'Index', value: 0 } } }));
    void lookup.catch(() => {});
    const payload = [0, product.length * 4, ...new TextEncoder().encode(product), 0, 0, 0, 0, 0];
    const request = host.sent.at(-1);
    assert.deepEqual(request.slice(-(payload.length + 3)), [2, 1, 0, ...payload]);
    const prefix = request.slice(0, -(payload.length + 3));
    const key = Array(32).fill(0x22);
    // Response at account trait 2, getAccount method 1: Ok(V1({ account: { publicKey } })).
    host.receive([...prefix, 2, 1, 1, 0, 0, 128, ...key]);
    const result = await lookup;
    assert.equal(result.isOk(), true);
    assert.equal(result.value.account.publicKey, `0x${'22'.repeat(32)}`);
  } finally {
    transport.dispose();
  }
});

test('a codec-3 account denial remains a denial without inventing an account', async () => {
  const host = wireHost();
  const transport = createTransport(host.provider);
  try {
    const client = createClient(transport);
    const lookup = Promise.resolve(client.account.getAccount({ productAccountId: { dotNsIdentifier: 'x', derivationIndex: { tag: 'Index', value: 0 } } }));
    void lookup.catch(() => {});
    // Request tail: account trait/method/type, V1, SCALE "x", Index(0).
    const request = host.sent.at(-1);
    const prefix = request.slice(0, -11);
    assert.deepEqual(request.slice(-11), [2, 1, 0, 0, 4, 120, 0, 0, 0, 0, 0]);
    // Err(Domain(V1(NotConnected))).
    host.receive([...prefix, 2, 1, 1, 1, 0, 0, 0]);
    const result = await lookup;
    assert.equal(result.isErr(), true);
    assert.deepEqual(result.error, { tag: 'Domain', value: { tag: 'V1', value: { tag: 'NotConnected', value: undefined } } });
  } finally {
    transport.dispose();
  }
});
