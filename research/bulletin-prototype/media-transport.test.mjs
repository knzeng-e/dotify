import assert from 'node:assert/strict';
import test from 'node:test';
import { createPapiMediaTransport } from './media-transport.mjs';
import { rpcFixture, fixture } from '../../services/api/src/services/bulletinTransport.fixture.ts';
import { bulletinBytes } from '../../services/api/src/services/bulletinReceipt.ts';
const creator = () => {
  throw new Error('Offline transaction observer must not request a real signature');
};
const identity = fixture.identity;
const block = { cid: fixture.query.cid, codec: 0x70, bytes: bulletinBytes(fixture.raw, 512) };
const intent = { nonce: fixture.query.nonce, afterBlock: fixture.query.afterBlock };
const signal = () => new AbortController().signal;
function context({ signer = { account: identity.account, createTransaction: creator }, budget = { maxBytes: 1024, maxTransactions: 2 } } = {}) {
  const f = rpcFixture();
  let observer,
    subscriptions = 0,
    unsubscribed = 0,
    destroyed = 0;
  const calls = [];
  const client = {
    _request(method, params) {
      return f.request(method, params, signal());
    },
    destroy() {
      destroyed++;
    },
    getUnsafeApi() {
      return {
        tx: {
          TransactionStorage: {
            store_with_cid_config(args) {
              calls.push(args);
              return {
                createSubmitAndWatch(selected, options) {
                  assert.equal(selected, creator);
                  calls.push(options);
                  return {
                    subscribe(o) {
                      subscriptions++;
                      observer = o;
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
          }
        }
      };
    }
  };
  const session = createPapiMediaTransport({ client, identity, signer, budget });
  return {
    ...f,
    session,
    client,
    calls,
    get observer() {
      return observer;
    },
    get subscriptions() {
      return subscriptions;
    },
    get unsubscribed() {
      return unsubscribed;
    },
    get destroyed() {
      return destroyed;
    }
  };
}
const finalEvent = {
  type: 'finalized',
  ok: true,
  block: { number: fixture.receipt.block },
  events: [{ type: 'TransactionStorage', value: { type: 'Stored', value: { index: fixture.receipt.index } } }]
};
async function started(c) {
  while (!c.observer) await new Promise(r => setImmediate(r));
}
function clock(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Native AbortSignal.timeout does not use the mocked global timer.
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
}

test('store observation survives a 40-second finality delay while RPC reads remain short', async t => {
  clock(t);
  const c = context();
  t.after(c.session.close);
  const writing = c.session.transport.store(block, intent, signal());
  await started(c);
  t.mock.timers.tick(40_000);
  await new Promise(r => setImmediate(r));
  assert.equal(c.destroyed, 0);
  assert.equal(c.unsubscribed, 0);
  c.observer.next(finalEvent);
  assert.deepEqual(await writing, fixture.receipt);
  assert.equal(c.session.attemptedTransactions, 1);
});

test('a missing finality event remains bounded and cannot trigger another submission', async t => {
  clock(t);
  const c = context();
  t.after(c.session.close);
  const writing = assert.rejects(c.session.transport.store(block, intent, signal()), /Finality deadline/);
  await started(c);
  t.mock.timers.tick(90_000);
  await writing;
  assert.equal(c.unsubscribed, 1);
  assert.equal(c.session.attemptedTransactions, 1);
  await assert.rejects(c.session.transport.store(block, intent, signal()), /issued nonce/);
  assert.equal(c.subscriptions, 1);
});

test('an unresponsive read still times out at 25 seconds and closes its dedicated client', async t => {
  clock(t);
  const c = context({ signer: null });
  t.after(c.session.close);
  c.client._request = () => new Promise(() => {});
  const reading = assert.rejects(c.session.transport.status(signal()), { name: 'TimeoutError' });
  await new Promise(r => setImmediate(r));
  t.mock.timers.tick(25_000);
  await reading;
  assert.equal(c.destroyed, 1);
  assert.equal(c.session.attemptedTransactions, 0);
});

test('read-only PAPI composition recovers an actual historical receipt without touching a signer', async () => {
  const c = context({ signer: null });
  assert.equal(c.session.transport.writable, false);
  assert.deepEqual(await c.session.transport.lookupSubmission(fixture.query, signal()), fixture.receipt);
  assert.equal(c.subscriptions, 0);
  assert.equal(c.session.attemptedTransactions, 0);
  c.session.close();
  c.session.close();
  assert.equal(c.destroyed, 1);
});

test('explicit writer invokes one direct PAPI store with the reserved nonce and reconciles its position', async () => {
  const c = context();
  const writing = c.session.transport.store(block, intent, signal());
  await started(c);
  assert.equal(c.calls[0].cid.hashing.type, 'Blake2b256');
  assert.equal(c.calls[0].cid.codec, 0x70n);
  assert.deepEqual(c.calls[0].data, block.bytes);
  assert.deepEqual(c.calls[1], { nonce: fixture.query.nonce });
  c.observer.next({ ...finalEvent, type: 'inBestBlock' });
  assert.equal(c.unsubscribed, 0);
  c.observer.next(finalEvent);
  assert.deepEqual(await writing, fixture.receipt);
  assert.equal(c.session.attemptedTransactions, 1);
  assert.equal(c.unsubscribed, 1);
  await assert.rejects(c.session.transport.store(block, intent, signal()), /issued nonce/);
  assert.equal(c.subscriptions, 1);
  c.session.close();
});

test('cancellation unsubscribes a pending broadcast, destroys the dedicated client and never retries', async () => {
  const c = context(),
    abort = new AbortController();
  const result = assert.rejects(c.session.transport.store(block, intent, abort.signal), { name: 'AbortError' });
  await started(c);
  abort.abort();
  await result;
  assert.equal(c.unsubscribed, 1);
  assert.equal(c.destroyed, 1);
  assert.equal(c.session.attemptedTransactions, 1);
  await assert.rejects(c.session.transport.nextNonce(signal()), /closed/);
  assert.equal(c.subscriptions, 1);
});

test('aborting an unresponsive RPC closes its dedicated PAPI client and bounds waiting', async () => {
  let destroyed = 0;
  const client = {
    _request: () => new Promise(() => {}),
    destroy() {
      destroyed++;
    }
  };
  const c = createPapiMediaTransport({ client, identity, budget: { maxBytes: 1, maxTransactions: 1 } });
  const abort = new AbortController();
  const result = assert.rejects(c.transport.status(abort.signal), { name: 'AbortError' });
  await new Promise(r => setImmediate(r));
  abort.abort();
  await result;
  assert.equal(destroyed, 1);
  assert.equal(c.attemptedTransactions, 0);
});

test('concurrent reservations cannot bypass the immutable session budget or submit after a lost acknowledgement', async () => {
  const budget = { maxBytes: block.bytes.length, maxTransactions: 1 };
  const c = context({ budget });
  budget.maxBytes = 1000000;
  budget.maxTransactions = 100;
  const first = assert.rejects(c.session.transport.store(block, intent, signal()), /Lost acknowledgement/);
  await started(c);
  await assert.rejects(c.session.transport.store(block, { ...intent, nonce: intent.nonce + 1 }, signal()), /allowance exhausted/);
  c.observer.error(new Error('Lost acknowledgement'));
  await first;
  assert.equal(c.subscriptions, 1);
  assert.equal(c.session.attemptedTransactions, 1);
  await assert.rejects(c.session.transport.store(block, intent, signal()), /issued nonce/);
  c.session.close();
});

test('mismatched signer, absent budget and pre-cancelled requests fail before signing or RPC', async () => {
  const c = context({ signer: null });
  assert.throws(() =>
    createPapiMediaTransport({
      client: c.client,
      identity,
      signer: { account: 'other', createTransaction: creator },
      budget: { maxBytes: 1, maxTransactions: 1 }
    })
  );
  assert.throws(() => createPapiMediaTransport({ client: c.client, identity }));
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(c.session.transport.status(abort.signal), { name: 'AbortError' });
  assert.equal(c.calls.length, 0);
  assert.equal(c.subscriptions, 0);
  c.session.close();
});

test('the selected transaction creator is stable if the caller later edits its options', async () => {
  const signer = { account: identity.account, createTransaction: creator };
  const c = context({ signer });
  signer.account = 'other';
  signer.createTransaction = () => {
    throw new Error('Changed creator must never be selected');
  };
  const writing = c.session.transport.store(block, intent, signal());
  await started(c);
  c.observer.next(finalEvent);
  assert.deepEqual(await writing, fixture.receipt);
  c.session.close();
});
