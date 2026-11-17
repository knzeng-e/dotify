import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as current from '@parity/truapi';
import * as old25 from 'truapi-v0250';
import * as old26 from 'truapi-v0260';
import * as old29 from 'truapi-v0290';
import { installInfoPatch, patchInfoClient } from './patch-truapi-info.mjs';

const versions = [
  ['0.25', old25],
  ['0.26', old26],
  ['0.29', old29],
  ['0.31', current]
];
const account = { dotNsIdentifier: 'dotify-test01.dot', derivationIndex: { tag: 'Index', value: 0 } };
const key = `0x${'22'.repeat(32)}`;
const sig = `0x${'33'.repeat(64)}`;
const cases = [
  ['account', 'getAccount', [2, 1], 'VersionedHostAccountGet', { productAccountId: account }, { account: { publicKey: key } }],
  ['account', 'getUserId', [2, 5], 'VersionedHostGetUserId', undefined, { primaryUsername: 'artist.dot' }],
  [
    'signing',
    'signRaw',
    [13, 4],
    'VersionedHostSignRaw',
    { account, payload: { tag: 'Bytes', value: { bytes: '0x010203' } } },
    { signature: sig, signedTransaction: undefined }
  ],
  ['permissions', 'requestDevicePermission', [10, 0], 'VersionedHostDevicePermission', 'Location', { granted: false }],
  ['permissions', 'requestRemotePermission', [10, 1], 'VersionedRemotePermission', { permission: { tag: 'WebRtc', value: undefined } }, { granted: false }],
  [
    'permissions',
    'requestRemotePermission',
    [10, 1],
    'VersionedRemotePermission',
    { permission: { tag: 'Remote', value: { domains: ['https://api.example'] } } },
    { granted: true }
  ]
];
function wire() {
  const sent = [];
  let receive;
  const transport = current.createTransport({
    postMessage: frame => sent.push(frame),
    subscribe(callback) {
      receive = callback;
      return () => {};
    }
  });
  return { sent, transport, receive: frame => receive(frame) };
}
function value(result) {
  assert.equal(result.isOk(), true);
  return result.value;
}
function answer(api, request, bytes) {
  return value(api.encodeWireMessage({ requestId: request.requestId, payload: { ...request.payload, messageType: 1, value: bytes } }));
}
for (const [version, api] of versions) {
  for (const [group, method, address, codec, input, output] of cases) {
    test(`${version} fixture: ${group}.${method} preserves the exact request and response`, async () => {
      const host = wire();
      try {
        const pending = Promise.resolve(current.createClient(host.transport)[group][method](input));
        void pending.catch(() => {});
        const request = value(api.decodeWireMessage(host.sent[0]));
        assert.deepEqual([request.payload.traitId, request.payload.methodId], address);
        const decoded = api[`${codec}Request`].dec(request.payload.value);
        assert.deepEqual(decoded, { tag: 'V1', value: input });
        assert.deepEqual(api[`${codec}Request`].enc(decoded), request.payload.value);
        const payload = api.scale
          .Result(api[`${codec}Response`], api.scale.CallError(api[`${codec}Error`]))
          .enc({ success: true, value: { tag: 'V1', value: output } });
        host.receive(answer(api, request, payload));
        const result = await pending;
        assert.equal(result.isOk(), true);
        assert.deepEqual(result.value, output);
        assert.equal(host.sent.length, 1);
      } finally {
        host.transport.dispose();
      }
    });
  }
  test(`${version} fixture: public Host info decodes with an honest Runtime field`, async () => {
    const host = wire();
    try {
      const pending = Promise.resolve(current.createClient(host.transport).system.info());
      void pending.catch(() => {});
      const request = value(api.decodeWireMessage(host.sent[0]));
      const info = { platform: 'Desktop', name: 'Fixture Host', version: '1.0.0', truapiVersion: `${version}.0` };
      const payload = api.scale
        .Result(api.VersionedHostInfoResponse, api.scale.CallError(api.VersionedHostInfoError))
        .enc({ success: true, value: { tag: 'V1', value: info } });
      host.receive(answer(api, request, payload));
      const result = await pending;
      assert.equal(result.isOk(), true);
      assert.equal(result.value.truapiVersion, ['0.25', '0.26'].includes(version) ? '' : info.truapiVersion);
    } finally {
      host.transport.dispose();
    }
  });
  test(`${version} fixture: Bulletin preimage subscription preserves bytes and cancellation`, () => {
    const host = wire();
    try {
      const received = [];
      const sub = current
        .createClient(host.transport)
        .preimage.lookupSubscribe({ request: { key } })
        .subscribe({
          next: item => received.push(item),
          error: error => {
            throw error;
          }
        });
      const request = value(api.decodeWireMessage(host.sent[0]));
      assert.deepEqual([request.payload.traitId, request.payload.methodId], [11, 0]);
      assert.deepEqual(api.VersionedRemotePreimageLookupSubscribeRequest.dec(request.payload.value), { tag: 'V1', value: { key } });
      const payload = api.VersionedRemotePreimageLookupSubscribeItem.enc({ tag: 'V1', value: { value: '0x01020304' } });
      host.receive(answer(api, request, payload));
      assert.deepEqual(received, [{ value: '0x01020304' }]);
      sub.unsubscribe();
      const stop = value(api.decodeWireMessage(host.sent.at(-1)));
      assert.equal(stop.payload.messageType, 3);
      assert.equal(stop.requestId, request.requestId);
    } finally {
      host.transport.dispose();
    }
  });
}

