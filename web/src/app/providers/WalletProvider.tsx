// Wallet provider - owns wallet connection plus every identity value derived
// from it, so App.tsx and the feature hooks read one source of truth instead of
// re-deriving the active EVM/Substrate identity and re-wiring getActiveWalletClient
// by hand. Also owns the frozen RPC endpoint, the resolved expected chain id, and
// the network-switch flow. Fail closed: the accessor throws outside the provider.
//
// Security posture preserved from App.tsx: dev accounts (Alice, Bob, ...) use a
// universally known mnemonic and must never become a hidden fallback signer
// outside local development, so devBulletinFallback is gated on import.meta.env.DEV.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { zeroAddress } from 'viem';
import type { PolkadotSigner } from 'polkadot-api';

import { useWallet, type ConnectedWallet, type WalletState } from '../../hooks/useWallet';
import { devAccounts, type DevAccount } from '../../hooks/useDevAccounts';
import { getDefaultEthRpcUrl } from '../../shared/config/network';
import { resolveEvmChain, getWalletClient } from '../../shared/config/contracts';
import { chainMismatchMessage } from '../../features/wallet/network';
import { useUiFeedback } from './UiFeedbackProvider';

type WalletContextValue = {
  walletState: WalletState;
  connectedWallet: ConnectedWallet | null;
  activeEvmAddress: `0x${string}`;
  listenerEvmAddress: `0x${string}` | null;
  activeSubstrateAddress: string | null;
  activeSubstrateSigner: PolkadotSigner | null;
  currentBulletinAccount: DevAccount;
  ethRpcUrl: string;
  expectedChainId: number | null;
  isSwitchingNetwork: boolean;
  bulletinAccountIndex: number;
  setBulletinAccountIndex: (index: number) => void;
  getActiveWalletClient: () => Promise<Awaited<ReturnType<typeof getWalletClient>>>;
  switchNetwork: () => Promise<void>;
  connectPasskey: () => Promise<void>;
  connectExtension: () => Promise<void>;
  disconnect: () => void;
  forgetPasskey: () => void;
  hasPrfSupport: boolean;
  hasStoredPasskey: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { setTransactionFeedback, setShowWalletModal } = useUiFeedback();
  const {
    state: walletState,
    connectPasskey,
    connectExtension,
    switchExtensionNetwork,
    disconnect,
    hasPrfSupport,
    hasStoredPasskey,
    forgetPasskey
  } = useWallet();

  const [ethRpcUrl] = useState(getDefaultEthRpcUrl);
  const [expectedChainId, setExpectedChainId] = useState<number | null>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [bulletinAccountIndex, setBulletinAccountIndex] = useState(0);

  const connectedWallet = walletState.status === 'connected' ? walletState.wallet : null;
  const currentBulletinAccount = devAccounts[bulletinAccountIndex];
  const activeEvmAddress = connectedWallet?.evmAddress ?? zeroAddress;
  const listenerEvmAddress = connectedWallet?.evmAddress ?? null;
  const devBulletinFallback = import.meta.env.DEV ? currentBulletinAccount : null;
  const activeSubstrateAddress = connectedWallet ? (connectedWallet.substrateAddress ?? null) : (devBulletinFallback?.address ?? null);
  const activeSubstrateSigner = connectedWallet ? (connectedWallet.substrateSigner ?? null) : (devBulletinFallback?.signer ?? null);

  const getActiveWalletClient = useCallback(async (): Promise<Awaited<ReturnType<typeof getWalletClient>>> => {
    if (!connectedWallet) {
      throw new Error('Connect a wallet before signing this transaction.');
    }
    const chain = await resolveEvmChain(ethRpcUrl);
    if (connectedWallet.chainId !== undefined && connectedWallet.chainId !== chain.id) {
      throw new Error(chainMismatchMessage(chain.id, connectedWallet.chainId));
    }
    return connectedWallet.createEvmClient(chain, ethRpcUrl) as Awaited<ReturnType<typeof getWalletClient>>;
  }, [connectedWallet, ethRpcUrl]);

  const switchNetwork = useCallback(async () => {
    if (!connectedWallet || connectedWallet.method !== 'extension') {
      setTransactionFeedback({
        tone: 'error',
        title: 'Wallet app required',
        message: 'Only browser wallet connections can switch networks from Dotify.'
      });
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      const chain = await resolveEvmChain(ethRpcUrl);
      setExpectedChainId(chain.id);
      setTransactionFeedback({
        tone: 'pending',
        title: 'Switch network',
        message: `Confirm the network switch to chain ${chain.id} in your wallet.`
      });
      await switchExtensionNetwork(chain);
      setTransactionFeedback({
        tone: 'success',
        title: 'Network ready',
        message: `Your wallet is now connected to chain ${chain.id}.`
      });
    } catch (error) {
      setTransactionFeedback({
        tone: 'error',
        title: 'Network switch failed',
        message: error instanceof Error ? error.message : 'Open your wallet and switch to the expected network, then try again.'
      });
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, [connectedWallet, ethRpcUrl, switchExtensionNetwork, setTransactionFeedback]);

  // Resolve the RPC's chain id once so the wallet modal can flag a mismatch.
  useEffect(() => {
    let cancelled = false;
    resolveEvmChain(ethRpcUrl)
      .then(chain => {
        if (!cancelled) setExpectedChainId(chain.id);
      })
      .catch(() => {
        if (!cancelled) setExpectedChainId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ethRpcUrl]);

  // Once a wallet connects, retire the connect modal.
  useEffect(() => {
    if (walletState.status === 'connected') setShowWalletModal(false);
  }, [walletState.status, setShowWalletModal]);

  const value = useMemo<WalletContextValue>(
    () => ({
      walletState,
      connectedWallet,
      activeEvmAddress,
      listenerEvmAddress,
      activeSubstrateAddress,
      activeSubstrateSigner,
      currentBulletinAccount,
      ethRpcUrl,
      expectedChainId,
      isSwitchingNetwork,
      bulletinAccountIndex,
      setBulletinAccountIndex,
      getActiveWalletClient,
      switchNetwork,
      connectPasskey,
      connectExtension,
      disconnect,
      forgetPasskey,
      hasPrfSupport,
      hasStoredPasskey
    }),
    [
      walletState,
      connectedWallet,
      activeEvmAddress,
      listenerEvmAddress,
      activeSubstrateAddress,
      activeSubstrateSigner,
      currentBulletinAccount,
      ethRpcUrl,
      expectedChainId,
      isSwitchingNetwork,
      bulletinAccountIndex,
      getActiveWalletClient,
      switchNetwork,
      connectPasskey,
      connectExtension,
      disconnect,
      forgetPasskey,
      hasPrfSupport,
      hasStoredPasskey
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWalletContext must be used within a WalletProvider.');
  return value;
}
