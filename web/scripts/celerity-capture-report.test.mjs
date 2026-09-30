import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { reportCaptures } from './celerity-capture-report.mjs';

const cid = CID.createV1(0x55, create(0x12, new Uint8Array(32))).toString();
function capture(client, offsetMs) {
  return {
    version: 1,
    metadata: { run: 'synthetic-run', client, cid, device: 'synthetic', hostVersion: 'synthetic', network: 'synthetic' },
    buildSha: 'a'.repeat(40),
    sdk: '0.6.9',
    startedAt: 0,
    endedAt: 50_000,
    clocks: [{ at: 0, server: 'b'.repeat(32), offsetMs, uncertaintyMs: 26 }],
    frames: [],
    markers: [],
    pending: 0,
    dropped: 0
  };
}
function frame(stage, at, overrides = {}) {
  return {
    at,
    clock: 0,
    phase: 'baseline',
    kind: 'chat',
    stage,
    frame: 'c'.repeat(64),
    stream: 'd'.repeat(64),
    seq: 1,
    bytes: 300,
    ttlMs: 10_000,
    outOfOrder: false,
    ...overrides
  };
}
function pair() {
  const a = capture('A', 100);
  const b = capture('B', -100);
  a.frames.push(frame('attempt', 1000), frame('submitted', 1500));
  b.frames.push(frame('accepted', 1350), frame('duplicate', 1400));
  return { a, b };
}

test('correlates actual frames and accounts for clock uncertainty, not submit-response order', () => {
  const { a, b } = pair();
  const report = reportCaptures(a, b);
  assert.equal(report.completeCapture, true);
  const row = report.rows[0];
  assert.equal(row.attempts, 1);
  assert.equal(row.submitted, 1);
  assert.equal(row.accepted, 1);
  assert.equal(row.duplicateReceipts, 1);
  assert.equal(row.observationTrust, 'membership-authenticated-private');
  assert.deepEqual(row.attemptToObservation, {
    samples: 1,
    estimatedP50Ms: 150,
    estimatedP95Ms: 150,
    estimatedMaxMs: 150,
    minLowerBoundMs: 98,
    maxUpperBoundMs: 202,
    maxUncertaintyMs: 52
  });
});

test('keeps unknown submission, rejection and unobserved submission distinct', () => {
  const { a, b } = pair();
  for (const [hash, stage] of [
    ['e', null],
    ['f', 'rejected'],
    ['1', 'submitted']
  ]) {
    a.frames.push(frame('attempt', 2000, { frame: hash.repeat(64) }));
    if (stage) a.frames.push(frame(stage, 2100, { frame: hash.repeat(64) }));
  }
  let row = reportCaptures(a, b).rows[0];
  assert.equal(row.unknownSubmission, 1);
  assert.equal(row.rejected, 1);
  assert.equal(row.unobservedWithFullWindow, 1);
  b.endedAt = 5000;
  row = reportCaptures(a, b).rows[0];
  assert.equal(row.unobservedWithFullWindow, 0);
  assert.equal(row.unobservedWithoutFullWindow, 1);
});

test('records delivery despite unknown submission and phase changes during submit', () => {
  const { a, b } = pair();
  a.frames.pop();
  assert.equal(reportCaptures(a, b).rows[0].acceptedDespiteUnknownSubmission, 1);
  a.frames.push(frame('submitted', 1500, { phase: 'background' }));
  const report = reportCaptures(a, b);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].unknownSubmission, 0);
});

test('reports expiry and reordering separately and never invents missing latency', () => {
  const { a, b } = pair();
  b.frames[0].outOfOrder = true;
  b.frames[0].clock = null;
  b.frames.push(frame('expired', 15_000), frame('reordered', 16_000));
  let row = reportCaptures(a, b).rows[0];
  assert.equal(row.reorderedAccepted, 1);
  assert.equal(row.expiredReceipts, 1);
  assert.equal(row.replayWindowRejected, 1);
  assert.equal(row.missingClock, 1);
  assert.equal(row.attemptToObservation, null);
  b.frames[0].clock = 0;
  b.clocks[0].server = 'e'.repeat(32);
  assert.equal(reportCaptures(a, b).rows[0].missingClock, 1);
  b.clocks[0].server = a.clocks[0].server;
  b.clocks[0].offsetMs = -10_000;
  row = reportCaptures(a, b).rows[0];
  assert.equal(row.inconsistentClock, 1);
  assert.equal(row.attemptToObservation, null);
});

test('rejects mismatched candidates, malformed data, stale clocks and unfinished exports', () => {
  for (const mutate of [
    b => {
      b.metadata.run = 'another-run';
    },
    b => {
      b.metadata.client = 'A';
    },
    b => {
      b.buildSha = 'b'.repeat(40);
    },
    b => {
      b.metadata.cid = 'not-a-cid';
    },
    b => {
      b.endedAt = null;
    },
    b => {
      b.pending = 1;
    },
    b => {
      b.frames[0].bytes = 513;
    },
    b => {
      b.frames[0].clock = 4;
    },
    b => {
      b.frames[0].seq = -1;
    },
    b => {
      b.frames[0].stream = 'f'.repeat(64);
    },
    b => {
      b.unexpectedSecret = 'refuse';
    },
    b => {
      b.clocks[0].offsetMs = NaN;
    },
    b => {
      b.endedAt = 150_000;
      b.frames[0].at = 125_000;
    }
  ]) {
    const { a, b } = pair();
    mutate(b);
    assert.throws(() => reportCaptures(a, b));
  }
});

test('truncation and missing attempts remain explicit instead of producing success', () => {
  const { a, b } = pair();
  a.frames.shift();
  a.dropped = 1;
  const report = reportCaptures(a, b);
  assert.equal(report.completeCapture, false);
  assert.equal(report.clients[0].orphanSubmissionRecords, 1);
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.measuredPhases, []);
});
