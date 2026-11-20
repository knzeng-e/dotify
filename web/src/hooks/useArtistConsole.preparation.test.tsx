import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';
import { AudioPreparationError, AudioPreparationPending } from '../features/uploads/streamingPreparation';
import { createEmptyReleaseMetadata } from '../features/catalog/releaseMetadata';

import type { TransactionFeedback } from '../shared/types';
import type { BackendUploadIdentity, ProtectedAudioUpload } from '../services/pinata';
const runtime = vi.hoisted(() => ({
  getNativeTokenDecimals: vi.fn(async () => 10),
  ensureContract: vi.fn(async () => true),
  resolveArtistRuntime: vi.fn(async (): Promise<string | null> => '0x0000000000000000000000000000000000000002'),
  pendingRuntimeOf: vi.fn(),
  pendingRuntimeStageOf: vi.fn(),
  createRuntime: vi.fn(),
  installRuntimeStep: vi.fn(),
  waitForTransaction: vi.fn(async () => {}),
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
  it.each([0, 4, 6, 7])('describes the actual eight-approval bootstrap when starting at stage %i', async initialStage => {
    const address = '0x0000000000000000000000000000000000000002';
    const labels = [
      'Claim your artist space',
      'Make the space findable',
      'Keep creative control',
      'Open your music record',
      'Define how value flows',
      'Choose listening conditions',
      'Care for your release details',
      'Own the artist space'
    ];
    let stage = initialStage;
    let created = initialStage > 0;
    let complete = false;
    const feedback: TransactionFeedback[] = [];
    const signedStages: number[] = [];
    const hashFor = (index: number) => `0x${(index + 1).toString(16).padStart(64, '0')}` as const;
    const deps = publicationDeps({
      factoryAddress: '0x0000000000000000000000000000000000000003',
      directoryAddress: '0x0000000000000000000000000000000000000004',
      setTransactionFeedback: value => {
        const next = typeof value === 'function' ? value(feedback[feedback.length - 1] ?? null) : value;
        if (next) feedback.push(next);
      }
    });
    runtime.resolveArtistRuntime.mockImplementation(async () => (complete ? address : null));
    runtime.pendingRuntimeOf.mockImplementation(async () => (created && !complete ? address : null));
    runtime.pendingRuntimeStageOf.mockImplementation(async () => stage);
    runtime.createRuntime.mockImplementation(async () => {
      created = true;
      stage = 1;
      return hashFor(0);
    });
    runtime.installRuntimeStep.mockImplementation(async () => {
      const prompt = feedback[feedback.length - 1]!;
      expect(prompt.message).toBe(`Approval ${stage + 1}/8: ${prompt.steps![stage].detail}`);
      expect(prompt.steps!.map(step => step.label)).toEqual(labels);
      expect(prompt.steps![stage].status).toBe('active');
      expect(prompt.steps![stage].label).toBe(labels[stage]);
      signedStages.push(stage);
      const hash = hashFor(stage);
      complete = stage === 7;
      stage += 1;
      return hash;
    });
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
    function Harness() {
      captured.current = useArtistConsole(deps);
      return null;
    }
    try {
      renderToStaticMarkup(<Harness />);
      await captured.current!.registerArtist();
      expect(feedback[feedback.length - 1]?.title).toBe('Artist registered');
      expect(signedStages).toEqual(Array.from({ length: 8 - Math.max(1, initialStage) }, (_, index) => Math.max(1, initialStage) + index));
      expect(runtime.createRuntime).toHaveBeenCalledTimes(initialStage === 0 ? 1 : 0);
      expect(runtime.waitForTransaction).toHaveBeenCalledTimes(signedStages.length + (initialStage === 0 ? 1 : 0));
      const steps = feedback[feedback.length - 1]!.steps!;
      expect(steps).toHaveLength(8);
      expect(steps.every(step => step.status === 'complete')).toBe(true);
      for (const signed of signedStages) expect(steps[signed].txHash).toBe(hashFor(signed));
      if (initialStage === 0) expect(feedback[0].message).toContain('8 clear approvals');
      else expect(feedback[0].steps![initialStage].label).toBe(labels[initialStage]);
      expect(JSON.stringify(feedback)).not.toMatch(/Attach ownership to music|ownership record that can move/);
    } finally {
      runtime.resolveArtistRuntime.mockResolvedValue(address);
    }
  });
  it.each(['0.00000000011', '0.0000000000000000001'])('rejects an inexact Classic price before preparing assets or asking for approval: %s', async priceDot => {
    const deps = publicationDeps({
      factoryAddress: '0x0000000000000000000000000000000000000003',
      directoryAddress: '0x0000000000000000000000000000000000000004',
      accessMode: 'classic',
      priceDot
    });
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
    function Harness() {
      captured.current = useArtistConsole(deps);
      return null;
    }
    renderToStaticMarkup(<Harness />);
    await captured.current!.registerRights();
    expect(uploads.audio).not.toHaveBeenCalled();
    expect(uploads.cover).not.toHaveBeenCalled();
    expect(uploads.metadata).not.toHaveBeenCalled();
    expect(runtime.registerTrack).not.toHaveBeenCalled();
  });
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

it('presents a saved background preparation as pending with an explicit same-draft check', async () => {
  const deps = publicationDeps();
  const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
  function Harness() {
    captured.current = useArtistConsole(deps);
    return null;
  }
  renderToStaticMarkup(<Harness />);
  uploads.audio.mockRejectedValueOnce(new AudioPreparationPending());
  uploads.cover.mockResolvedValue('cover-cid');
  await captured.current!.registerRights();
  const calls = vi.mocked(deps.setTransactionFeedback).mock.calls;
  const setter = calls[calls.length - 1]?.[0];
  const feedback = (typeof setter === 'function' ? setter(null) : setter) as TransactionFeedback;
  expect(feedback).toMatchObject({ tone: 'pending', title: 'Preparation is saved', recoveryAction: { label: 'Check preparation' } });
  expect(feedback.message).toContain('still being prepared');
  expect(feedback.message).not.toContain('No release was published');
  expect(uploads.metadata).not.toHaveBeenCalled();
  expect(runtime.registerTrack).not.toHaveBeenCalled();
});
