import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';
import { AudioPreparationError } from '../features/uploads/streamingPreparation';
import { createEmptyReleaseMetadata } from '../features/catalog/releaseMetadata';

import type { TransactionFeedback } from '../shared/types';
import type { BackendUploadIdentity, ProtectedAudioUpload } from '../services/pinata';
const runtime = vi.hoisted(() => ({
  ensureContract: vi.fn(async () => true),
  resolveArtistRuntime: vi.fn(async () => '0x0000000000000000000000000000000000000002'),
  registerTrack: vi.fn()
}));
vi.mock('../features/runtime/runtimeReaderProvider', () => ({ createRuntimeReader: () => runtime }));
vi.mock('../features/runtime/runtimeWriterProvider', () => ({ createRuntimeWriter: () => runtime }));
const uploads = vi.hoisted(() => ({ audio: vi.fn(), cover: vi.fn(), metadata: vi.fn() }));
const archive = vi.hoisted(() => ({ checkBulletinAuthorization: vi.fn(), encodeBulletinJson: vi.fn(), uploadToBulletin: vi.fn() }));
vi.mock('./useBulletin', () => archive);
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

function publicationDeps(overrides: Partial<UseArtistConsoleDeps> = {}): UseArtistConsoleDeps {
  return {
    activeEvmAddress: '0x0000000000000000000000000000000000000001',
    connectedWallet: { method: 'extension', label: 'Artist', evmAddress: '0x0000000000000000000000000000000000000001' },
    ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
    currentChainId: null,
    factoryAddress: undefined,
    directoryAddress: undefined,
    fileHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    title: 'Guarded release',
    artistName: 'Guarded artist',
    description: 'A release note.',
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
    artistTracks: [],
    setTransactionFeedback: vi.fn(),
    refreshCatalogFromRegistry: vi.fn(async () => []),
    setAudioCID: vi.fn(),
    setCoverCID: vi.fn(),
    audioUploadRef: { current: null },
    coverUploadRef: { current: null },
    ...overrides
  };
}

describe('publication preparation ownership', () => {
  it.each([{ artistName: '   ' }, { title: '' }, { description: '  ' }, { artistName: '🎶'.repeat(201) }])(
    'rejects invalid text before upload and retains prepared music: %j',
    async invalid => {
      const deps = publicationDeps(invalid);
      const audio = Promise.resolve('dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44));
      const cover = Promise.resolve('cover-cid');
      deps.audioUploadRef.current = audio;
      deps.coverUploadRef.current = cover;
      const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
      function Harness() {
        captured.current = useArtistConsole(deps);
        return null;
      }
      renderToStaticMarkup(<Harness />);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      try {
        await captured.current!.registerRights();
        expect(deps.setTransactionFeedback).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error', title: 'Complete your release details' }));
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(runtime.ensureContract).not.toHaveBeenCalled();
        expect(runtime.resolveArtistRuntime).not.toHaveBeenCalled();
        expect(runtime.registerTrack).not.toHaveBeenCalled();
        expect(uploads.audio).not.toHaveBeenCalled();
        expect(uploads.cover).not.toHaveBeenCalled();
        expect(uploads.metadata).not.toHaveBeenCalled();
        expect(deps.audioUploadRef.current).toBe(audio);
        expect(deps.coverUploadRef.current).toBe(cover);
        Object.assign(deps, { title: ' Signal ', artistName: ' Thot Nzeng ', description: ' A release note. ' });
        renderToStaticMarkup(<Harness />);
        uploads.metadata.mockResolvedValue('metadata-cid');
        await captured.current!.registerRights();
        expect(uploads.audio).not.toHaveBeenCalled();
        expect(uploads.cover).not.toHaveBeenCalled();
        expect(uploads.metadata).toHaveBeenCalledWith(
          expect.objectContaining({ track: expect.objectContaining({ title: 'Signal', artistName: 'Thot Nzeng', description: 'A release note.' }) }),
          expect.any(String),
          expect.any(Object),
          undefined
        );
      } finally {
        fetchSpy.mockRestore();
      }
    }
  );
  it('submits exactly the normalized name and text saved in public metadata', async () => {
    const deps = publicationDeps({
      factoryAddress: '0x0000000000000000000000000000000000000003',
      directoryAddress: '0x0000000000000000000000000000000000000004',
      title: ' Signal ',
      artistName: ' Thot Nzeng ',
      description: ' A release note. '
    });
    deps.audioUploadRef.current = Promise.resolve('dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44));
    deps.coverUploadRef.current = Promise.resolve('cover-cid');
    uploads.metadata.mockResolvedValue('metadata-cid');
    runtime.registerTrack.mockRejectedValueOnce(new Error('Approval declined for test'));
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
    function Harness() {
      captured.current = useArtistConsole(deps);
      return null;
    }
    renderToStaticMarkup(<Harness />);
    await captured.current!.registerRights();
    const manifest = uploads.metadata.mock.calls[0][0];
    expect(manifest.track).toMatchObject({ title: 'Signal', artistName: 'Thot Nzeng', description: 'A release note.' });
    expect(runtime.registerTrack).toHaveBeenCalledWith(
      '0x0000000000000000000000000000000000000002',
      expect.objectContaining({
        title: manifest.track.title,
        artistName: manifest.track.artistName,
        description: manifest.track.description
      })
    );
  });

  it('keeps errors terminal despite late progress and reuses durable audio on retry', async () => {
    const feedbackStates: Array<TransactionFeedback | null> = [];
    const setTransactionFeedback = vi.fn<UseArtistConsoleDeps['setTransactionFeedback']>(next => {
      feedbackStates.push(typeof next === 'function' ? next(feedbackStates[feedbackStates.length - 1] ?? null) : next);
    });
    const refreshCatalogFromRegistry = vi.fn<UseArtistConsoleDeps['refreshCatalogFromRegistry']>(async () => []);
    const setAudioCID = vi.fn<UseArtistConsoleDeps['setAudioCID']>();
    const setCoverCID = vi.fn<UseArtistConsoleDeps['setCoverCID']>();
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };

    const deps = publicationDeps({ setTransactionFeedback, refreshCatalogFromRegistry, setAudioCID, setCoverCID });

    // A stale caller must not restore the retired direct-upload/signing path.
    // This wallet intentionally has no Substrate signer.
    Object.assign(deps, { uploadToBulletinEnabled: true, activeSubstrateAddress: null, activeSubstrateSigner: null });

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
    expect(archive.checkBulletinAuthorization).not.toHaveBeenCalled();
    expect(archive.encodeBulletinJson).not.toHaveBeenCalled();
    expect(archive.uploadToBulletin).not.toHaveBeenCalled();

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
