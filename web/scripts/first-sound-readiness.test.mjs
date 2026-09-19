import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildFirstSoundReadinessReport, renderFirstSoundReadinessMarkdown, validateFirstSoundEvidence } from './first-sound-readiness.mjs';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';

function sample(id, overrides = {}) {
  return {
    id,
    surface: 'standalone-chrome',
    flow: 'free',
    outcome: 'first-audio',
    firstSoundMs: 800,
    capturedAt: '2026-09-19T12:00:00.000Z',
    dav2: {
      observed: true,
      fallback: false,
      hedged: false,
      intentPrefetched: false,
      decryptor: 'worker',
      firstRangeBytes: 262_160
    },
    ...overrides
  };
}

function evidence(samples, candidate = { gitSha: SHA, productAppVersion: '[0, 1, 25]', deployedCid: CID }) {
  return {
    schemaVersion: 1,
    candidate,
    capturedAt: '2026-09-19T12:05:00.000Z',
    samples,
    privacy: {
      walletAddressesCollected: false,
      mediaReferencesCollected: false,
      gatewayUrlsCollected: false,
      perListenerHistoryCollected: false
    }
  };
}

describe('first-sound readiness evidence', () => {
  it('reports measured budgets while keeping missing physical surfaces explicit', () => {
    const samples = [400, 700, 900, 1_200].map((firstSoundMs, index) => sample(`free-${index}`, { firstSoundMs }));
    const report = buildFirstSoundReadinessReport([{ path: 'chrome.json', data: evidence(samples) }], { expectedCommit: SHA });

    assert.equal(report.budgets.find(row => row.flow === 'free')?.p75Ms, 900);
    assert.equal(report.budgets.find(row => row.flow === 'free')?.status, 'pass');
    assert.equal(report.matrix.find(row => row.surface === 'standalone-chrome')?.status, 'pass');
    assert.equal(report.matrix.find(row => row.surface === 'ios-safari')?.status, 'not-run');
    assert.equal(report.gates.find(row => row.id === 'fallback-rate')?.status, 'not-run');
    assert.match(renderFirstSoundReadinessMarkdown(report), /5 pass/);
  });

  it('fails a performance budget and does not hide playback errors from the surface gate', () => {
    const samples = [1_500, 1_700, 1_900, 2_100].map((firstSoundMs, index) => sample(`free-${index}`, { firstSoundMs }));
    samples.push(sample('failed', { outcome: 'error', firstSoundMs: null }));
    const report = buildFirstSoundReadinessReport([{ path: 'chrome.json', data: evidence(samples) }], { expectedCommit: SHA });

    assert.equal(report.budgets.find(row => row.flow === 'free')?.status, 'fail');
    assert.equal(report.matrix.find(row => row.surface === 'standalone-chrome')?.status, 'fail');
  });

  it('rejects mixed candidates and duplicate samples', () => {
    const otherSha = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const report = buildFirstSoundReadinessReport(
      [
        { path: 'one.json', data: evidence([sample('same')]) },
        { path: 'two.json', data: evidence([sample('same')], { gitSha: otherSha, productAppVersion: '[0, 1, 25]', deployedCid: CID }) }
      ],
      { expectedCommit: SHA }
    );

    assert.equal(report.gates.find(row => row.id === 'candidate')?.status, 'fail');

    const duplicates = buildFirstSoundReadinessReport(
      [
        { path: 'one.json', data: evidence([sample('same')]) },
        { path: 'two.json', data: evidence([sample('same')]) }
      ],
      { expectedCommit: SHA }
    );
    assert.equal(duplicates.gates.find(row => row.id === 'sample-identity')?.status, 'fail');
  });

  it('rejects privacy flags, extra sample fields, and Product samples without deployment identity', () => {
    const leaked = evidence([{ ...sample('leaked'), walletAddress: '0x1234' }]);
    leaked.privacy.walletAddressesCollected = true;
    assert.deepEqual(validateFirstSoundEvidence(leaked), [
      'samples[0]: sample contains unknown or missing fields',
      'privacy flags must explicitly confirm that no identifying or media-reference data was collected'
    ]);

    const product = evidence([sample('product', { surface: 'product-desktop' })], { gitSha: SHA, productAppVersion: null, deployedCid: null });
    const report = buildFirstSoundReadinessReport([{ path: 'product.json', data: product }], { expectedCommit: SHA });
    assert.equal(report.gates.find(row => row.id === 'product-identity')?.status, 'fail');
  });

  it('requires enough DAV2 attempts before asserting the <1% fallback target', () => {
    const samples = Array.from({ length: 100 }, (_, index) => sample(`dav2-${index}`));
    const passing = buildFirstSoundReadinessReport([{ path: 'hundred.json', data: evidence(samples) }], { expectedCommit: SHA });
    assert.equal(passing.gates.find(row => row.id === 'fallback-rate')?.status, 'pass');

    samples[0] = sample('dav2-0', { dav2: { ...sample('template').dav2, fallback: true } });
    const failing = buildFirstSoundReadinessReport([{ path: 'hundred.json', data: evidence(samples) }], { expectedCommit: SHA });
    assert.equal(failing.gates.find(row => row.id === 'fallback-rate')?.status, 'fail');
  });
});
