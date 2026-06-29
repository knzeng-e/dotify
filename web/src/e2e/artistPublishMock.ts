import type { Chain } from 'viem';
import { createWalletClient, http } from 'viem';
import type { ConnectedWallet } from '../hooks/useWallet';
import type { AccessMode, CatalogTrack, PersonhoodLevel } from '../types';

export const isArtistPublishE2e = import.meta.env.VITE_E2E_ARTIST_PUBLISH === 'true';

export type ArtistPublishE2eScenario = 'happy' | 'missing-wallet' | 'network-mismatch' | 'upload-failure' | 'transaction-failure';

export const E2E_ARTIST_CHAIN_ID = 420420417;
export const E2E_ARTIST_ADDRESS = '0x000000000000000000000000000000000000a711' as const;
export const E2E_ARTIST_RUNTIME = '0x000000000000000000000000000000000000a712' as const;
export const E2E_ARTIST_PROFILE_TX_HASH = '0xa711000000000000000000000000000000000000000000000000000000000001' as const;
export const E2E_ARTIST_RELEASE_TX_HASH = '0xa711000000000000000000000000000000000000000000000000000000000002' as const;
export const E2E_ARTIST_COVER_DATA_URL =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20640%20640%22%3E%3Crect%20width%3D%22640%22%20height%3D%22640%22%20fill%3D%22%23050D1A%22/%3E%3Ccircle%20cx%3D%22194%22%20cy%3D%22218%22%20r%3D%22208%22%20fill%3D%22%2300E5A0%22%20opacity%3D%22.62%22/%3E%3Ccircle%20cx%3D%22470%22%20cy%3D%22438%22%20r%3D%22224%22%20fill%3D%22%23E6007A%22%20opacity%3D%22.42%22/%3E%3C/svg%3E';

const STORAGE_KEY = 'dotify:e2e:artist-publish';

export type ArtistPublishE2eState = {
  runtimeCreated: boolean;
  uploadRequests: {
    audio: number;
    cover: number;
    metadata: number;
  };
  uploadFailures: number;
  registerArtistTransactions: number;
  registerTrackTransactions: number;
  transactionFailures: number;
  devAccountFallbackUsed: boolean;
  tracks: CatalogTrack[];
};

type ArtistPublishTrackInput = {
  artistAddress: `0x${string}`;
  runtimeAddress: `0x${string}`;
  hash: `0x${string}`;
  title: string;
  artistName: string;
  description: string;
  accessMode: AccessMode;
  priceDot: string;
  personhoodLevel: PersonhoodLevel;
  royaltyBps: number;
  audioCID: string;
  coverCID: string;
  metadataCID: string;
};

declare global {
  interface Window {
    __DOTIFY_E2E_ARTIST_PUBLISH__?: ArtistPublishE2eState;
  }
}

function defaultState(): ArtistPublishE2eState {
  return {
    runtimeCreated: false,
    uploadRequests: {
      audio: 0,
      cover: 0,
      metadata: 0
    },
    uploadFailures: 0,
    registerArtistTransactions: 0,
    registerTrackTransactions: 0,
    transactionFailures: 0,
    devAccountFallbackUsed: false,
    tracks: []
  };
}

function parseState(raw: string | null): ArtistPublishE2eState {
  if (!raw) return defaultState();
  try {
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<ArtistPublishE2eState>) };
  } catch {
    return defaultState();
  }
}

