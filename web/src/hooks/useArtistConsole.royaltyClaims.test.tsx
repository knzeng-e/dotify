import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { useArtistConsole, type UseArtistConsoleDeps } from './useArtistConsole';
import { createEmptyReleaseMetadata } from '../features/catalog/releaseMetadata';

const address = '0x0000000000000000000000000000000000000001' as const;
const runtime = '0x2222222222222222222222222222222222222222' as const;
const trackHash = `0x${'33'.repeat(32)}` as const;
const txHash = `0x${'44'.repeat(32)}` as const;
const { claim, wait, readback } = vi.hoisted(() => ({ claim: vi.fn(), wait: vi.fn(), readback: vi.fn() }));
vi.mock('../features/runtime/runtimeReaderProvider', () => ({ createRuntimeReader: () => ({ getRoyaltyClaimable: async () => 100n }) }));
vi.mock('../features/runtime/viemRuntimeAdapter', () => ({
  createViemRuntimeReader: () => ({ getRoyaltyClaimable: readback, listRoyaltyPaymentLogs: async () => [] })
}));
vi.mock('../shared/config/contracts', async importOriginal => ({
  ...(await importOriginal<typeof import('../shared/config/contracts')>()),
  getPublicClient: () => ({ getChainId: async () => 420420417 })
}));
vi.mock('../features/runtime/runtimeWriterProvider', () => ({
  createRuntimeWriter: () => ({
    claimRoyalty: claim,
    waitForTransaction: wait,
    getRoyaltyReceiptWarning: () => ({ message: 'Finalized; history not saved', block: { number: 123 } })
  })
}));

it('still reads the finalized claim balance and displays its hash/block when history persistence fails', async () => {
  claim.mockResolvedValue(txHash);
  wait.mockResolvedValue(undefined);
  readback.mockResolvedValue(0n);
  const setTransactionFeedback = vi.fn<UseArtistConsoleDeps['setTransactionFeedback']>();
  const captured: { current: ReturnType<typeof useArtistConsole> | null } = { current: null };
  const deps: UseArtistConsoleDeps = {
    activeEvmAddress: address,
    connectedWallet: { method: 'product-host', label: 'Artist', evmAddress: address },
    ethRpcUrl: 'https://eth-rpc-testnet.polkadot.io/',
    currentChainId: 420420417,
    factoryAddress: '0x824ea33000e5e2ca9ddad030befa7331b38c41ce',
    directoryAddress: '0x7f90d15b5ec5f3a668e4dc14def3fe1c876dde0c',
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
    audioSource: null,
    coverFile: null,
    audioCID: '',
    coverCID: '',
    coverSource: '',
    artistTracks: [
      {
        id: `${runtime}:${trackHash}`,
        source: 'artist',
        zone: 'Studio',
        audioRef: 'dotify:local:test',
        imageRef: '',
        priceDot: '1',
        description: '',
        bulletinRef: '',
        metadataRef: '',
        royaltyBps: 10000,
        durationLabel: '1:00',
        accessMode: 'classic',
        personhoodLevel: 'DIM1',
        encrypted: true,
        hash: trackHash,
        artistAddress: address,
        artist: 'Artist',
        title: 'Track',
        royaltySplits: [{ label: 'Artist', recipient: address, bps: 10000 }]
      }
    ],
    setTransactionFeedback,
    refreshCatalogFromRegistry: vi.fn(async () => []),
    setAudioCID: vi.fn(),
    setCoverCID: vi.fn(),
    audioUploadRef: { current: null },
    coverUploadRef: { current: null }
  };

  function Harness() {
    captured.current = useArtistConsole(deps);
    return null;
  }
  renderToStaticMarkup(<Harness />);
  await captured.current!.claimRoyalties();
  expect(claim).toHaveBeenCalledExactlyOnceWith(runtime, address);
  expect(wait).toHaveBeenCalledWith(txHash);
  expect(readback).toHaveBeenCalledWith(runtime, address);
  expect(setTransactionFeedback.mock.calls[setTransactionFeedback.mock.calls.length - 1]?.[0]).toMatchObject({
    tone: 'success',
    title: 'Royalties claimed; history needs attention',
    txHash,
    technicalFacts: [{ label: 'Finalized receipt · block 123', value: txHash }]
  });
});
