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
    cacheState: 'cold',
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

function profile(surface = 'standalone-chrome', overrides = {}) {
  return {
    surface,
    device: surface === 'ios-safari' ? 'iPhone 13 Pro' : 'MacBook Pro 13-inch',
    os: surface === 'ios-safari' ? 'iOS 16.7' : 'macOS 15.6',
    browser: surface === 'ios-safari' ? 'Safari 16.6' : 'Chrome 140',
    productHostVersion: surface.startsWith('product-') ? 'Product Desktop 0.1.0' : null,
    connection: surface === 'ios-safari' ? 'mobile' : 'wifi',
    ...overrides
  };
}

function evidence(samples, candidate = { gitSha: SHA, productAppVersion: '[0, 1, 25]', deployedCid: CID }, profileOverrides = {}) {
  const surface = samples[0]?.surface ?? 'standalone-chrome';
  return {
    schemaVersion: 2,
    candidate,
    profile: profile(surface, profileOverrides),
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

    assert.equal(report.budgets.find(row => row.flow === 'free' && row.cacheState === 'cold')?.p75Ms, 900);
    assert.equal(report.budgets.find(row => row.flow === 'free' && row.cacheState === 'cold')?.status, 'pass');
    assert.equal(
      report.profileBudgets.find(
        row => row.profile.surface === 'standalone-chrome' && row.profile.device === 'MacBook Pro 13-inch' && row.flow === 'free' && row.cacheState === 'cold'
      )?.status,
      'pass'
    );
    assert.equal(report.matrix.find(row => row.surface === 'standalone-chrome')?.status, 'pass');
    assert.equal(report.matrix.find(row => row.surface === 'ios-safari')?.status, 'not-run');
    assert.equal(report.gates.find(row => row.id === 'fallback-rate')?.status, 'not-run');
    assert.match(renderFirstSoundReadinessMarkdown(report), /standalone-chrome/);
  });

  it('does not let fast desktop samples hide a slow required surface', () => {
    const chromeSamples = Array.from({ length: 12 }, (_, index) => sample(`chrome-${index}`, { firstSoundMs: 400 + index * 10 }));
    const iosSamples = Array.from({ length: 4 }, (_, index) => sample(`ios-${index}`, { surface: 'ios-safari', firstSoundMs: 4_000 + index * 100 }));
    const report = buildFirstSoundReadinessReport(
      [
        { path: 'chrome.json', data: evidence(chromeSamples) },
        { path: 'ios.json', data: evidence(iosSamples) }
      ],
      { expectedCommit: SHA }
    );

    assert.equal(report.budgets.find(row => row.flow === 'free' && row.cacheState === 'cold')?.status, 'pass');
    assert.equal(
      report.profileBudgets.find(row => row.profile.surface === 'standalone-chrome' && row.flow === 'free' && row.cacheState === 'cold')?.status,
      'pass'
    );
    assert.equal(report.profileBudgets.find(row => row.profile.surface === 'ios-safari' && row.flow === 'free' && row.cacheState === 'cold')?.status, 'fail');
  });

  it('never pools different profiles on one surface to satisfy a budget', () => {
    const mixedProfiles = Array.from({ length: 4 }, (_, index) => ({
      path: `chrome-${index}.json`,
      data: evidence([sample(`chrome-${index}`)], undefined, { device: `MacBook profile ${index + 1}` })
    }));
    const mixedReport = buildFirstSoundReadinessReport(mixedProfiles, { expectedCommit: SHA });

    assert.equal(mixedReport.budgets.find(row => row.flow === 'free' && row.cacheState === 'cold')?.status, 'pass');
    const mixedProfileBudgets = mixedReport.profileBudgets.filter(
      row => row.profile.surface === 'standalone-chrome' && row.flow === 'free' && row.cacheState === 'cold'
    );
    assert.equal(mixedProfileBudgets.length, 4);
    assert.ok(mixedProfileBudgets.every(row => row.samples === 1 && row.status === 'not-run'));

    const sameProfileReport = buildFirstSoundReadinessReport(
      Array.from({ length: 4 }, (_, index) => ({ path: `same-${index}.json`, data: evidence([sample(`same-${index}`)]) })),
      { expectedCommit: SHA }
    );
    const sameProfileBudget = sameProfileReport.profileBudgets.find(
      row => row.profile.surface === 'standalone-chrome' && row.flow === 'free' && row.cacheState === 'cold'
    );
    assert.equal(sameProfileBudget?.samples, 4);
    assert.equal(sameProfileBudget?.status, 'pass');
  });

  it('fails a performance budget and does not hide playback errors from the surface gate', () => {
    const samples = [1_500, 1_700, 1_900, 2_100].map((firstSoundMs, index) => sample(`free-${index}`, { firstSoundMs }));
    samples.push(sample('failed', { outcome: 'error', firstSoundMs: null }));
    const report = buildFirstSoundReadinessReport([{ path: 'chrome.json', data: evidence(samples) }], { expectedCommit: SHA });

    assert.equal(report.budgets.find(row => row.flow === 'free' && row.cacheState === 'cold')?.status, 'fail');
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

  it('combines standalone and Product exports for one commit while keeping Product identity strict', () => {
    const standalone = evidence([sample('standalone')], { gitSha: SHA, productAppVersion: null, deployedCid: null });
    const product = evidence([sample('product', { surface: 'product-desktop' })]);
    const combined = buildFirstSoundReadinessReport(
      [
        { path: 'standalone.json', data: standalone },
        { path: 'product.json', data: product }
      ],
      { expectedCommit: SHA }
    );

    assert.equal(combined.gates.find(row => row.id === 'candidate')?.status, 'pass');
    assert.equal(combined.gates.find(row => row.id === 'product-identity')?.status, 'pass');
    assert.equal(combined.gates.find(row => row.id === 'sample-identity')?.detail, '2 unique samples.');

    const otherProduct = evidence([sample('other-product', { surface: 'product-web-gateway' })], {
      gitSha: SHA,
      productAppVersion: '[0, 1, 26]',
      deployedCid: CID
    });
    const mismatchedProduct = buildFirstSoundReadinessReport(
      [
        { path: 'product.json', data: product },
        { path: 'other-product.json', data: otherProduct }
      ],
      { expectedCommit: SHA }
    );
    assert.equal(mismatchedProduct.gates.find(row => row.id === 'product-identity')?.status, 'fail');
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

  it('requires a sanitized device and network profile and renders it in the report', () => {
    const invalid = evidence([sample('invalid')], undefined, { device: 'line one\nline two' });
    assert.match(validateFirstSoundEvidence(invalid).join('; '), /profile.device/);

    const report = buildFirstSoundReadinessReport([{ path: 'ios.json', data: evidence([sample('ios', { surface: 'ios-safari' })]) }], { expectedCommit: SHA });
    assert.match(renderFirstSoundReadinessMarkdown(report), /iPhone 13 Pro/);
    assert.match(renderFirstSoundReadinessMarkdown(report), /iOS 16\.7/);
    assert.match(renderFirstSoundReadinessMarkdown(report), /mobile/);
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
