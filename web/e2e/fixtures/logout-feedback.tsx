import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UiFeedbackProvider, useUiFeedback } from '../../src/app/providers/UiFeedbackProvider';
import { WalletProvider } from '../../src/app/providers/WalletProvider';
import { TransactionModal } from '../../src/components/TransactionModal';
import { ensureDotifySessionForSigner, retryPendingSessionRevocations, signOutOfDotifySession } from '../../src/services/keyService';
import '../../src/styles/index.css';

// Isolated test entry: real providers/modal, no production imports or flags.
declare global {
  interface Window {
    logoutFeedbackFixture: {
      showPayment: () => void;
      closeFeedback: () => void;
      awaitingRetry: boolean;
      waitForRetry: () => Promise<void>;
      beginSignIn: () => Promise<string | null>;
      disconnect: () => Promise<void>;
    };
  }
}

function Fixture() {
  const { transactionFeedback, setTransactionFeedback } = useUiFeedback();
  useEffect(() => {
    window.logoutFeedbackFixture = {
      showPayment: () =>
        setTransactionFeedback({ operationId: 'payment-new', tone: 'pending', title: 'Tip confirmation', message: 'Checking the current payment.' }),
      closeFeedback: () => setTransactionFeedback(null),
      awaitingRetry: false,
      waitForRetry: () => {
        window.logoutFeedbackFixture.awaitingRetry = true;
        return retryPendingSessionRevocations().catch(() => {});
      },
      beginSignIn: () =>
        ensureDotifySessionForSigner(
          {
            address: '0x1111111111111111111111111111111111111111',
            signMessage: async () => `0x${'11'.repeat(65)}`
          },
          420420417
        ).catch((error: { code: string }) => error.code),
      disconnect: () => signOutOfDotifySession('0x1111111111111111111111111111111111111111')
    };
  }, [setTransactionFeedback]);
  return (
    <>
      <output data-testid='feedback-operation'>{transactionFeedback?.operationId ?? 'none'}</output>
      <TransactionModal />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiFeedbackProvider>
      <WalletProvider>
        <Fixture />
      </WalletProvider>
    </UiFeedbackProvider>
  </StrictMode>
);
