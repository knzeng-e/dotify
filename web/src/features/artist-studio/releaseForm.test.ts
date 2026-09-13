import { describe, expect, it } from 'vitest';
import {
  artistSetupState,
  buildReleasePublicationFacts,
  buildReleasePublicationRoadmap,
  buildReleaseRegistrationFailureMessage,
  buildReleaseValueFlowRows,
  formatRoyaltyPercent,
  artistStudioLocked,
  canReviewRelease,
  nextReleaseStep,
  previousReleaseStep,
  RELEASE_STEPS,
  releaseAccessConditionLabel,
  releasePaymentAmountLabel,
  royaltyBpsToPercent,
  royaltyPercentToBps,
  royaltySplitRemaining,
  royaltySplitTotal
} from './releaseForm';

describe('release step machine', () => {
  it('advances through the steps and clamps at the end', () => {
    expect(nextReleaseStep('assets')).toBe('metadata');
    expect(nextReleaseStep('metadata')).toBe('access');
    expect(nextReleaseStep('access')).toBe('review');
    expect(nextReleaseStep('review')).toBe('review');
  });

  it('goes back through the steps and clamps at the start', () => {
    expect(previousReleaseStep('review')).toBe('access');
    expect(previousReleaseStep('assets')).toBe('assets');
  });

  it('exposes the four steps in order', () => {
    expect(RELEASE_STEPS.map(step => step.id)).toEqual(['assets', 'metadata', 'access', 'review']);
  });
});

describe('canReviewRelease', () => {
  it('requires a file hash, a non-empty title, and an audio source', () => {
    expect(canReviewRelease({ fileHash: '0xabc', title: 'Song', audioSource: 'blob:x' })).toBe(true);
    expect(canReviewRelease({ fileHash: '', title: 'Song', audioSource: 'blob:x' })).toBe(false);
    expect(canReviewRelease({ fileHash: '0xabc', title: '   ', audioSource: 'blob:x' })).toBe(false);
    expect(canReviewRelease({ fileHash: '0xabc', title: 'Song', audioSource: null })).toBe(false);
  });
});

describe('royalty split helpers', () => {
  it('totals the artist share and additional right holders in bps', () => {
    const splits = [{ bps: 1500 }, { bps: 500 }];
    expect(royaltySplitTotal(7000, splits)).toBe(9000);
    expect(royaltySplitRemaining(7000, splits)).toBe(1000);
  });

  it('ignores invalid or negative draft values for display totals', () => {
    const splits = [{ bps: Number.NaN }, { bps: -25 }];
    expect(royaltySplitTotal(7000, splits)).toBe(7000);
  });

  it('converts internal bps to artist-facing percentages', () => {
    expect(royaltyBpsToPercent(7000)).toBe(70);
    expect(royaltyBpsToPercent(1234)).toBe(12.34);
    expect(royaltyPercentToBps(12.34)).toBe(1234);
    expect(formatRoyaltyPercent(7000)).toBe('70%');
    expect(formatRoyaltyPercent(1234)).toBe('12.34%');
  });
});

describe('artistSetupState', () => {
  it('walks wallet -> registration -> ready', () => {
    expect(artistSetupState(false, false)).toBe('Wallet needed');
    expect(artistSetupState(true, false)).toBe('Registration needed');
    expect(artistSetupState(true, true)).toBe('Ready');
  });
});

describe('artistStudioLocked', () => {
  it('locks only when registration is available but no runtime exists', () => {
    expect(artistStudioLocked(true, false)).toBe(true);
    expect(artistStudioLocked(true, true)).toBe(false);
    expect(artistStudioLocked(false, false)).toBe(false);
  });
});

describe('release publication disclosure helpers', () => {
  it('names the access condition and actual payment asset before publication', () => {
    expect(releasePaymentAmountLabel('classic', '0.75', 'PAS')).toBe('0.75 PAS');
    expect(releasePaymentAmountLabel('free', '0.75', 'PAS')).toBe('No listener payment');
    expect(releaseAccessConditionLabel('classic', '0.75', 'PAS', 'DIM1')).toContain('0.75 PAS');
    expect(releaseAccessConditionLabel('human-free', '0.75', 'PAS', 'DIM2')).toContain('extended human verification');
  });

  it('shows artist control, catalog read-back, and Bulletin state as publication facts', () => {
    const facts = buildReleasePublicationFacts({
      accessMode: 'classic',
      priceDot: '0.75',
      nativePaymentSymbol: 'PAS',
      personhoodLevel: 'DIM1',
      artistRecipient: '0x1111111111111111111111111111111111111111',
      runtimeAddress: '0x2222222222222222222222222222222222222222',
      uploadToBulletinEnabled: true
    });

    expect(facts).toContainEqual({ label: 'Controller', value: 'Artist wallet 0x111111...111111' });
    expect(facts).toContainEqual({ label: 'Runtime', value: '0x222222...222222', code: true });
    expect(facts).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Catalog visibility', value: expect.stringContaining('catalog read-back') })])
    );
    expect(facts).toContainEqual({ label: 'Public archive', value: 'Bulletin archival enabled' });
  });

  it('explains who receives support, including the artist remainder', () => {
    const rows = buildReleaseValueFlowRows({
      accessMode: 'classic',
      artistRecipient: '0x1111111111111111111111111111111111111111',
      primaryBps: 7250,
      additionalSplits: [
        {
          id: 'producer',
          label: 'Producer',
          recipient: '0x2222222222222222222222222222222222222222',
          bps: 2000
        }
      ]
    });

    expect(rows).toEqual([
      { label: 'Artist share', value: '72.5% to 0x111111...111111' },
      { label: 'Producer', value: '20% to 0x222222...222222' },
      { label: 'Artist remainder', value: '7.5% also returns to 0x111111...111111' }
    ]);
  });

  it('keeps free releases out of paid split language', () => {
    expect(
      buildReleaseValueFlowRows({
        accessMode: 'free',
        artistRecipient: '0x1111111111111111111111111111111111111111',
        primaryBps: 7250,
        additionalSplits: []
      })
    ).toEqual([{ label: 'Artist wallet', value: '0x111111...111111 controls the release; no listener payment is collected.' }]);
  });

  it('builds a publication roadmap that does not treat tx submission as catalog visibility', () => {
    const txHash = `0x${'ab'.repeat(32)}` as const;
    const submitted = buildReleasePublicationRoadmap('registry', txHash);
    const catalog = buildReleasePublicationRoadmap('catalog', txHash);
    const complete = buildReleasePublicationRoadmap('complete', txHash);

    expect(submitted?.map(step => step.status)).toEqual(['complete', 'complete', 'submitted', 'upcoming']);
    expect(catalog?.map(step => step.status)).toEqual(['complete', 'complete', 'complete', 'active']);
    expect(complete?.every(step => step.status === 'complete')).toBe(true);
  });

  it('distinguishes recoverable draft failures from submitted transactions awaiting catalog evidence', () => {
    const draftFailure = buildReleaseRegistrationFailureMessage({ error: 'User rejected the request.' });
    const catalogFailure = buildReleaseRegistrationFailureMessage({
      error: 'The catalog read-back did not include this release yet.',
      submittedTxHash: `0x${'ab'.repeat(32)}`
    });

    expect(draftFailure).toContain('No release was published');
    expect(draftFailure).toContain('can be retried from this draft');
    expect(catalogFailure).toContain('transaction was submitted');
    expect(catalogFailure).toContain('will not mark the release as published');
  });
});
