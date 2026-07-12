import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';

describe('useArtistConsole publication guard', () => {
  it('stops profile and release publication before wallet or upload work on a quarantined public deployment', async () => {
    const setTransactionFeedback = vi.fn<UseArtistConsoleDeps['setTransactionFeedback']>();
    const refreshCatalogFromRegistry = vi.fn<UseArtistConsoleDeps['refreshCatalogFromRegistry']>(async () => []);
    const setAudioCID = vi.fn<UseArtistConsoleDeps['setAudioCID']>();
    const setCoverCID = vi.fn<UseArtistConsoleDeps['setCoverCID']>();
    const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };

    const deps: UseArtistConsoleDeps = {
      activeEvmAddress: '0x0000000000000000000000000000000000000001',
      connectedWallet: null,
      ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
      currentChainId: 420420417,
      factoryAddress: '0x824ea33000e5e2ca9ddad030befa7331b38c41ce',
      directoryAddress: '0x7f90d15b5ec5f3a668e4dc14def3fe1c876dde0c',
      fileHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      title: 'Guarded release',
      artistName: 'Guarded artist',
      description: '',
      accessMode: 'free',
      priceDot: '0',
      personhoodLevel: 'DIM1',
      royaltyBps: 10_000,
      audioSource: null,
      coverFile: null,
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
    expect(artistConsole?.artistPublicationQuarantined).toBe(true);

    await artistConsole?.registerArtist();
    await artistConsole?.registerRights();

    expect(setTransactionFeedback).toHaveBeenCalledTimes(2);
    expect(setTransactionFeedback.mock.calls.map(([feedback]) => feedback?.title)).toEqual(['Artist publishing paused', 'Artist publishing paused']);
    expect(refreshCatalogFromRegistry).not.toHaveBeenCalled();
    expect(setAudioCID).not.toHaveBeenCalled();
    expect(setCoverCID).not.toHaveBeenCalled();
  });
});
