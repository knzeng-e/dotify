// Read-only PAPI 3 integration probe: builds an invalid fake-signed extrinsic, never submits it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { getFakeTxCreator } from 'polkadot-api/tx-creator';
import { ENDPOINT, CANARY_ACCOUNT } from './live-transport.mjs';
import { GENESIS } from './graph.mjs';
const allowed = new Set([
  'rpc_methods',
  'chainSpec_v1_genesisHash',
  'chainSpec_v1_chainName',
  'chainSpec_v1_properties',
  ...['follow', 'unfollow', 'header', 'body', 'storage', 'call', 'stopOperation', 'continue', 'unpin'].map(name => `chainHead_v1_${name}`)
]);
export function readOnlyProvider(provider, methods = new Set()) {
  return onMessage => {
    const connection = provider(onMessage);
    return {
      send(message) {
        assert.ok(allowed.has(message.method), `Probe refused RPC method ${message.method}`);
        methods.add(message.method);
        connection.send(message);
      },
      disconnect: () => connection.disconnect()
    };
  };
}
export async function probe(client) {
  assert.equal(await client._request('chainSpec_v1_genesisHash', []), GENESIS, 'Wrong Bulletin network');
  const api = client.getUnsafeApi(),
    head = await client.getFinalizedBlock();
  const release = client.hodlBlock(head.hash);
  try {
    const nonce = await api.apis.AccountNonceApi.account_nonce(CANARY_ACCOUNT, { at: head.hash });
    assert.ok(Number.isSafeInteger(nonce) && nonce >= 0 && nonce <= 0xffffffff);
    const creator = getFakeTxCreator(CANARY_ACCOUNT);
    assert.equal(typeof creator, 'function');
    const tx = api.tx.TransactionStorage.store_with_cid_config({
      data: new Uint8Array([0]),
      cid: { codec: 85n, hashing: { type: 'Blake2b256', value: undefined } }
    });
    const encoded = await tx.create(creator, { nonce });
    assert.ok(encoded instanceof Uint8Array && encoded.length > 0);
    return {
      schema: 'dotify.bulletin.writer-probe.v1',
      papiVersion: '3.3.0',
      genesis: GENESIS,
      finalizedBlock: head.number,
      nonce,
      transactionCreator: 'getFakeTxCreator (invalid synthetic signature)',
      encodedBytes: encoded.length,
      encodedSha256: createHash('sha256').update(encoded).digest('hex'),
      realSignatures: 0,
      networkWrites: 0,
      storageQuotaConsumed: 0,
      limitation: 'Construction compatibility only; no dispatch or finality proof'
    };
  } finally {
    release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'This read-only probe accepts no signer or alternate network');
  const methods = new Set(),
    client = createClient(readOnlyProvider(getWsProvider(ENDPOINT), methods));
  let timer;
  try {
    const result = await Promise.race([
      probe(client),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Read-only probe exceeded 60 seconds')), 60_000);
      })
    ]);
    console.log(JSON.stringify({ ...result, endpoint: ENDPOINT, rpcMethods: [...methods].sort() }, null, 2));
  } catch (error) {
    console.error(String(error.message).slice(0, 400));
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    client.destroy();
  }
}
