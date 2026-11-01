import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';
import { AudioPreparationError } from '../features/uploads/streamingPreparation';
import { createEmptyReleaseMetadata } from '../features/catalog/releaseMetadata';

import type { TransactionFeedback } from '../shared/types';
import type { BackendUploadIdentity, ProtectedAudioUpload } from '../services/pinata';
const uploads = vi.hoisted(() => ({ audio: vi.fn(), cover: vi.fn(), metadata: vi.fn() }));
vi.mock('../services/pinata', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/pinata')>()),
  isBackendConfigured: () => false,
  uploadProtectedAudio: uploads.audio,
  uploadFileToPinata: uploads.cover,
  uploadJsonToPinata: uploads.metadata
}));
vi.mock('../shared/config/deploymentSafety', () => ({
  resolveConfiguredArtistPublicationSafety: () => ({ quarantined: false })
}));
afterEach(() => vi.clearAllMocks());

describe('publication preparation ownership', () => {
  it('keeps errors terminal despite late progress and reuses durable audio on retry', async () => {
    const feedbackStates: Array<TransactionFeedback | null> = [];
    const setTransactionFeedback = vi.fn<UseArtistConsoleDeps['setTransactionFeedback']>(next => {
      feedbackStates.push(typeof next === 'function' ? next(feedbackStates[feedbackStates.length - 1] ?? null) : next);
    });
    const refreshCatalogFromRegistry = vi.fn<UseArtistConsoleDeps['refreshCatalogFromRegistry']>(async () => []);
    const setAudioCID = vi.fn<UseArtistConsoleDeps['setAudioCID']>();
    const setCoverCID = vi.fn<UseArtistConsoleDeps['setCoverCID']>();
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };

    const deps: UseArtistConsoleDeps = {
      activeEvmAddress: '0x0000000000000000000000000000000000000001',
      connectedWallet: { method: 'extension', label: 'Artist', evmAddress: '0x0000000000000000000000000000000000000001' },
      ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
      currentChainId: null,
      factoryAddress: undefined,
      directoryAddress: undefined,
      fileHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      title: 'Guarded release',
      artistName: 'Guarded artist',
      description: '',
      releaseMetadata: createEmptyReleaseMetadata(),
      durationSeconds: null,
      accessMode: 'free',
      priceDot: '0',
      personhoodLevel: 'DIM1',
      royaltyBps: 10_000,
      additionalRoyaltySplits: [],
      audioSource: 'data:audio/wav;base64,AQID',
      coverFile: new File(['cover'], 'cover.png', { type: 'image/png' }),
      audioCID: '',
      coverCID: '',
      coverSource: '',
      activeSubstrateAddress: null,
      activeSubstrateSigner: null,
      artistTracks: [],
      setTransactionFeedback,
      refreshCatalogFromRegistry,
      setAudioCID,
      setCoverCID,
      uploadToBulletinEnabled: false,
      audioUploadRef: { current: null },
      coverUploadRef: { current: null }
    };

    function Harness() {
      captured.current = useArtistConsole(deps);
      return null;
    }

    renderToStaticMarkup(<Harness />);
    const artistConsole = captured.current;
    let progress: BackendUploadIdentity['onAudioPreparation'];
    let finish!: (upload: ProtectedAudioUpload) => void;
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    uploads.audio.mockImplementation((_audio, _hash, identity: BackendUploadIdentity) => {
      progress = identity.onAudioPreparation;
      markStarted();
      return new Promise<ProtectedAudioUpload>(resolve => {
        finish = resolve;
      });
    });
    let rejectCover!: (reason: Error) => void;
    uploads.cover
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectCover = reject;
          })
      )
      .mockResolvedValue('cover-cid');
    uploads.metadata.mockResolvedValue('metadata-cid');
    const first = artistConsole!.registerRights();
    await started;
    const other: TransactionFeedback = { operationId: 'payment:another-task', tone: 'pending', title: 'Approve payment', message: 'Waiting for approval' };
    setTransactionFeedback(other);
    progress?.('encoding');
    expect(feedbackStates[feedbackStates.length - 1]).toBe(other);
    setTransactionFeedback(null);
    rejectCover(new Error('Cover storage unavailable'));
    // A second click before React rerenders must not create another attempt.
    await artistConsole!.registerRights();
    await first;
    const failed = feedbackStates[feedbackStates.length - 1]!;
    expect(failed).toMatchObject({ tone: 'error', title: 'Publication needs attention', operationKind: 'publication' });
    expect(failed.message).toContain('Cover storage unavailable');
    progress?.('encoding');
    progress?.('publishing');
    expect(feedbackStates[feedbackStates.length - 1]).toBe(failed);
    const retry = artistConsole!.registerRights();
    progress?.('ready');
    finish('dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44));
    await retry;
    expect(uploads.audio).toHaveBeenCalledTimes(1);
    expect(uploads.cover).toHaveBeenCalledTimes(2);
    expect(uploads.metadata).toHaveBeenCalledTimes(1);
    expect(feedbackStates[feedbackStates.length - 1]).toMatchObject({ tone: 'success', title: 'Release prepared' });
    expect(feedbackStates[feedbackStates.length - 1]!.operationId).not.toEqual(failed.operationId);

    // A storage recovery barrier must reach the artist unchanged; reconnecting
    // a wallet cannot reconcile an already-broadcast storage transaction.
    deps.audioUploadRef!.current = null;
    const discard = vi.fn(async () => {
      throw Object.assign(new Error('Storage recovery required'), { code: 'STREAMING_RECOVERY_REQUIRED' });
    });
    uploads.audio.mockRejectedValueOnce(new AudioPreparationError('Preparation reached its retry limit', discard, false));
    await artistConsole!.registerRights();
    const needsRecovery = feedbackStates[feedbackStates.length - 1]!;
    expect(needsRecovery.recoveryAction?.label).toBe('Discard failed preparation');
    needsRecovery.recoveryAction!.run();
    await vi.waitFor(() => {
      const refusal = feedbackStates[feedbackStates.length - 1]!;
      expect(refusal.title).toBe('Preparation is still saved');
      expect(refusal.message).toContain('Dotify operator');
      expect(refusal.message).not.toContain('Reconnect');
    });
    expect(discard).toHaveBeenCalledTimes(1);
  });
});
