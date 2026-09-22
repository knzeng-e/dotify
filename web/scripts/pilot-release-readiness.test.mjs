import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluatePilotEvidence, parseArgs, PILOT_RELEASE_SCHEMA_VERSION } from './pilot-release-readiness.mjs';

const CANDIDATE_SHA = '1234567890abcdef1234567890abcdef12345678';
const DEPLOYED_CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';
const OTHER_DEPLOYED_CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2C19Rhdm9zYgC5xA7a7H';
const CAPTURED_AT = '2026-09-13T12:00:00.000Z';
const REPORT_CONTEXT = {
  commit: CANDIDATE_SHA,
  productAppVersion: '[0, 1, 18]',
  pilotReleaseCid: DEPLOYED_CID,
  requirePilotReleaseCid: true,
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
        deployedCid: OTHER_DEPLOYED_CID,
        capturedAt: CAPTURED_AT
      }
    }),
    REPORT_CONTEXT
  );

  assert.equal(gates.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'fail');
  assert.equal(gates.find(gate => gate.id === 'go-no-go-record')?.status, 'fail');
});

test('pilot evidence rejects CID-shaped values that are not valid CIDs', () => {
  const gates = evaluatePilotEvidence(validPilotEvidence({ candidate: { ...validPilotEvidence().candidate, deployedCid: 'bafy0000000000000000' } }), {
    ...REPORT_CONTEXT,
    pilotReleaseCid: null,
    requirePilotReleaseCid: true
  });

  assert.equal(gates.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'fail');
});

test('pilot evidence rejects impossible join counts before computing the rate', () => {
  const gates = evaluatePilotEvidence(validPilotEvidence({ joinAttempts: { observed: 20, successful: 21 } }), REPORT_CONTEXT);

  assert.equal(gates.find(gate => gate.id === 'pilot-join-target')?.status, 'fail');
});

test('pilot evidence requires a separately supplied release-profile CID', () => {
  const missingBinding = evaluatePilotEvidence(validPilotEvidence(), {
    ...REPORT_CONTEXT,
    pilotReleaseCid: null
  });
  assert.equal(missingBinding.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'fail');
  assert.match(missingBinding.find(gate => gate.id === 'pilot-candidate-identity')?.detail ?? '', /--pilot-release-cid/);

  const validationBuildCid = OTHER_DEPLOYED_CID;
  const releaseBound = evaluatePilotEvidence(validPilotEvidence(), {
    ...REPORT_CONTEXT,
    pilotReleaseCid: DEPLOYED_CID,
    productSmokeCid: validationBuildCid,
    roomSmokeCid: validationBuildCid
  });
  assert.equal(releaseBound.find(gate => gate.id === 'pilot-candidate-identity')?.status, 'pass');
});

test('pilot release CID has its own CLI argument', () => {
  const args = parseArgs(['--pilot-release-cid', `ipfs://${DEPLOYED_CID}`]);
  assert.equal(args.pilotReleaseCid, `ipfs://${DEPLOYED_CID}`);
});
