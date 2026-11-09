import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TransactionFeedback } from '../shared/types';
import { collectTechnicalProofs, TransactionModal } from './TransactionModal';

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

const status = vi.hoisted(() => ({ feedback: null as TransactionFeedback | null }));
vi.mock('../app/providers/UiFeedbackProvider', () => ({ useUiFeedback: () => ({ transactionFeedback: status.feedback, setTransactionFeedback: vi.fn() }) }));
vi.mock('./Dialog', () => ({ Dialog: ({ children }: { children: import('react').ReactNode }) => createElement('div', null, children) }));

it('offers a saved publication check but never a pending payment/registration retry', () => {
  const base: TransactionFeedback = {
    operationId: 'publication:test',
    operationKind: 'publication',
    tone: 'pending',
    title: 'Preparation is saved',
    message: 'Still preparing.',
    recoveryAction: { label: 'Check preparation', run: vi.fn(), checkPreparation: true }
  };
  status.feedback = base;
  const html = renderToStaticMarkup(createElement(TransactionModal));
  expect(html).toContain('Check preparation</button>');
  expect(html).toContain('Return to check preparation before approving the release.');
  expect(html).not.toContain('publication checks will continue');
  status.feedback = { ...base, recoveryAction: { label: 'Retry registration', run: vi.fn() } };
  expect(renderToStaticMarkup(createElement(TransactionModal))).not.toContain('Retry registration</button>');
  status.feedback = { ...base, txHash: firstHash };
  expect(renderToStaticMarkup(createElement(TransactionModal))).not.toContain('Check preparation</button>');
  status.feedback = { ...base, operationKind: 'payment' };
  expect(renderToStaticMarkup(createElement(TransactionModal))).not.toContain('Check preparation</button>');
});
