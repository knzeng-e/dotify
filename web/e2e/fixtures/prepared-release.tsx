// Local browser harness: real recovery hook, dialog and feedback. No publisher.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UiFeedbackProvider, useUiFeedback } from '../../src/app/providers/UiFeedbackProvider';
import { PreparedReleaseReview } from '../../src/components/PreparedReleaseReview';
import { TransactionModal } from '../../src/components/TransactionModal';
import { usePreparedReleaseRecovery } from '../../src/features/artist-studio/usePreparedReleaseRecovery';
import { preparedReleaseForm } from '../../src/features/artist-studio/preparedReleaseRecovery';
import { preparedReleaseFixture as release } from '../../src/features/artist-studio/preparedReleaseRecovery.fixture';
import '../../src/styles/index.css';

function Harness() {
  const feedback = useUiFeedback();
  const [context, setContext] = useState({
    owner: release.owner,
    runtimeAddress: release.runtimeAddress,
    chainId: release.chainId,
    contentHash: release.manifest.track.contentHash,
    connected: true
  });
  const [draft, setDraft] = useState('Current unsaved values');
  const [restores, setRestores] = useState(0);
  const recovery = usePreparedReleaseRecovery(
    context,
    candidate => {
      setDraft(JSON.stringify(preparedReleaseForm(candidate)));
      setRestores(n => n + 1);
    },
    () => feedback.setTransactionFeedback(null)
  );
  const staleReview = useRef(recovery.review);
  function showConflict() {
    feedback.setTransactionFeedback({
      tone: 'error',
      title: 'Publication needs attention',
      message: 'Review the saved title, description and cover.',
      recoveryAction: { label: 'Review prepared release', run: () => staleReview.current(release) }
    });
  }
  return (
    <>
      <button onClick={showConflict}>Show conflict</button>
      <button id='switch-account' onClick={() => setContext(c => ({ ...c, owner: '0x' + '99'.repeat(20) }))}>
        Switch account
      </button>
      <button id='switch-chain' onClick={() => setContext(c => ({ ...c, chainId: 1 }))}>
        Switch chain
      </button>
      <button id='switch-audio' onClick={() => setContext(c => ({ ...c, contentHash: '0x' + '99'.repeat(32) }))}>
        Switch audio
      </button>
      <button id='switch-runtime' onClick={() => setContext(c => ({ ...c, runtimeAddress: '0x' + '99'.repeat(20) }))}>
        Switch runtime
      </button>
      <button id='disconnect' onClick={() => setContext(c => ({ ...c, connected: false }))}>
        Disconnect
      </button>
      <output data-testid='draft'>{draft}</output>
      <output data-testid='restores'>{restores}</output>
      <TransactionModal />
      {recovery.candidate && <PreparedReleaseReview release={recovery.candidate} symbol='PAS' onCancel={recovery.cancel} onConfirm={recovery.confirm} />}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <UiFeedbackProvider>
    <Harness />
  </UiFeedbackProvider>
);
