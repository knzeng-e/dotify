// Browser integration harness. This module is never imported by the app.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { UiFeedbackProvider, useUiFeedback } from '../../src/app/providers/UiFeedbackProvider';
import { TransactionModal } from '../../src/components/TransactionModal';
import type { TransactionFeedback } from '../../src/shared/types';

export function mountPublicationFeedback() {
  let update: (feedback: TransactionFeedback) => void;
  function Harness() {
    update = useUiFeedback().setTransactionFeedback;
    return createElement(TransactionModal);
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  root.render(createElement(UiFeedbackProvider, null, createElement(Harness)));
  return (feedback: TransactionFeedback) => update(feedback);
}
