// Dotify wallet — account authority for protected and paid actions.
//
// Tier 1 · Extension (MetaMask / Talisman EVM / SubWallet EVM)
//   window.ethereum → EVM via EIP-1193
//
// Tier 2 · Product host account
//   app-scoped Product identity → protected key/session proofs and Product CDM
//   writes only when the build explicitly selects that adapter.
//
// Dotify treats the EVM address or Product-derived H160 address as the
// canonical product identity. The older WebAuthn PRF-derived wallet route is
// retired from public flows because it can create a different identity when
// local credential metadata, origin, device sync, or PRF support changes.

import type { PolkadotSigner } from 'polkadot-api';
import { useState, useCallback, useEffect, useRef } from 'react';
import { createWalletClient, custom, type WalletClient, type Chain } from 'viem';
import { createClassicUnlockE2eWallet, isClassicUnlockE2e, shouldAllowClassicUnlockAccountLoss } from '../e2e/classicUnlockMock';
import {
  createArtistPublishE2eWallet,
  isArtistPublishE2e,
  isArtistPublishE2eScenarioRequested,
  shouldAutoConnectArtistPublishE2eWallet
} from '../e2e/artistPublishMock';
import { connectProductHostIdentity, probeProductHost, resolveProductHostConfig, type ProductHostStatus } from '../features/productHost/productHost';
import { isRoomJoinE2eContext } from '../e2e/roomJoinMock';
import { getStoredDisplayName } from '../features/identity/walletIdentity';
import { shortenAddress } from '../shared/utils/format';
import { getProviderErrorCode, parseChainId, toEip155ChainId } from '../features/wallet/network';
import {
  clearLegacyPasskeyData,
  clearStoredWalletMethod,
  hasLegacyPasskeyCredential,
  readRestorableWalletMethod,
  rememberExtensionWallet
} from '../features/wallet/passkeyPolicy';
import { PRODUCT_SR25519_SIGNATURE_SCHEME, type KeyRequestSigner } from '../services/keyService';

// ── Constants ────────────────────────────────────────────────────────────────

const CONNECT_TIMEOUT_MS = 42_000;

// ── Public types ─────────────────────────────────────────────────────────────

export type WalletMethod = 'extension' | 'product-host';

export type ConnectedWallet = {
  method: WalletMethod;
  /** Account label: host username when shared, otherwise a saved name or short address. */
  label: string;
  /** Host-provided display name. Presentation only, not proof of identity. */
  displayName?: string;
  /** Optional Substrate account used only for Bulletin Chain archival transactions */
  substrateAddress?: string;
  substrateSigner?: PolkadotSigner;
  /** EVM account used for Asset Hub contract calls */
  evmAddress: `0x${string}`;
  /** EIP-1193 chain id when the connected wallet reports one */
  chainId?: number;
  /** Optional identity signer for backend key/session requests. Product-host accounts use this without gaining EVM tx authority. */
  keyRequestSigner?: KeyRequestSigner;
  /** Build the right viem WalletClient for this connection type */
  createEvmClient?: (chain: Chain, rpcUrl: string) => WalletClient;
};

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting'; via: WalletMethod }
  | { status: 'connected'; wallet: ConnectedWallet }
  | { status: 'error'; message: string };

const productHostConfig = resolveProductHostConfig(import.meta.env);

// ── Internal: browser extension ───────────────────────────────────────────────

type EIP1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereumProvider() {
  return (window as unknown as Record<string, unknown>).ethereum as EIP1193 | undefined;
}

async function walletFromExtensionAddress(ethereum: EIP1193, evmAddress: `0x${string}`): Promise<ConnectedWallet> {
  const chainId = await ethereum
    .request({ method: 'eth_chainId' })
    .then(parseChainId)
    .catch(() => undefined);
  const label = `${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)}`;

  return {
    method: 'extension',
    label,
    evmAddress,
    chainId,
    createEvmClient: (chain, _rpcUrl) =>
      createWalletClient({
        account: evmAddress,
        chain,
        transport: custom(ethereum as Parameters<typeof custom>[0])
      })
  };
}

async function extensionConnect(options: { requestAccounts?: boolean } = {}): Promise<ConnectedWallet> {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error('No wallet app found. Install MetaMask, Talisman, or SubWallet, then reload Dotify.');
  }

  const accounts = await ethereum.request({ method: options.requestAccounts === false ? 'eth_accounts' : 'eth_requestAccounts' });
  const evmAddress = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
  if (!evmAddress) {
    throw new Error('No wallet address was approved. Open your wallet and allow Dotify to continue.');
  }

  return walletFromExtensionAddress(ethereum, evmAddress);
}

