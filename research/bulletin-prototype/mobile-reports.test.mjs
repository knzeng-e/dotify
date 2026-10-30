import test from 'node:test';
import assert from 'node:assert/strict';
import { reportJournal, safeReport, REPORT_KEY, MAX_HISTORY_BYTES } from './mobile/reports.mjs';
const attempt = id => ({ schema: 'dotify.bulletin.host-report.v1', id, outcome: 'playing', events: [], reads: [] });
const memory = () => {
  const values = new Map();
  return { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
};
test('report history survives reload, updates one attempt, bounds five attempts and explicitly clears', () => {
  const store = memory(),
    journal = reportJournal(store);
  for (let i = 0; i < 6; i++) journal.save(attempt(`id-${i}`));
  journal.save({ ...attempt('id-5'), outcome: 'ended' });
  const restored = reportJournal(store).list();
  assert.equal(restored.length, 5);
  assert.equal(restored[0].id, 'id-1');
  assert.equal(restored.at(-1).outcome, 'ended');
  restored[0].outcome = 'mutated';
  assert.equal(journal.list()[0].outcome, 'playing');
  assert.equal(restored[1].outcome, 'interrupted');
  assert.equal(restored[1].lastObservedOutcome, 'playing');
  assert.equal(restored[1].recoveredAfterReload, true);
  journal.clear();
  assert.equal(store.getItem(REPORT_KEY), undefined);
});
test('reports exclude keys and arbitrary metadata and never turn a playing event into audible proof', () => {
  const report = safeReport({
    ...attempt('test'),
    key: 'SECRET',
    scope: { secret: 'SECRET' },
    audioProof: { key: 'SECRET' },
    implementation: { sha: 'abc', key: 'SECRET' },
    events: [{ name: 'playing', key: 'SECRET' }],
    reads: [{ cid: 'public', key: 'SECRET' }],
    metrics: [{ key: 'SECRET' }],
    audibleFirstSoundMeasured: true,
    productionAccessTested: true
  });
  assert.ok(!JSON.stringify(report).includes('SECRET'));
  assert.equal(report.audibleFirstSoundMeasured, false);
  assert.equal(report.productionAccessTested, false);
  assert.throws(() => safeReport({ schema: 'unknown' }));
});
test('corrupt, oversized or blocked storage does not interrupt recording in memory', () => {
  for (const value of ['not json', 'x'.repeat(256 * 1024 + 1), JSON.stringify([{}])]) {
    let warnings = 0;
    const journal = reportJournal(
      {
        getItem: () => value,
        setItem: () => {
          throw new Error('Quota');
        },
        removeItem: () => {
          throw new Error('Blocked');
        }
      },
      () => warnings++
    );
    assert.deepEqual(journal.list(), []);
    journal.save(attempt('new'));
    assert.equal(journal.list().length, 1);
    journal.clear();
    assert.equal(warnings, 3);
  }
});

test('verbose evidence cannot make the persisted notebook exceed its byte bound', () => {
  const store = memory(),
    journal = reportJournal(store);
  for (let i = 0; i < 5; i++)
    journal.save({
      ...attempt(`large-${i}`),
      events: Array.from({ length: 200 }, () => ({ name: 'x'.repeat(400), at: 'x'.repeat(400) })),
      reads: Array.from({ length: 100 }, () => ({ cid: 'x'.repeat(400) }))
    });
  assert.ok(new TextEncoder().encode(store.getItem(REPORT_KEY)).byteLength <= MAX_HISTORY_BYTES);
  assert.ok(reportJournal(store).list().length > 0);
});

test('continuity evidence preserves bounded progress and human network markers without private metadata', () => {
  const safe = safeReport({
    ...attempt('continuity'),
    fixtureProfile: 'continuity',
    fixtureDurationSeconds: 64,
    attemptLimitMs: 180000,
    firstPlayingLimitMs: 45000,
    events: [
      { name: 'progress', mediaSeconds: 36, bufferedUntilMediaSeconds: 60, key: 'secret' },
      { name: 'network-switch-marked', mediaSeconds: 40, networkNote: 'x'.repeat(200), secret: 'secret' }
    ],
    reads: [{ cid: 'test', bytes: 48000, elapsedMs: 30, attemptElapsedMs: 36000, mediaSeconds: 35, key: 'secret' }]
  });
  assert.equal(safe.fixtureDurationSeconds, 64);
  assert.equal(safe.events[0].bufferedUntilMediaSeconds, 60);
  assert.equal(safe.events[1].networkNote.length, 160);
  assert.equal(safe.reads[0].mediaSeconds, 35);
  assert.equal(safe.reads[0].attemptElapsedMs, 36000);
  assert.ok(!JSON.stringify(safe).includes('secret'));
});
