// UI feedback provider - owns the two app-wide overlay states that any surface
// can trigger: the transaction feedback modal and the wallet modal visibility.
// Extracted from App.tsx so the shell no longer threads setTransactionFeedback /
// setShowWalletModal down through hooks and views. Fail closed: the accessor
// throws outside the provider rather than returning a silent no-op.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { TransactionFeedback, UiNotice } from '../../shared/types';

type UiFeedbackValue = {
  transactionFeedback: TransactionFeedback | null;
  setTransactionFeedback: Dispatch<SetStateAction<TransactionFeedback | null>>;
  notices: UiNotice[];
  pushNotice: (notice: Omit<UiNotice, 'id'>) => void;
  dismissNotice: (id: string) => void;
  showWalletModal: boolean;
  setShowWalletModal: Dispatch<SetStateAction<boolean>>;
};

const UiFeedbackContext = createContext<UiFeedbackValue | null>(null);

export function UiFeedbackProvider({ children }: { children: ReactNode }) {
  const [transactionFeedback, setTransactionFeedback] = useState<TransactionFeedback | null>(null);
  const [notices, setNotices] = useState<UiNotice[]>([]);
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

  const pushNotice = useCallback((notice: Omit<UiNotice, 'id'>) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setNotices(previous => [...previous.slice(-2), { id, ...notice }]);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices(previous => previous.filter(notice => notice.id !== id));
  }, []);

  const value = useMemo<UiFeedbackValue>(
    () => ({ transactionFeedback, setTransactionFeedback, notices, pushNotice, dismissNotice, showWalletModal, setShowWalletModal }),
    [transactionFeedback, notices, pushNotice, dismissNotice, showWalletModal]
  );

  return <UiFeedbackContext.Provider value={value}>{children}</UiFeedbackContext.Provider>;
}

export function useUiFeedback(): UiFeedbackValue {
  const value = useContext(UiFeedbackContext);
  if (!value) throw new Error('useUiFeedback must be used within a UiFeedbackProvider.');
  return value;
}