function persistArtistPublishE2eState(state: ArtistPublishE2eState) {
  if (typeof window === 'undefined') return;
  window.__DOTIFY_E2E_ARTIST_PUBLISH__ = state;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getArtistPublishE2eScenario(): ArtistPublishE2eScenario {
  if (!isArtistPublishE2e || typeof window === 'undefined') return 'happy';
  const requested = new URLSearchParams(window.location.search).get('e2eArtist');
  if (
    requested === 'missing-wallet' ||
    requested === 'network-mismatch' ||
    requested === 'upload-failure' ||
    requested === 'transaction-failure' ||
    requested === 'happy'
  ) {
    return requested;
  }
  return 'happy';
}

export function getArtistPublishE2eState(): ArtistPublishE2eState {
  if (typeof window === 'undefined') return defaultState();
  if (!window.__DOTIFY_E2E_ARTIST_PUBLISH__) {
    window.__DOTIFY_E2E_ARTIST_PUBLISH__ = parseState(window.localStorage.getItem(STORAGE_KEY));
  }
  return window.__DOTIFY_E2E_ARTIST_PUBLISH__;
}

export function resetArtistPublishE2eState() {
  if (typeof window === 'undefined') return;
  persistArtistPublishE2eState(defaultState());
}

export function isArtistPublishE2eScenarioRequested() {
  if (!isArtistPublishE2e || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('e2eArtist');
}

export function shouldAutoConnectArtistPublishE2eWallet() {
  return isArtistPublishE2e && getArtistPublishE2eScenario() !== 'missing-wallet';
}

export function createArtistPublishE2eWallet(): ConnectedWallet {
  const scenario = getArtistPublishE2eScenario();
  const chainId = scenario === 'network-mismatch' ? 1 : E2E_ARTIST_CHAIN_ID;

  return {
    method: 'extension',
    label: 'E2E artist wallet',
    evmAddress: E2E_ARTIST_ADDRESS,
    chainId,
    createEvmClient: (chain: Chain, rpcUrl: string) =>
      createWalletClient({
        account: E2E_ARTIST_ADDRESS,
        chain,
        transport: http(rpcUrl)
      })
  };
}

export function getArtistPublishE2eNetworkError(wallet: ConnectedWallet | null) {
  if (!isArtistPublishE2e || !wallet?.chainId || wallet.chainId === E2E_ARTIST_CHAIN_ID) return null;
  return `Switch your wallet to chain ${E2E_ARTIST_CHAIN_ID}. Your wallet is currently on chain ${wallet.chainId}.`;
}

export function markArtistPublishRuntimeCreated() {
  const state = getArtistPublishE2eState();
  state.runtimeCreated = true;
  state.registerArtistTransactions += 1;
  persistArtistPublishE2eState(state);
}

export function recordArtistPublishUpload(kind: keyof ArtistPublishE2eState['uploadRequests']) {
  const state = getArtistPublishE2eState();
  state.uploadRequests[kind] += 1;
  persistArtistPublishE2eState(state);
}

export function recordArtistPublishUploadFailure() {
  const state = getArtistPublishE2eState();
  state.uploadFailures += 1;
  persistArtistPublishE2eState(state);
}

export function getArtistPublishE2eCid(kind: keyof ArtistPublishE2eState['uploadRequests']) {
  recordArtistPublishUpload(kind);
  return `e2e-artist-${kind}-cid`;
}

export function recordArtistPublishTransactionFailure() {
  const state = getArtistPublishE2eState();
  state.transactionFailures += 1;
  persistArtistPublishE2eState(state);
}

export function createArtistPublishE2eTrack(input: ArtistPublishTrackInput): CatalogTrack {
  return {
    id: `${input.runtimeAddress}:${input.hash}`,
    zone: 'Studio',
    title: input.title.trim() || 'Untitled',
    artist: input.artistName.trim() || 'Unknown artist',
    artistAddress: input.artistAddress,
    audioRef: input.audioCID ? `dotify:enc:ipfs://${input.audioCID}` : `dotify:local:${input.hash}`,
    imageRef: E2E_ARTIST_COVER_DATA_URL,
    priceDot: input.accessMode === 'classic' ? input.priceDot : '0',
    duration: 42,
    hash: input.hash,
    description: input.description.trim(),
    bulletinRef: '',
    metadataRef: `ipfs://${input.metadataCID}`,
    royaltyBps: input.royaltyBps,
    txHash: E2E_ARTIST_RELEASE_TX_HASH,
    durationLabel: '0:42',
    accessMode: input.accessMode,
    source: 'artist',
    royaltySplits: [
      {
        label: 'Primary recipient',
        recipient: input.artistAddress,
        bps: input.royaltyBps
      }
    ],
    personhoodLevel: input.personhoodLevel,
    encrypted: true,
    registeredAtBlock: 2
  };
}

export function publishArtistPublishE2eTrack(track: CatalogTrack) {
  const state = getArtistPublishE2eState();
  state.registerTrackTransactions += 1;
  state.tracks = [track, ...state.tracks.filter(existing => existing.hash.toLowerCase() !== track.hash.toLowerCase())];
  persistArtistPublishE2eState(state);
}

export function getArtistPublishE2eTracks() {
  return getArtistPublishE2eState().tracks;
}
