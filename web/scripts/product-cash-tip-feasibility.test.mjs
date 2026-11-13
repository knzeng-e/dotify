import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decideCashWorkTip,
  inspectPaymentDeclarations,
  inspectPinnedPayments,
  interpretCashObservation,
  reportCashTipFeasibility
} from './product-cash-tip-feasibility.mjs';

const amount = 1250n; // Synthetic integer units; no asserted CASH display conversion.
const paymentId = '0x' + 'ab'.repeat(32);
const payee = '0x' + 'cd'.repeat(32);
const terms = {
  id: paymentId,
  payer: 'synthetic-payer',
  destination: payee,
  amount: amount.toString(),
  network: 'synthetic-network',
  asset: 'synthetic-asset',
  units: 'synthetic-unit',
  runtime: 'synthetic-runtime',
  work: 'synthetic-work'
};

// A server with a durable caller-id map models the audited newer contract, not
// an installed device. The legacy counterexample intentionally lacks that map.
function simulatedHost() {
  const requests = new Map();
  let sent = 0;
  return {
    get sent() {
      return sent;
    },
    request(input, { loseAck = false } = {}) {
      if (requests.has(input.id)) throw new Error('AlreadyExists');
      requests.set(input.id, { ...input, status: { tag: 'Processing' } });
      sent++;
      if (loseAck) throw new Error('Channel closed after acceptance');
    },
    finish(id, status) {
      requests.get(id).status = status;
    },
    lookup(id) {
      return requests.get(id)?.status ?? { tag: 'PaymentNotFound' };
    }
  };
}
function reserve(storage, intent) {
  const saved = storage.get(intent.id);
  if (saved && saved !== JSON.stringify(intent)) throw new Error('Intent binding changed');
  storage.set(intent.id, JSON.stringify(intent));
}
function restore(storage, id, expected) {
  const saved = JSON.parse(storage.get(id));
  assert.deepEqual(saved, expected, 'Payer/payee/work/asset/network binding mismatch');
  return saved;
}

test('actual pinned API has an opaque response id and no caller-id recovery contract', async () => {
  const actual = await inspectPinnedPayments();
  assert.equal(actual.host, '0.28.0');
  assert.equal(actual.protocol, '0.25.0');
  assert.equal(actual.callerChosenId, false);
  assert.deepEqual(actual.requestParameterTypes, ['bigint', 'HexString', 'number']);
  assert.deepEqual(actual.statusTags, ['Completed', 'Failed', 'Processing']);
  assert.deepEqual(actual.statusLookupFields, ['paymentId']);
  assert.ok(decideCashWorkTip(actual).blockers.includes('pinned-api-cannot-recover-a-lost-request-id'));
});

test('newer declaration shape removes only the caller-id blocker, never the other gates', () => {
  const surface = inspectPaymentDeclarations(
    'interface PaymentRequest { id: HexString; amount: bigint; destination: HexString; } interface PaymentManager { requestPayment(request: PaymentRequest): Promise<void>; }',
    `
    interface HostPaymentRequest { from?: number; amount: bigint; destination: HexString; id: HexString; }
    type HostPaymentError = { tag: "AlreadyExists" } | { tag: "Rejected" };
    type HostPaymentStatusSubscribeItem = { tag: "Completed" } | { tag: "ClaimedPartially"; value: { actualClaimed: bigint } };
    interface HostPaymentStatusSubscribeRequest { id: HexString; }
  `
  );
  const decision = decideCashWorkTip(surface);
  assert.equal(surface.callerChosenId, true);
  assert.equal(decision.blockers.length, 3);
  assert.equal(decision.decision, 'no-go');
});

test('legacy lost acknowledgement leaves no recoverable Host id despite a saved local intent', () => {
  const storage = new Map();
  reserve(storage, terms);
  const legacyHost = new Map([['unreturned-host-id', { tag: 'Completed' }]]);
  const recovered = restore(storage, terms.id, terms);
  assert.equal(legacyHost.get(recovered.id), undefined);
  assert.equal(interpretCashObservation('payment', { tag: 'PaymentNotFound' }, amount).allowNewPayment, false);
});

test('caller id reserved before approval survives lost ack and tab restart without resending', () => {
  const storage = new Map();
  const host = simulatedHost();
  reserve(storage, terms);
  assert.throws(() => host.request(terms, { loseAck: true }), /Channel closed/);
  host.finish(paymentId, { tag: 'Completed' });
  const reloaded = restore(new Map(storage), paymentId, terms);
  const observation = interpretCashObservation('payment', host.lookup(reloaded.id), amount);
  assert.equal(host.sent, 1);
  assert.deepEqual(observation, { state: 'host-reported-complete', allowNewPayment: false, grantsAccess: false, verifiesWorkTip: false });
});

