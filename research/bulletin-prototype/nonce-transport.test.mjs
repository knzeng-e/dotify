import test from 'node:test';
import assert from 'node:assert/strict';
import { nonceTransport, watchFinalized } from './nonce-transport.mjs';
import { CANARY_ACCOUNT } from './live-transport.mjs';
import { GENESIS, buildDirectory } from './graph.mjs';
const TEST_CREATOR = () => {
  throw new Error('The fake transport must not invoke signing');
};
const stored = index => ({ type: 'TransactionStorage', value: { type: 'Stored', value: { index } } });
const finalized = index => ({ type: 'finalized', ok: true, block: { number: 100, index: 99 }, events: [stored(index)] });
function transaction(events) {
  let calls = 0,
    unsubscribed = 0;
  return {
    get calls() {
      return calls;
    },
    get unsubscribed() {
      return unsubscribed;
    },
    createSubmitAndWatch(signer, options) {
      assert.equal(signer, TEST_CREATOR);
      assert.deepEqual(options, { nonce: 17 });
      calls++;
      return {
        subscribe(observer) {
          events(observer);
          return {
            unsubscribe() {
              unsubscribed++;
            }
          };
        }
      };
    }
  };
}
test('nonced writer waits for finalized success and uses the Stored index, never the extrinsic index', async () => {
  let observer;
  const tx = transaction(o => {
    observer = o;
  });
  let settled = false;
  const writing = watchFinalized(tx, TEST_CREATOR, 17).then(r => {
    settled = true;
    return r;
  });
  observer.next({ ...finalized(3), type: 'inBestBlock' });
  await Promise.resolve();
  assert.equal(settled, false);
  observer.next(finalized(3));
  assert.deepEqual(await writing, { block: 100, index: 3 });
  assert.equal(tx.calls, 1);
  assert.equal(tx.unsubscribed, 1);
});
test('dispatch failure, absent/duplicate receipts, stream end, timeout and signer errors never retry', async () => {
  for (const event of [
    { ...finalized(0), ok: false },
    { ...finalized(0), events: [] },
    { ...finalized(0), events: [stored(0), stored(1)] },
    { ...finalized(0), events: [stored(-1)] }
  ]) {
    const tx = transaction(o => o.next(event));
    await assert.rejects(watchFinalized(tx, TEST_CREATOR, 17));
    assert.equal(tx.calls, 1);
    assert.equal(tx.unsubscribed, 1);
  }
  for (const events of [o => o.complete(), o => o.error(new Error('Rejected')), o => o.error(null), o => o.error(undefined), () => {}]) {
    const tx = transaction(events);
    await assert.rejects(watchFinalized(tx, TEST_CREATOR, 17, { timeoutMs: 5 }));
    assert.equal(tx.calls, 1);
    assert.equal(tx.unsubscribed, 1);
  }
});
async function fake() {
  const graph = await buildDirectory([{ path: 'a', bytes: Buffer.from('data') }]);
  let observer,
    auth = { expires_at: 10000, transactions_used: 0, transactions_allowance: 10, bytes_used: 0n, bytes_allowance: 100n, bytes_permanent_used: 0n };
  const calls = [],
    snapshots = [];
  let released = 0,
    head = 100;
  const api = {
    query: { System: { BlockHash: { getValue: async () => GENESIS } } },
    apis: {
      BulletinTransactionStorageApi: { account_authorization: async () => auth },
      AccountNonceApi: {
        account_nonce: async (account, at) => {
          assert.equal(account, CANARY_ACCOUNT);
          snapshots.push(at);
          return 17;
        }
      }
    },
    tx: {
      TransactionStorage: {
        store_with_cid_config: args => {
          calls.push(args);
          return {
            createSubmitAndWatch(signer, options) {
              assert.equal(signer, TEST_CREATOR);
              calls.push(options);
              return {
                subscribe(o) {
                  observer = o;
                  return { unsubscribe() {} };
                }
              };
            }
          };
        }
      }
    }
  };
  return {
    graph,
    api,
    calls,
    snapshots,
    client: {
      getUnsafeApi: () => api,
      getFinalizedBlock: async () => ({ number: head, hash: 'finalized-test' }),
      hodlBlock: () => () => {
        released++;
      }
    },
    get observer() {
      return observer;
    },
    get released() {
      return released;
    },
    set auth(a) {
      auth = a;
    },
    get auth() {
      return auth;
    }
  };
}
test('nonce reads use a pinned finalized snapshot and direct calls bind data/hash/codec', async () => {
  const f = await fake();
  const t = nonceTransport(f.client, TEST_CREATOR, CANARY_ACCOUNT);
  assert.equal(await t.nextNonce(), 17);
  assert.deepEqual(f.snapshots, [{ at: 'finalized-test' }]);
  assert.equal(f.released, 1);
  const writing = t.store(f.graph.blocks[0], { nonce: 17 });
  while (!f.observer) await new Promise(r => setImmediate(r));
  assert.deepEqual(f.calls[0].data, f.graph.blocks[0].bytes);
  assert.equal(f.calls[0].cid.codec, 0x55n);
  assert.equal(f.calls[0].cid.hashing.type, 'Sha2_256');
  assert.deepEqual(f.calls[1], { nonce: 17 });
  f.observer.next(finalized(4));
  assert.deepEqual(await writing, { block: 100, index: 4 });
  await assert.rejects(t.store(f.graph.blocks[0], { nonce: 17 }), /already issued/);
  assert.equal(t.attemptedTransactions, 1);
});
test('concurrent reservations cannot consume the same lagging quota; finalized quota is not double-counted', async () => {
  const f = await fake();
  f.auth = { ...f.auth, bytes_allowance: 4n, transactions_allowance: 1 };
  const t = nonceTransport(f.client, TEST_CREATOR, CANARY_ACCOUNT);
  const writing = t.store(f.graph.blocks[0], { nonce: 17 });
  while (!f.observer) await new Promise(r => setImmediate(r));
  await assert.rejects(t.store(f.graph.blocks[0], { nonce: 18 }), /reserved attempts/);
  assert.equal(t.attemptedTransactions, 1);
  f.observer.next(finalized(4));
  await writing;
  // One newly granted block of quota, after the first is reflected in finalized counters.
  f.auth = { ...f.auth, bytes_used: 4n, bytes_allowance: 8n, transactions_used: 1, transactions_allowance: 2 };
  const again = t.store(f.graph.blocks[0], { nonce: 18 });
  while (f.calls.length < 4) await new Promise(r => setImmediate(r));
  f.observer.next(finalized(5));
  await again;
  assert.equal(t.attemptedTransactions, 2);
});
test('read-only mode and invalid nonces cannot reach transaction construction', async () => {
  const f = await fake();
  const t = nonceTransport(f.client, null, CANARY_ACCOUNT);
  for (const nonce of [undefined, -1, 1.2, 2 ** 32]) await assert.rejects(t.store(f.graph.blocks[0], { nonce }));
  await assert.rejects(t.store(f.graph.blocks[0], { nonce: 17 }), /local signer/);
  assert.equal(f.calls.length, 0);
});

test('PAPI 2 signer objects and unknown profiles fail before touching RPC or submission', () => {
  const client = {
    getUnsafeApi() {
      assert.fail('Incompatible signer must be rejected before RPC');
    }
  };
  const oldSigner = {
    publicKey: new Uint8Array(32),
    signTx() {
      assert.fail('No signing');
    }
  };
  assert.throws(() => nonceTransport(client, oldSigner, CANARY_ACCOUNT), /PAPI 3/);
  assert.throws(() => watchFinalized({}, oldSigner, 17), /PAPI 3/);
  assert.throws(() => nonceTransport(client, null, CANARY_ACCOUNT, { profile: 'unknown' }), /Unknown fixture/);
});
