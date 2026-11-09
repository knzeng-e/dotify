import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTxCreator } from 'polkadot-api/tx-creator';
import { createPublicationTimings, timedBulletinTransport } from './bulletinTiming.js';
import { watchFinalized } from './bulletinFinality.js';
import { createPapiMediaTransport } from './bulletinPapiTransport.js';
import { fixture, rpcFixture } from './bulletinTransport.fixture.js';
import { bulletinBytes } from './bulletinReceipt.js';

test('overlapping durations are separate from wall time, bounded and snapshot-owned', async () => {
  let clock = 0;
  const timing = createPublicationTimings(() => clock);
  const a = timing.start('store');
  clock = 10;
  const b = timing.start('store');
  clock = 60;
  a();
  clock = 100;
  b();
  b(false);
  const snapshot = timing.snapshot('succeeded');
  assert.equal(snapshot.elapsedMs, 100);
  assert.deepEqual(snapshot.phases.store, { calls: 2, failures: 0, totalMs: 150, maxMs: 90, peakConcurrency: 2, inFlightAtReport: 0 });
  snapshot.phases.store!.calls = 999;
  assert.equal(timing.snapshot('succeeded').phases.store!.calls, 2);
  const failure = new Error('UNTRUSTED_ERROR_SECRET');
  await assert.rejects(
    timing.measure('lookup', async () => {
      clock = 120;
      throw failure;
    }),
    error => error === failure
  );
  const report = timing.snapshot('failed');
  assert.equal(report.phases.lookup!.failures, 1);
  assert.equal(report.elapsedMs, 120);
  assert(!JSON.stringify(report).includes('UNTRUSTED_ERROR_SECRET'));
  assert.equal(Object.keys(report.phases).length, 2);
});

test('instrumented reads preserve canonical proof, cancellation reason and exact RPC calls', async () => {
  const plain = rpcFixture(),
    observed = rpcFixture(),
    timing = createPublicationTimings();
  const timed = timedBulletinTransport(observed.transport, timing);
  const signal = new AbortController().signal;
  assert.deepEqual(await timed.lookupSubmission(fixture.query, signal), await plain.transport.lookupSubmission(fixture.query, signal));
  assert.deepEqual(observed.calls, plain.calls);
  assert.equal(timed.writable, false);
  const owner = new AbortController(),
    reason = new Error('PRIVATE_ABORT_REASON');
  owner.abort(reason);
  await assert.rejects(timed.lookup(fixture.query.cid, owner.signal), error => error === reason);
  const report = timing.snapshot('failed');
  assert.equal(report.phases.lookupSubmission!.calls, 1);
  assert.equal(report.phases.lookup!.failures, 1);
  for (const secret of [fixture.identity.account, fixture.query.cid, 'PRIVATE_ABORT_REASON']) assert(!JSON.stringify(report).includes(secret));
});