test('AlreadyExists is reconciled under the original id, never a fresh payment', () => {
  const host = simulatedHost();
  host.request(terms);
  assert.throws(() => host.request(terms), /AlreadyExists/);
  assert.equal(interpretCashObservation('payment', host.lookup(paymentId), amount).state, 'pending');
  assert.equal(host.sent, 1);
});

test('storage failure occurs before the simulated Host sees a request', () => {
  const host = simulatedHost();
  assert.throws(() => {
    reserve(
      {
        get: () => undefined,
        set: () => {
          throw new Error('Storage unavailable');
        }
      },
      terms
    );
    host.request(terms);
  });
  assert.equal(host.sent, 0);
});

test('recovery rejects changed payer, recipient, amount, asset units, network, runtime or work', () => {
  const storage = new Map();
  reserve(storage, terms);
  for (const key of ['payer', 'destination', 'amount', 'asset', 'units', 'network', 'runtime', 'work']) {
    assert.throws(() => restore(storage, paymentId, { ...terms, [key]: 'changed' }), /binding mismatch/);
    assert.throws(() => reserve(storage, { ...terms, [key]: 'changed' }), /binding changed/);
  }
});

test('partial payment, missing status, failure and malformed partial amounts never allow repayment', () => {
  for (const event of [
    { tag: 'ClaimedPartially', value: { actualClaimed: 1000n } },
    { tag: 'PaymentNotFound' },
    { tag: 'Failed', value: { reason: 'unknown failure stage' } },
    { tag: 'ClaimedPartially', value: { actualClaimed: amount + 1n } }
  ]) {
    const observation = interpretCashObservation('payment', event, amount);
    assert.equal(observation.allowNewPayment, false);
    assert.equal(observation.grantsAccess, false);
    assert.equal(observation.verifiesWorkTip, false);
  }
  assert.equal(interpretCashObservation('payment', { tag: 'ClaimedPartially', value: { actualClaimed: 1000n } }, amount).state, 'partial');
});

test('CoinPayment clearing references preserve partial outcomes without becoming work-tip proof', () => {
  const reference = { root: 'synthetic-root', leaves: [['synthetic-coin', 'synthetic-tx']] };
  const partial = { tag: 'Failed', value: { cleared: 500, reference } };
  assert.equal(interpretCashObservation('coinPayment', partial, amount).state, 'partial');
  const done = interpretCashObservation('coinPayment', { tag: 'Done', value: { cleared: 1250, reference } }, amount);
  assert.equal(done.state, 'clearing-reported-complete');
  assert.equal(done.verifiesWorkTip, false);
  assert.equal(done.grantsAccess, false);
  assert.deepEqual(partial.value.reference, reference);
  assert.equal(
    interpretCashObservation('coinPayment', { tag: 'Done', value: { cleared: Number.MAX_SAFE_INTEGER + 1, reference } }, amount).state,
    'invalid-observation'
  );
});

test('offline report enables no rail and calls no Host, network, signer or payment', async () => {
  const report = await reportCashTipFeasibility();
  assert.equal(report.decision, 'no-go');
  for (const field of ['hostMethodsCalled', 'networkCalls', 'paymentsSubmitted']) assert.equal(report[field], 0);
  assert.equal(report.cashEnabled, false);
  assert.equal(report.nativePasChanged, false);
});

test('a newer wire declaration cannot hide an older SDK method or an optional id', () => {
  const protocol = 'interface HostPaymentRequest { id: HexString; } type HostPaymentError = { tag: "AlreadyExists" };';
  const legacy = inspectPaymentDeclarations(
    'interface PaymentManager { requestPayment(amount: bigint, destination: HexString): Promise<{ id: string }>; }',
    protocol
  );
  assert.equal(legacy.protocolCallerChosenId, true);
  assert.equal(legacy.sdkCallerChosenId, false);
  assert.equal(legacy.callerChosenId, false);
  const optional = inspectPaymentDeclarations(
    'interface PaymentRequest { id?: HexString; } interface PaymentManager { requestPayment(request: PaymentRequest): Promise<void>; }',
    protocol
  );
  assert.equal(optional.callerChosenId, false);
});
