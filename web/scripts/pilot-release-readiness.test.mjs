import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluatePilotEvidence, PILOT_RELEASE_SCHEMA_VERSION } from './pilot-release-readiness.mjs';

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
});

test('aggregate pilot evidence passes only with sample, task, privacy, rollback, and go/no-go facts', () => {
  const gates = evaluatePilotEvidence({
    schemaVersion: PILOT_RELEASE_SCHEMA_VERSION,
    participants: { artists: 3, hosts: 5, listeners: 20 },
    tasks: {
      publish: true,
      startRoom: true,
      joinFromLinkOrQr: true,
      recoverAfterInterruption: true,
      inspectSplit: true,
      supportArtist: true
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
    }
  });

  assert.equal(gates.filter(gate => gate.status === 'fail').length, 0);
  assert.equal(gates.find(gate => gate.id === 'pilot-join-target')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'rollback-rehearsal')?.status, 'pass');
  assert.equal(gates.find(gate => gate.id === 'go-no-go-record')?.status, 'pass');
});

test('pilot evidence rejects wallet-like addresses and raw identifiers', () => {
  const gates = evaluatePilotEvidence({
    schemaVersion: PILOT_RELEASE_SCHEMA_VERSION,
    participants: { artists: 3, hosts: 5, listeners: 20 },
    tasks: {},
    joinAttempts: { observed: 20, successful: 20 },
    privacy: {
      consentCaptured: true,
      aggregateOnly: true,
      continuousLocationCollected: false,
      walletLinkedListeningHistoryCollected: false,
      rawInterviewResponsesStored: false
    },
    rollback: { rehearsed: true, catalogKeyCompatibility: 'passed' },
    goNoGo: { decision: 'hold', prioritizedFixes: ['a', 'b', 'c'] },
    participantAddress: '0x1234567890123456789012345678901234567890'
  });

  assert.equal(gates.find(gate => gate.id === 'pilot-secret-hygiene')?.status, 'fail');
});
