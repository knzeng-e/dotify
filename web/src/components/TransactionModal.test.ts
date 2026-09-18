import { describe, expect, it } from 'vitest';
import type { TransactionFeedback } from '../shared/types';
import { collectTechnicalProofs } from './TransactionModal';

const firstHash = `0x${'11'.repeat(32)}` as const;
const secondHash = `0x${'22'.repeat(32)}` as const;

describe('collectTechnicalProofs', () => {
  it('keeps every distinct approval proof while avoiding the duplicated current hash', () => {
    const feedback: TransactionFeedback = {
      tone: 'success',
      title: 'Artist registered',
      message: 'Artist space ready.',
      txHash: secondHash,
      technicalFacts: [{ label: 'Artist account', value: '0x1234', code: true }],
      steps: [
        { label: 'Claim your artist space', detail: 'First approval', status: 'complete', txHash: firstHash },
        { label: 'Make the space findable', detail: 'Second approval', status: 'complete', txHash: secondHash }
      ]
    };

    expect(collectTechnicalProofs(feedback)).toEqual([
      { label: 'Claim your artist space', txHash: firstHash },
      { label: 'Make the space findable', txHash: secondHash }
    ]);
  });

  it('retains a top-level proof when no roadmap step owns it', () => {
    const feedback: TransactionFeedback = {
      tone: 'success',
      title: 'Release published',
      message: 'Visible in Dotify.',
      txHash: firstHash
    };

    expect(collectTechnicalProofs(feedback)).toEqual([{ label: 'Proof reference', txHash: firstHash }]);
  });
});