test('latest transaction V2 is explicitly incompatible with legacy Hosts; no fallback encoding', () => {
  const payload = { signer: account, genesisHash: key, callData: '0x0102', extensions: [], txExtVersion: 0, contacts: [] };
  const bytes = current.VersionedHostCreateTransactionRequest.enc({ tag: 'V2', value: payload });
  for (const api of [old25, old26, old29]) assert.throws(() => api.VersionedHostCreateTransactionRequest.dec(bytes));
  assert.deepEqual(current.VersionedHostCreateTransactionRequest.dec(bytes), { tag: 'V2', value: payload });
});

for (const success of [true, false]) {
  test(`0.31 transaction V2 fixture: ${success ? 'signed result' : 'ChainUnavailable'} is preserved without a retry`, async () => {
    const host = wire();
    try {
      const input = { signer: account, genesisHash: key, callData: '0x0102', extensions: [], txExtVersion: 0, contacts: [] };
      const pending = Promise.resolve(current.createClient(host.transport).signing.createTransaction(input));
      void pending.catch(() => {});
      const request = value(current.decodeWireMessage(host.sent[0]));
      assert.deepEqual([request.payload.traitId, request.payload.methodId], [13, 0]);
      assert.deepEqual(current.VersionedHostCreateTransactionRequest.dec(request.payload.value), { tag: 'V2', value: input });
      const unavailable = { tag: 'Domain', value: { tag: 'V2', value: { tag: 'ChainUnavailable', value: { reason: 'synthetic chain halt' } } } };
      const output = success ? { success: true, value: { tag: 'V2', value: { transaction: '0x01020304' } } } : { success: false, value: unavailable };
      const payload = current.scale
        .Result(current.VersionedHostCreateTransactionResponse, current.scale.CallError(current.VersionedHostCreateTransactionError))
        .enc(output);
      host.receive(answer(current, request, payload));
      const result = await pending;
      if (success) assert.deepEqual(value(result), { transaction: '0x01020304' });
      else {
        assert.equal(result.isErr(), true);
        assert.deepEqual(result.error, unavailable);
      }
      assert.equal(host.sent.length, 1);
    } finally {
      host.transport.dispose();
    }
  });
}

test('info patch rejects malformed successes and preserves denials', async () => {
  const root = new URL('../node_modules/@parity/truapi/dist/generated/dotify-host-info.mjs', import.meta.url);
  const { decodeDotifyHostInfo } = await import(root.href);
  const codec = old26.scale.Result(old26.VersionedHostInfoResponse, old26.scale.CallError(old26.VersionedHostInfoError));
  const legacy = codec.enc({ success: true, value: { tag: 'V1', value: { platform: 'Ios', name: 'Phone', version: '1.0' } } });
  for (const bytes of [legacy.slice(0, -1), Uint8Array.from([...legacy, 4]), Uint8Array.from([...legacy, 8, 65])])
    assert.throws(() => decodeDotifyHostInfo(bytes));
  const denied = codec.enc({ success: false, value: { tag: 'Denied' } });
  assert.deepEqual(decodeDotifyHostInfo(denied), { success: false, value: { tag: 'Denied', value: undefined } });
  await installInfoPatch(); // idempotency verifies the installed client and helper
  const installed = await readFile(new URL('../node_modules/@parity/truapi/dist/generated/client.js', import.meta.url), 'utf8');
  assert.ok(installed.includes('decodeDotifyHostInfo(payload)'));
  assert.throws(() => patchInfoClient(installed + '\n'), /upstream client changed/);
});
