import assert from 'node:assert/strict';
import test from 'node:test';
import { protocols, probeHandshake, probeInfo, selectPair, compatibilityReport } from './compatibility.mjs';

for (const protocol of protocols) {
  test(`${protocol.version}: the same handshake succeeds without proving schema compatibility`, () => {
    const result = probeHandshake(protocol);
    assert.equal(result.codec, 3);
    assert.deepEqual(result.frames, [[4, 104, 1, 0, 1, 0, 0]]);
  });
  test(`${protocol.version}: a matched info response decodes`, async () => {
    const result = await probeInfo(protocol, protocol);
    assert.equal(result.decoded, true);
    assert.ok(result.fields.includes('version'));
  });
}

const latest = protocols.at(-1);
for (const older of protocols.slice(0, 2)) {
  test(`0.31 cannot decode ${older.version} info despite a matching codec number`, async () => {
    assert.equal(selectPair(latest, older).sameCodec, true);
    assert.equal(selectPair(latest, older).sameSchema, false);
    assert.equal((await probeInfo(latest, older)).decoded, false);
  });
  test(`${older.version} ignores the new trailing info field; this is only one method`, async () => {
    const result = await probeInfo(older, latest);
    assert.equal(result.decoded, true);
    assert.equal(result.fields.includes('truapiVersion'), false);
    assert.equal(selectPair(older, latest).cashEnabled, false);
  });
}

test('0.29 and 0.31 share info fields despite different whole-API fingerprints', async () => {
  const desktop = protocols[2];
  assert.equal(selectPair(latest, desktop).sameSchema, false);
  for (const [client, host] of [
    [latest, desktop],
    [desktop, latest]
  ]) {
    const info = await probeInfo(client, host);
    assert.equal(info.decoded, true);
    assert.equal(info.fields.includes('truapiVersion'), true);
    assert.equal(selectPair(client, host).cashEnabled, false);
  }
});

test('only exact schema pairs match; no matrix cell enables payments', async () => {
  const report = await compatibilityReport();
  assert.equal(new Set(report.protocols.map(p => p.schema)).size, 4);
  assert.equal(report.cells.length, 16);
  assert.equal(report.cells.filter(p => p.sameSchema).length, 4);
  assert.ok(report.cells.every(p => p.sameSchema === (p.client === p.fixtureHost)));
  assert.ok(report.cells.every(p => p.cashEnabled === false && p.paymentMethodsCalled === 0));
  assert.equal(report.liveHostMethodsCalled, 0);
  assert.equal(report.networkCalls, 0);
  assert.equal(report.paymentsSubmitted, 0);
});
