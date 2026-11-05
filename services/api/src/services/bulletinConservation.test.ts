import test from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { assessBulletinConservation, type ConservationPlan, type ConservationSnapshot } from './bulletinConservation.js';
const cid = (n: number, code = 0x55, hashing = 0x12) => CID.createV1(code, create(hashing, new Uint8Array(32).fill(n))).toString();
const root = cid(1, 0x70),
  media = cid(2, 0x55, 0xb220),
  image = cid(3),
  second = cid(4, 0x70);
function fixture() {
  const identity = { genesis: '0x' + '1'.repeat(64), account: 'explicit-storage-account' };
  const plan: ConservationPlan = {
    schema: 'dotify.bulletin.conservation-plan.v1',
    identity,
    retainedReserve: { transactions: 10, bytes: '2000' },
    warningBlocks: 500,
    criticalBlocks: 100,
    sources: [
      {
        id: 'app:0.1.74',
        kind: 'application',
        root,
        blocks: [
          { cid: root, bytes: 100 },
          { cid: image, bytes: 200 }
        ]
      },
      {
        id: 'audio:pilot',
        kind: 'audio',
        root: second,
        blocks: [
          { cid: second, bytes: 100 },
          { cid: image, bytes: 200 },
          { cid: media, bytes: 300 }
        ]
      }
    ]
  };
  const snapshot: ConservationSnapshot = {
    schema: 'dotify.bulletin.conservation-snapshot.v1',
    identity,
    head: 1000,
    blockHash: '0x' + '2'.repeat(64),
    authorization: { expiresAt: 4000, remainingTransactions: 30, remainingRenewBytes: '9000' },
    observations: Object.fromEntries(
      plan.sources.flatMap(s => s.blocks.map(b => [b.cid, { state: 'present' as const, ...b, block: 1, index: 0, expiresAt: 3000 }]))
    )
  };
  return { plan, snapshot };
}
test('shared app/media blocks are checked once and the retained reserve never decreases', () => {
  const { plan, snapshot } = fixture(),
    before = JSON.stringify({ plan, snapshot });
  const r = assessBulletinConservation(plan, snapshot);
  assert.equal(r.uniqueBlocks, 4);
  assert.equal(r.severity, 'ok');
  assert.deepEqual(r.blocks.find(b => b.cid === image)?.sources, ['app:0.1.74', 'audio:pilot']);
  assert.deepEqual(r.requiredRenewalReserve, { transactions: 10, bytes: '2000' });
  assert.equal(r.writes, 0);
  assert.equal(r.bytesRetrievabilityTested, false);
  assert.equal(r.backupRestoreTested, false);
  assert.equal(JSON.stringify({ plan, snapshot }), before);
});
test('a fresh root cannot conceal a child near expiry', () => {
  const { plan, snapshot } = fixture();
  snapshot.observations[media] = { state: 'present', cid: media, bytes: 300, block: 1, index: 0, expiresAt: 1050 };
  const r = assessBulletinConservation(plan, snapshot);
  assert.equal(r.severity, 'critical');
  assert.equal(r.earliestBlockExpiry, 1050);
  assert.equal(r.accountSeverity, 'ok');
});
test('account permission and object retention have independent clocks', () => {
  const { plan, snapshot } = fixture();
  snapshot.authorization!.expiresAt = 1450;
  const r = assessBulletinConservation(plan, snapshot);
  assert.equal(r.severity, 'warning');
  assert.equal(r.accountSeverity, 'warning');
  assert.equal(r.earliestBlockExpiry, 3000);
  snapshot.authorization!.expiresAt = 1000;
  assert.equal(assessBulletinConservation(plan, snapshot).severity, 'critical');
});
test('both renewal counters must cover retained obligations', () => {
  const { plan, snapshot } = fixture();
  snapshot.authorization!.remainingTransactions = 9;
  assert.equal(assessBulletinConservation(plan, snapshot).quotaSufficient, false);
  snapshot.authorization!.remainingTransactions = 30;
  snapshot.authorization!.remainingRenewBytes = '1999';
  assert.equal(assessBulletinConservation(plan, snapshot).severity, 'critical');
  snapshot.authorization = null;
  assert.equal(assessBulletinConservation(plan, snapshot).accountExpiry, null);
});
test('missing, failed and absent reads never become green checks', () => {
  for (const value of [{ state: 'missing' as const }, { state: 'unavailable' as const }, undefined]) {
    const { plan, snapshot } = fixture();
    if (value) snapshot.observations[image] = value;
    else delete snapshot.observations[image];
    const r = assessBulletinConservation(plan, snapshot);
    assert.equal(r.severity, 'critical');
    assert.notEqual(r.blocks.find(b => b.cid === image)?.state, 'retained');
  }
});
test('expired and mismatched receipt metadata are explicit', () => {
  const { plan, snapshot } = fixture();
  snapshot.observations[media] = { state: 'present', cid: media, bytes: 300, block: 1, index: 0, expiresAt: 1000 };
  assert.equal(assessBulletinConservation(plan, snapshot).blocks.find(b => b.cid === media)?.state, 'expired');
  snapshot.observations[media] = { state: 'present', cid: image, bytes: 300, block: 1, index: 0, expiresAt: 3000 };
  assert.equal(assessBulletinConservation(plan, snapshot).blocks.find(b => b.cid === media)?.state, 'invalid');
});
test('wrong identity and inconsistent shared bytes are rejected', () => {
  const { plan, snapshot } = fixture();
  snapshot.identity = { ...snapshot.identity, account: 'other-account' };
  assert.throws(() => assessBulletinConservation(plan, snapshot), /identity differs/);
  snapshot.identity = plan.identity;
  plan.sources[1].blocks[1].bytes = 201;
  assert.throws(() => assessBulletinConservation(plan, snapshot), /byte counts differ/);
});
test('empty inventories, missing roots, invalid CIDs and inverted thresholds are rejected', () => {
  const { plan, snapshot } = fixture();
  assert.throws(() => assessBulletinConservation({ ...plan, criticalBlocks: 501 }, snapshot));
  assert.throws(() => assessBulletinConservation({ ...plan, sources: [] }, snapshot));
  const bad = structuredClone(plan);
  bad.sources[0].root = media;
  assert.throws(() => assessBulletinConservation(bad, snapshot));
  bad.sources[0].root = 'ipfs://not-a-cid';
  assert.throws(() => assessBulletinConservation(bad, snapshot));
});
test('known dependencies may raise but cannot lower the reserve floor', () => {
  const { plan, snapshot } = fixture();
  plan.retainedReserve = { transactions: 0, bytes: '0' };
  assert.deepEqual(assessBulletinConservation(plan, snapshot).requiredRenewalReserve, { transactions: 4, bytes: '700' });
});
