// UI feedback provider - owns the two app-wide overlay states that any surface
// can trigger: the transaction feedback modal and the wallet modal visibility.
// Extracted from App.tsx so the shell no longer threads setTransactionFeedback /
// setShowWalletModal down through hooks and views. Fail closed: the accessor
// throws outside the provider rather than returning a silent no-op.

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { TransactionFeedback } from '../../shared/types';

type UiFeedbackValue = {
  transactionFeedback: TransactionFeedback | null;
  setTransactionFeedback: Dispatch<SetStateAction<TransactionFeedback | null>>;
  showWalletModal: boolean;
  setShowWalletModal: Dispatch<SetStateAction<boolean>>;
};

const UiFeedbackContext = createContext<UiFeedbackValue | null>(null);

export function UiFeedbackProvider({ children }: { children: ReactNode }) {
  const [transactionFeedback, setTransactionFeedback] = useState<TransactionFeedback | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Escape closes a settled transaction modal; a pending one stays put so the
  // user cannot dismiss an in-flight signature/broadcast by accident.
  useEffect(() => {
    if (!transactionFeedback || transactionFeedback.tone === 'pending') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTransactionFeedback(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [transactionFeedback]);

  const value = useMemo<UiFeedbackValue>(
    () => ({ transactionFeedback, setTransactionFeedback, showWalletModal, setShowWalletModal }),
    [transactionFeedback, showWalletModal]
  );

  return <UiFeedbackContext.Provider value={value}>{children}</UiFeedbackContext.Provider>;
}

export function useUiFeedback(): UiFeedbackValue {
  const value = useContext(UiFeedbackContext);
  if (!value) throw new Error('useUiFeedback must be used within a UiFeedbackProvider.');
  return value;
}
