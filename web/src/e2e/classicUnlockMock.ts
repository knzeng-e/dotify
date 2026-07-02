import { createWalletClient, http } from 'viem';
import type { Chain } from 'viem';
import type { ConnectedWallet } from '../hooks/useWallet';
import type { CatalogTrack } from '../shared/types';

export const isClassicUnlockE2e = import.meta.env.VITE_E2E_CLASSIC_UNLOCK === 'true';

export const E2E_CLASSIC_RUNTIME = '0x0000000000000000000000000000000000000e2e' as const;
export const E2E_CLASSIC_LISTENER = '0x0000000000000000000000000000000000001001' as const;
export const E2E_CLASSIC_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
export const E2E_CLASSIC_TX_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
export const E2E_CLASSIC_AUDIO_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export const E2E_CLASSIC_TRACK: CatalogTrack = {
  id: `${E2E_CLASSIC_RUNTIME}:${E2E_CLASSIC_HASH}`,
  zone: 'E2E',
  title: 'Deterministic Classic Unlock',
  artist: 'Dotify Test Artist',
  artistAddress: '0x0000000000000000000000000000000000000a71',
  audioRef: 'dotify:enc:ipfs://classic-unlock-e2e',
  imageRef:
    'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20640%20640%22%3E%3Crect%20width%3D%22640%22%20height%3D%22640%22%20fill%3D%22%23071326%22/%3E%3Ccircle%20cx%3D%22480%22%20cy%3D%22140%22%20r%3D%22220%22%20fill%3D%22%2300E5A0%22%20opacity%3D%22.58%22/%3E%3Ccircle%20cx%3D%22160%22%20cy%3D%22510%22%20r%3D%22200%22%20fill%3D%22%23B8F012%22%20opacity%3D%22.54%22/%3E%3C/svg%3E',
  priceDot: '0.5',
  localUrl: E2E_CLASSIC_AUDIO_URL,
  duration: 42,
  hash: E2E_CLASSIC_HASH,
  description: 'A deterministic Classic track used only by the e2e unlock flow.',
  bulletinRef: '',
  metadataRef: 'e2e:classic-unlock',
  royaltyBps: 7000,
  durationLabel: '0:42',
  accessMode: 'classic',
  source: 'artist',
  royaltySplits: [
    {
      label: 'Primary recipient',
      recipient: '0x0000000000000000000000000000000000000a71',
      bps: 7000
    }
  ],
  personhoodLevel: 'DIM1',
  encrypted: true,
  registeredAtBlock: 1
};

export type ClassicUnlockE2eState = {
  fullKeyRequests: number;
  deniedFullKeyRequests: number;
  paid: boolean;
};

declare global {
  interface Window {
    __DOTIFY_E2E_CLASSIC_UNLOCK__?: ClassicUnlockE2eState;
  }
}

export function getClassicUnlockE2eState(): ClassicUnlockE2eState {
  if (typeof window === 'undefined') {
    return { fullKeyRequests: 0, deniedFullKeyRequests: 0, paid: false };
  }
  window.__DOTIFY_E2E_CLASSIC_UNLOCK__ ??= { fullKeyRequests: 0, deniedFullKeyRequests: 0, paid: false };
  return window.__DOTIFY_E2E_CLASSIC_UNLOCK__;
}

export function recordClassicUnlockFullKeyRequest(authorized: boolean) {
  const state = getClassicUnlockE2eState();
  state.fullKeyRequests += 1;
  if (!authorized) state.deniedFullKeyRequests += 1;
}

export function createClassicUnlockE2eWallet(): ConnectedWallet {
  return {
    method: 'extension',
    label: 'E2E wallet',
    evmAddress: E2E_CLASSIC_LISTENER,
    chainId: 420420417,
    createEvmClient: (chain: Chain, rpcUrl: string) =>
      createWalletClient({
        account: E2E_CLASSIC_LISTENER,
        chain,
        transport: http(rpcUrl)
      })
  };
}
