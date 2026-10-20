import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experimentAssembler, experimentKeys, fragmentExperiment, runExperiment, syntheticSdp } from './celerity-feasibility.mjs';

test('actual SDK encoding reveals the account limit despite individually valid fragments', () => {
  const report = runExperiment();
  assert.ok(report.cases.every(item => item.maxEncodedFragmentBytes <= 512));
  assert.ok(report.cases.some(item => !item.fitsAccountWithoutOtherStatements));
});

test('encrypted fragments reorder, deduplicate, authenticate and never expose SDP', () => {
  const keys = experimentKeys();
  const text = syntheticSdp(16);
  const { fragments } = fragmentExperiment(text, keys.sender, 1000);
  assert.ok(fragments.length > 1);
  assert.ok(!JSON.stringify(fragments).includes('candidate:'));
  assert.ok(!JSON.stringify(fragments).includes('192.0.2.'));
  const receiver = experimentAssembler(keys.receiver);
  let result;
  for (const fragment of [...fragments].reverse()) {
    result = receiver.accept(fragment, 1000) ?? result;
    assert.equal(receiver.accept(fragment, 1000), null);
  }
  assert.equal(result, text);
  const corrupt = experimentAssembler(Buffer.alloc(32));
  assert.throws(() => fragments.forEach(fragment => corrupt.accept(fragment, 1000)));
});

test('lost fragments expire and retries cannot revive an expired incomplete message', () => {
  const keys = experimentKeys();
  const { fragments } = fragmentExperiment(syntheticSdp(16), keys.sender, 1000);
  const receiver = experimentAssembler(keys.receiver);
  assert.equal(receiver.accept(fragments[0], 1000), null);
  assert.equal(receiver.pending(10999), 1);
  assert.equal(receiver.pending(11000), 0);
  assert.throws(() => receiver.accept(fragments[0], 11000));
});