test('PAPI finality is measured inside the original one-shot store, never inferred from lookup', async () => {
  const f = rpcFixture();
  let clock = 0,
    submissions = 0,
    closed = 0;
  const timing = createPublicationTimings(() => clock);
  const client = {
    _request: (method: string, params: unknown[]) => {
      clock++;
      return f.request(method, params, new AbortController().signal);
    },
    destroy: () => {
      closed++;
    },
    getUnsafeApi: () => ({
      tx: {
        TransactionStorage: {
          store_with_cid_config: () => ({
            createSubmitAndWatch: (_signer: unknown, options: { nonce: number }) => ({
              subscribe(observer: { next: (event: unknown) => void }) {
                submissions++;
                assert.equal(options.nonce, fixture.query.nonce);
                queueMicrotask(() => {
                  clock += 15;
                  observer.next({ type: 'created', txHash: 'UNTRUSTED_HASH' });
                  clock += 5;
                  observer.next({ type: 'broadcasted', txHash: 'UNTRUSTED_HASH' });
                  clock += 60;
                  observer.next({ type: 'inBestBlock' });
                  clock += 4;
                  observer.next({ type: 'notInBestBlock' });
                  clock += 6;
                  observer.next({ type: 'inBestBlock' });
                  clock += 10;
                  observer.next({
                    type: 'finalized',
                    ok: true,
                    block: { number: fixture.receipt.block },
                    events: [{ type: 'TransactionStorage', value: { type: 'Stored', value: { index: fixture.receipt.index } } }]
                  });
                });
                return { unsubscribe() {} };
              }
            })
          })
        }
      }
    })
  } as unknown as Parameters<typeof createPapiMediaTransport>[0]['client'];
  const session = createPapiMediaTransport({
    client,
    identity: fixture.identity,
    budget: { maxTransactions: 2, maxBytes: 1024 * 1024 },
    timings: timing,
    signer: {
      account: fixture.identity.account,
      createTransaction: getTxCreator(new Uint8Array(32), 'Sr25519', () => {
        throw Error('Synthetic test never signs');
      })
    }
  });
  const receipt = await session.transport.store(
    { cid: fixture.query.cid, bytes: bulletinBytes(fixture.raw, 512), codec: 0x70 },
    fixture.query,
    new AbortController().signal
  );
  assert.equal(receipt.block, fixture.receipt.block);
  assert.equal(submissions, 1);
  const report = timing.snapshot('succeeded');
  assert.equal(report.phases.submitAndFinalize!.calls, 1);
  assert.equal(report.phases.submitAndFinalize!.totalMs, 100);
  assert.equal(report.phases.store!.calls, 1);
  assert(report.phases.store!.totalMs > 100);
  assert.equal(report.phases.lookup!.calls, 1);
  assert.deepEqual(report.milestones, {
    created: { observations: 1, totalMs: 15, maxMs: 15 },
    broadcasted: { observations: 1, totalMs: 20, maxMs: 20 },
    firstInclusion: { observations: 1, totalMs: 80, maxMs: 80 }
  });
  assert(!JSON.stringify(report).includes('UNTRUSTED_HASH'));
  assert.equal(session.attemptedTransactions, 1);
  session.close();
  assert.equal(closed, 1);
});

test('missing lifecycle events and unfinished calls stay unknown rather than fabricated', async () => {
  let clock = 0;
  const timing = createPublicationTimings(() => clock);
  const checkpoint = timing.transaction();
  assert.deepEqual(timing.snapshot('failed').milestones, {});
  let resolve!: () => void;
  const pending = timing.measure(
    'store',
    () =>
      new Promise<void>(done => {
        resolve = done;
      })
  );
  clock = 50;
  const incomplete = timing.snapshot('failed');
  assert.equal(incomplete.phases.store!.inFlightAtReport, 1);
  assert.equal(incomplete.phases.store!.totalMs, 0);
  checkpoint('firstInclusion');
  clock = 60;
  checkpoint('firstInclusion');
  assert.deepEqual(timing.snapshot('failed').milestones.firstInclusion, { observations: 1, totalMs: 50, maxMs: 50 });
  resolve();
  await pending;
  assert.equal(timing.snapshot('succeeded').phases.store!.inFlightAtReport, 0);
  assert.equal(incomplete.phases.store!.inFlightAtReport, 1, 'Reports are independent snapshots');
});

test('a throwing milestone observer cannot complete early or bypass failed finalized dispatch', async () => {
  for (const ok of [true, false]) {
    let observer!: { next(event: unknown): void },
      settled = false,
      unsubscribed = 0;
    const tx = {
      createSubmitAndWatch: () => ({
        subscribe(value: typeof observer) {
          observer = value;
          return {
            unsubscribe() {
              unsubscribed++;
            }
          };
        }
      })
    } as unknown as Parameters<typeof watchFinalized>[0];
    const signer = getTxCreator(new Uint8Array(32), 'Sr25519', () => {
      throw Error('No test signatures');
    });
    const pending = watchFinalized(tx, signer, 12, {
      onMilestone: () => {
        if (ok) return Promise.reject(Error('Async observer unavailable'));
        throw Error('Observer unavailable');
      }
    });
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    observer.next({ type: 'created' });
    observer.next({ type: 'broadcasted' });
    observer.next({ type: 'inBestBlock' });
    await Promise.resolve();
    assert.equal(settled, false);
    observer.next({ type: 'finalized', ok, block: { number: 10 }, events: [{ type: 'TransactionStorage', value: { type: 'Stored', value: { index: 0 } } }] });
    if (ok) assert.deepEqual(await pending, { block: 10, index: 0 });
    else await assert.rejects(pending, /dispatch did not succeed/);
    assert.equal(unsubscribed, 1);
  }
});
