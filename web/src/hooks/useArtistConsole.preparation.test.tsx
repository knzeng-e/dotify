import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';
import { createEmptyReleaseMetadata } from '../features/catalog/releaseMetadata';

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
    const setTransactionFeedback = vi.fn<UseArtistConsoleDeps['setTransactionFeedback']>();
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
    uploads.cover.mockRejectedValueOnce(new Error('Cover storage unavailable')).mockResolvedValue('cover-cid');
    uploads.metadata.mockResolvedValue('metadata-cid');
    const first = artistConsole!.registerRights();
    await started;
    // A second click before React rerenders must not create another attempt.
    await artistConsole!.registerRights();
    await first;
    const failed = setTransactionFeedback.mock.lastCall![0]!;
    expect(failed).toMatchObject({ tone: 'error', title: 'Publication needs attention', operationKind: 'publication' });
    expect(failed.message).toContain('Cover storage unavailable');
    progress?.('encoding');
    progress?.('publishing');
    expect(setTransactionFeedback.mock.lastCall![0]).toBe(failed);
    const retry = artistConsole!.registerRights();
    progress?.('ready');
    finish('dotify:enc:v3:key-v2:ipfs://Qm' + 'a'.repeat(44));
    await retry;
    expect(uploads.audio).toHaveBeenCalledTimes(1);
    expect(uploads.cover).toHaveBeenCalledTimes(2);
    expect(uploads.metadata).toHaveBeenCalledTimes(1);
    expect(setTransactionFeedback.mock.lastCall![0]).toMatchObject({ tone: 'success', title: 'Release prepared' });
    expect(setTransactionFeedback.mock.lastCall![0]!.operationId).not.toEqual(failed.operationId);
  });
});