async function switchExtensionChain(chain: Chain): Promise<ConnectedWallet> {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error('No wallet app found. Install MetaMask, Talisman, or SubWallet, then reload Dotify.');
  }

  const chainId = toEip155ChainId(chain.id);
  const switchParams = { chainId };

  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [switchParams] });
  } catch (error) {
    if (getProviderErrorCode(error) !== 4902) {
      throw error;
    }

    const blockExplorerUrl = chain.blockExplorers?.default.url;
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          ...switchParams,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          ...(blockExplorerUrl ? { blockExplorerUrls: [blockExplorerUrl] } : {})
        }
      ]
    });
  }

  const accounts = await ethereum.request({ method: 'eth_accounts' });
  const evmAddress = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
  if (!evmAddress) {
    throw new Error('Reconnect your wallet before switching networks.');
  }

  const wallet = await walletFromExtensionAddress(ethereum, evmAddress);
  if (wallet.chainId !== chain.id) {
    throw new Error(`Select chain ${chain.id} in your wallet to continue. Your wallet is currently on chain ${wallet.chainId ?? 'unknown'}.`);
  }
  return wallet;
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), CONNECT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    // When an artist-publish scenario is explicitly requested via the URL, it is
    // authoritative: the classic-unlock auto-connect must not override a scenario
    // (e.g. missing-wallet) that intentionally leaves the wallet disconnected.
    if (isArtistPublishE2eScenarioRequested()) {
      return shouldAutoConnectArtistPublishE2eWallet() ? { status: 'connected', wallet: createArtistPublishE2eWallet() } : { status: 'disconnected' };
    }
    // Room-join e2e contexts (host scenario or listener share link) stay wallet-
    // free: the room flow must work with no wallet, and this also stops the
    // classic-unlock flag from auto-connecting a wallet in those tabs.
    if (isRoomJoinE2eContext()) return { status: 'disconnected' };
    if (isClassicUnlockE2e) return { status: 'connected', wallet: createClassicUnlockE2eWallet() };
    return { status: 'disconnected' };
  });
  const [productHostStatus, setProductHostStatus] = useState<ProductHostStatus>(() => (productHostConfig.mode === 'off' ? 'off' : 'checking'));
  const [hasLegacyPasskeyData, setHasLegacyPasskeyData] = useState(hasLegacyPasskeyCredential);

  const connectionAttemptRef = useRef(0);
  const connectedMethod = state.status === 'connected' ? state.wallet.method : null;

  const connectExtension = useCallback(async () => {
    const attempt = ++connectionAttemptRef.current;
    if (isArtistPublishE2e) {
      setState({ status: 'connected', wallet: createArtistPublishE2eWallet() });
      return;
    }
    if (isClassicUnlockE2e) {
      if (shouldAllowClassicUnlockAccountLoss()) {
        setState({ status: 'disconnected' });
        return;
      }
      setState({ status: 'connected', wallet: createClassicUnlockE2eWallet() });
      return;
    }
    setState({ status: 'connecting', via: 'extension' });
    try {
      const wallet = await withTimeout(extensionConnect(), 'Wallet connection timed out. Open your wallet, approve Dotify, then try again.');
      if (attempt !== connectionAttemptRef.current) return;
      rememberExtensionWallet();
      setState({ status: 'connected', wallet });
    } catch (e) {
      if (attempt !== connectionAttemptRef.current) return;
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Wallet connection failed.' });
    }
  }, []);

  const connectProductHost = useCallback(async () => {
    const attempt = ++connectionAttemptRef.current;
    setState({ status: 'connecting', via: 'product-host' });
    try {
      const identity = await withTimeout(
        connectProductHostIdentity(productHostConfig),
        'The Polkadot Product host did not answer in time. Reopen Dotify from the Product host and try again.'
      );
      if (attempt !== connectionAttemptRef.current) return;
      setProductHostStatus('available');
      clearStoredWalletMethod();
      setState({
        status: 'connected',
        wallet: {
          method: 'product-host',
          label: getStoredDisplayName(identity.evmAddress) ?? shortenAddress(identity.evmAddress),
          substrateAddress: identity.substrateAddress,
          evmAddress: identity.evmAddress,
          keyRequestSigner: {
            signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
            address: identity.evmAddress,
            productPublicKey: identity.productPublicKey,
            signMessage: identity.signMessage
          }
        }
      });
      // A name permission prompt must not block the account or undo a newer
      // connect/disconnect. No global cache: each account reads its own profile.
      void withTimeout(identity.readDisplayName(), 'Name sharing timed out.')
        .then(name => {
          if (!name || attempt !== connectionAttemptRef.current) return;
          setState(current =>
            attempt === connectionAttemptRef.current &&
            current.status === 'connected' &&
            current.wallet.method === 'product-host' &&
            current.wallet.evmAddress === identity.evmAddress
              ? { status: 'connected', wallet: { ...current.wallet, label: name, displayName: name } }
              : current
          );
        })
        .catch(() => {
          /* Optional identity sharing does not disconnect an authorized account. */
        });
    } catch (error) {
      if (attempt !== connectionAttemptRef.current) return;
      setProductHostStatus('unavailable');
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'The Polkadot Product account could not be connected.'
      });
    }
  }, []);

  const switchExtensionNetwork = useCallback(async (chain: Chain) => {
    const attempt = ++connectionAttemptRef.current;
    if (isArtistPublishE2e) {
      const wallet = { ...createArtistPublishE2eWallet(), chainId: chain.id };
      setState({ status: 'connected', wallet });
      return wallet;
    }
    if (isClassicUnlockE2e) {
      const wallet = createClassicUnlockE2eWallet();
      setState({ status: 'connected', wallet });
      return wallet;
    }
    const wallet = await withTimeout(switchExtensionChain(chain), 'Network switch timed out. Check your wallet, then try again.');
    if (attempt !== connectionAttemptRef.current) return wallet;
    rememberExtensionWallet();
    setState({ status: 'connected', wallet });
    return wallet;
  }, []);

  const disconnect = useCallback(() => {
    ++connectionAttemptRef.current;
    if (isArtistPublishE2e) {
      setState({ status: 'disconnected' });
      return;
    }
    if (isClassicUnlockE2e) {
      setState({ status: 'connected', wallet: createClassicUnlockE2eWallet() });
      return;
    }
    clearStoredWalletMethod();
    setState({ status: 'disconnected' });
  }, []);

  useEffect(() => {
    if (isClassicUnlockE2e || isArtistPublishE2e) return;
    let cancelled = false;
    const lastMethod = readRestorableWalletMethod();
    if (lastMethod !== 'extension') return;
    const restoreMethod = lastMethod;

    async function restoreWallet() {
      const attempt = ++connectionAttemptRef.current;
      setState({ status: 'connecting', via: restoreMethod });
      try {
        const wallet = await withTimeout(extensionConnect({ requestAccounts: false }), 'Wallet restore timed out.');
        if (!cancelled && attempt === connectionAttemptRef.current) {
          setState({ status: 'connected', wallet });
        }
      } catch {
        if (!cancelled && attempt === connectionAttemptRef.current) {
          clearStoredWalletMethod();
          setState({ status: 'disconnected' });
        }
      }
    }

    void restoreWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void probeProductHost(productHostConfig.mode).then(status => {
      if (!cancelled) setProductHostStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isClassicUnlockE2e || isArtistPublishE2e) return;
    if (connectedMethod !== 'extension') return;
    const ethereum = getEthereumProvider();
    if (!ethereum?.on || !ethereum.removeListener) return;
    const provider = ethereum;

    let cancelled = false;
    function handleAccountsChanged(accounts: unknown) {
      const attempt = ++connectionAttemptRef.current;
      const evmAddress = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
      if (!evmAddress) {
        clearStoredWalletMethod();
        setState({ status: 'disconnected' });
        return;
      }

      void walletFromExtensionAddress(provider, evmAddress).then(wallet => {
        if (cancelled || attempt !== connectionAttemptRef.current) return;
        rememberExtensionWallet();
        setState({ status: 'connected', wallet });
      });
    }

    function handleChainChanged(chainId: unknown) {
      const parsedChainId = parseChainId(chainId);
      setState(current =>
        current.status === 'connected' && current.wallet.method === 'extension'
          ? { status: 'connected', wallet: { ...current.wallet, chainId: parsedChainId } }
          : current
      );
    }

    function handleDisconnect() {
      ++connectionAttemptRef.current;
      clearStoredWalletMethod();
      setState({ status: 'disconnected' });
    }

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);
    provider.on?.('disconnect', handleDisconnect);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [connectedMethod]);

  const forgetLegacyPasskeyData = useCallback(() => {
    clearLegacyPasskeyData();
    setHasLegacyPasskeyData(false);
  }, []);

  return {
    state,
    connectExtension,
    connectProductHost,
    switchExtensionNetwork,
    disconnect,
    hasLegacyPasskeyData,
    forgetLegacyPasskeyData,
    productHostMode: productHostConfig.mode,
    productHostStatus
  };
}
