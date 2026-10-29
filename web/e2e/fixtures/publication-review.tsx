// Real-hook browser harnesses, imported only by the review regression specs.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UiFeedbackProvider, useUiFeedback } from '../../src/app/providers/UiFeedbackProvider';
import { TransactionModal } from '../../src/components/TransactionModal';
import { useArtistConsole, type UseArtistConsoleDeps } from '../../src/hooks/useArtistConsole';
import { createEmptyReleaseMetadata } from '../../src/features/catalog/releaseMetadata';
import { AudioPreparationError } from '../../src/features/uploads/streamingPreparation';
import { usePublicationConfirmation } from '../../src/features/artist-studio/usePublicationConfirmation';
import type { CatalogTrack } from '../../src/shared/types';

const account = '0x0000000000000000000000000000000000000001';
const hash = `0x${'11'.repeat(32)}` as const;
const audio = 'data:audio/wav;base64,AQID';

function mount(harness: React.ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  createRoot(container).render(<UiFeedbackProvider>{harness}</UiFeedbackProvider>);
}

export function mountPreparationRetry() {
  const originalFetch = window.fetch;
  let rejectPreparation: (error: Error) => void = () => {
    throw new Error('Preparation has not started');
  };
  // Hold only this fixture's source read. All services/hooks remain real and
  // the explicit E2E mode prevents a successful retry from writing on-chain.
  window.fetch = (input, init) =>
    String(input) === audio
      ? new Promise<Response>((_resolve, reject) => {
          rejectPreparation = reject;
        })
      : originalFetch(input, init);
  function Harness() {
    const { transactionFeedback, setTransactionFeedback } = useUiFeedback();
    const [connected, setConnected] = useState(true);
    const [royaltyBps, setRoyaltyBps] = useState(10_000);
    const audioUploadRef: UseArtistConsoleDeps['audioUploadRef'] = useRef(null);
    const coverUploadRef: UseArtistConsoleDeps['coverUploadRef'] = useRef(null);
    const studio = useArtistConsole({
      activeEvmAddress: account,
      connectedWallet: connected ? { method: 'extension', label: 'Artist', evmAddress: account } : null,
      ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
      currentChainId: 420420417,
      factoryAddress: undefined,
      directoryAddress: undefined,
      fileHash: hash,
      title: 'Review regression',
      artistName: 'Review artist',
      description: '',
      releaseMetadata: createEmptyReleaseMetadata(),
      durationSeconds: null,
      accessMode: 'classic',
      priceDot: '1',
      personhoodLevel: 'DIM1',
      royaltyBps,
      additionalRoyaltySplits: [],
      audioSource: audio,
      coverFile: null,
      audioCID: '',
      coverCID: '',
      coverSource: '',
      activeSubstrateAddress: null,
      activeSubstrateSigner: null,
      artistTracks: [],
      setTransactionFeedback,
      transactionFeedback,
      refreshCatalogFromRegistry: async () => [],
      setAudioCID: () => {},
      setCoverCID: () => {},
      uploadToBulletinEnabled: false,
      audioUploadRef,
      coverUploadRef
    });
    return (
      <>
        <button onClick={() => void studio.registerRights()}>Start fixture publication</button>
        <button onClick={() => setRoyaltyBps(0)}>Remove draft recipients</button>
        <button onClick={() => setConnected(false)}>Disconnect fixture account</button>
        <button
          onClick={() => {
            window.fetch = originalFetch;
            rejectPreparation(new AudioPreparationError('Temporary preparation failure'));
          }}
        >
          Fail fixture preparation
        </button>
        <output data-testid='fixture-status'>{studio.rightsStatus}</output>
        <TransactionModal />
      </>
    );
  }
  mount(<Harness />);
}

export function mountCatalogConfirmation() {
  function Harness() {
    const { transactionFeedback, setTransactionFeedback } = useUiFeedback();
    const [status, setStatus] = useState('');
    const [reads, setReads] = useState(0);
    const [navigations, setNavigations] = useState(0);
    const [recoveryClicks, setRecoveryClicks] = useState(0);
    const resolveRead = useRef<(tracks: CatalogTrack[]) => void>(() => {
      throw new Error('Catalog read has not started');
    });
    const confirmation = usePublicationConfirmation({
      tracks: [],
      refresh: () => {
        setReads(value => value + 1);
        return new Promise<CatalogTrack[]>(resolve => {
          resolveRead.current = resolve;
        });
      },
      setFeedback: setTransactionFeedback,
      setStatus,
      activeFeedback: transactionFeedback,
      onPublished: () => setNavigations(value => value + 1)
    });
    function confirm(otherTask: 'payment' | 'recovery') {
      // Deliberately queue the other dialog in the same event as confirm(),
      // so checking a previous render's activeFeedback would not be enough.
      setTransactionFeedback({
        operationId: `${otherTask}:another-task`,
        tone: otherTask === 'payment' ? 'pending' : 'error',
        title: otherTask === 'payment' ? 'Approve another payment' : 'Another task needs attention',
        message: 'This task owns its controls.',
        ...(otherTask === 'recovery' ? { recoveryAction: { label: 'Recover another task', run: () => setRecoveryClicks(value => value + 1) } } : {})
      });
      confirmation.confirm({
        runtime: account,
        hash,
        account,
        feedback: { operationId: 'publication:review', operationKind: 'publication', tone: 'pending', title: 'Publishing', message: '' }
      });
    }
    return (
      <>
        <button onClick={() => confirm('payment')}>Confirm behind payment</button>
        <button onClick={() => confirm('recovery')}>Confirm behind recovery</button>
        <button onClick={() => resolveRead.current([{ id: `${account}:${hash}`, hash, active: true, source: 'artist' } as CatalogTrack])}>
          Resolve catalog read
        </button>
        <output data-testid='fixture-confirmation'>{JSON.stringify({ pending: confirmation.pending, status, reads, navigations, recoveryClicks })}</output>
        <TransactionModal />
      </>
    );
  }
  mount(<Harness />);
}
