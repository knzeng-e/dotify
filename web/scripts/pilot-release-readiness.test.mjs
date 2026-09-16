import assert from 'node:assert/strict';
import test from 'node:test';

import { evidenceDeployedCid, evaluatePilotEvidence, PILOT_RELEASE_SCHEMA_VERSION } from './pilot-release-readiness.mjs';

const CANDIDATE_SHA = '1234567890abcdef1234567890abcdef12345678';
const DEPLOYED_CID = 'bafybeigdyrztxylm7b6f3v7uxx4pjv7k4n3m5q2p4w6r8t9y0abcde';
const CAPTURED_AT = '2026-09-13T12:00:00.000Z';
const REPORT_CONTEXT = {
  commit: CANDIDATE_SHA,
  productAppVersion: '[0, 1, 18]',
  deployedCid: DEPLOYED_CID,
  generatedAt: '2026-09-13T12:05:00.000Z'
};

function validPilotEvidence(overrides = {}) {
  return {
    schemaVersion: PILOT_RELEASE_SCHEMA_VERSION,
    candidate: {
      gitSha: CANDIDATE_SHA,
      productAppVersion: '[0, 1, 18]',
      deployedCid: DEPLOYED_CID,
      capturedAt: CAPTURED_AT
    },
    participants: { artists: 3, hosts: 5, listeners: 20 },
    tasks: {
      publish: true,
      startRoom: true,
      joinFromLinkOrQr: true,
      recoverAfterInterruption: true,
      inspectSplit: true,
      supportArtist: true
    },
    outcomeMetrics: {
      timeToFirstSoundSeconds: { median: 1.8, p95: 3.4, sampleSize: 20 },
      recoveryTimeSeconds: { median: 4.2, sampleSize: 7 },
      supportCompletion: { completed: 8, failed: 1, failureCategories: { userCanceled: 1 } },
      understanding: { artistControlYes: 18, artistControlNo: 2, valueFlowYes: 17, valueFlowNo: 3 }
    },
    joinAttempts: { observed: 20, successful: 19 },
    privacy: {
      consentCaptured: true,
      aggregateOnly: true,
      continuousLocationCollected: false,
      walletLinkedListeningHistoryCollected: false,
      rawInterviewResponsesStored: false
    },
    rollback: { rehearsed: true, catalogKeyCompatibility: 'passed' },
    goNoGo: {
      decision: 'hold',
      prioritizedFixes: ['Improve first-sound time', 'Document Product host limits', 'Rehearse support retry']
    },
    ...overrides
  };
}

test('missing pilot evidence keeps live gates visible without failing local readiness', () => {
  const gates = evaluatePilotEvidence(null);
  assert.equal(
    gates.some(gate => gate.status === 'fail'),
    false
  );
  assert.equal(
    gates.some(gate => gate.id === 'pilot-join-target' && gate.status === 'not-run'),
    true
  );
  assert.equal(
    gates.some(gate => gate.id === 'rollback-rehearsal' && gate.status === 'blocked'),
    true
  );
  assert.equal(
    gates.some(gate => gate.id === 'pilot-candidate-identity' && gate.status === 'not-run'),
    true
  );
  assert.equal(
    gates.some(gate => gate.id === 'pilot-outcome-metrics' && gate.status === 'not-run'),
    true
  );
});

test('aggregate pilot evidence passes only with sample, task, privacy, rollback, and go/no-go facts', () => {
  const gates = evaluatePilotEvidence(validPilotEvidence(), REPORT_CONTEXT);

  assert.equal(gates.filter(gate => gate.status === 'fail').length, 0);
  assert.equal(gates.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'pilot-outcome-metrics')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'pilot-tasks')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'pilot-join-target')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'rollback-rehearsal')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'go-no-go-record')?.status, 'pass');
});

test('pilot evidence rejects sensitive field variants and raw identifiers', () => {
  for (const field of ['participantEmails', 'ipAddress', 'rawResponses', 'participantAddress']) {
    const gates = evaluatePilotEvidence(
      validPilotEvidence({ [field]: field === 'participantAddress' ? '0x1234567890123456789012345678901234567890' : ['raw'] }),
      REPORT_CONTEXT
    );

    assert.equal(gates.find(gate => gate.id === 'pilot-secret-hygiene')?.status, 'fail');
  }
});

test('pilot tasks require aggregate outcome metrics before passing', () => {
  const { outcomeMetrics, ...evidence } = validPilotEvidence();
  assert.equal(outcomeMetrics.timeToFirstSoundSeconds.sampleSize, 20);
  const gates = evaluatePilotEvidence(evidence, REPORT_CONTEXT);

  assert.equal(gates.find(gate => gate.id === 'pilot-outcome-metrics')?.status, 'not-run');
  assert.equal(gates.find(gate => gate.id === 'pilot-tasks')?.status, 'not-run');
});

test('pilot decision is rejected when candidate identity does not match the report', () => {
  const gates = evaluatePilotEvidence(
    validPilotEvidence({
      candidate: {
        gitSha: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
        productAppVersion: '[0, 1, 17]',
        deployedCid: 'bafybeidifferentcandidatecid000000000000000000000000',
        capturedAt: CAPTURED_AT
      }
    }),
    REPORT_CONTEXT
  );

  assert.equal(gates.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'fail');
  assert.equal(gates.find(gate => gate.id === 'go-no-go-record')?.status, 'fail');
});

test('pilot evidence rejects impossible join counts before computing the rate', () => {
  const gates = evaluatePilotEvidence(validPilotEvidence({ joinAttempts: { observed: 20, successful: 21 } }), REPORT_CONTEXT);

  assert.equal(gates.find(gate => gate.id === 'pilot-join-target')?.status, 'fail');
});

test('schema-v2 candidate CID is the only deployment identity used downstream', () => {
  const legacyOverride = 'bafybeilegacyoverride00000000000000000000000000000000000';
  assert.equal(
    evidenceDeployedCid({
      schemaVersion: 2,
      deployedCid: legacyOverride,
      candidate: { deployedCid: `ipfs://${DEPLOYED_CID}` },
      context: { deployedCid: legacyOverride, productExecutableCid: legacyOverride }
    }),
    DEPLOYED_CID
  );
  assert.equal(evidenceDeployedCid({ schemaVersion: 2, deployedCid: legacyOverride, context: { deployedCid: legacyOverride } }), null);
  assert.equal(evidenceDeployedCid({ schemaVersion: 1, candidate: { deployedCid: DEPLOYED_CID } }), null);
});
