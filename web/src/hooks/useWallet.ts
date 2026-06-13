// Dotify wallet — primary EVM signing without seed phrases.
//
// Tier 1 · Passkey (WebAuthn PRF)
//   WebAuthn credential + PRF extension → 32-byte deterministic secret
//   → KeyManager.fromRawKey → EVM private key + optional Substrate signer
//   No extension, no seed phrase. Works via Face ID / Touch ID / Windows Hello.
//   Browser support: Chrome 116+, Firefox 119+, Safari 17.4+
//
// Tier 2 · Extension (MetaMask / Talisman EVM / SubWallet EVM)
//   window.ethereum → EVM via EIP-1193
//
// Dotify treats the EVM address as the canonical product identity. Substrate is
// only exposed by the passkey path for optional Bulletin archival writes.

import { KeyManager } from '@polkadot-apps/keys';
import { bytesToHex } from '@polkadot-apps/utils';
import type { PolkadotSigner } from 'polkadot-api';
import { privateKeyToAccount } from 'viem/accounts';
import { useState, useCallback, useEffect } from 'react';
import { createWalletClient, http, custom, type WalletClient, type Chain } from 'viem';

// ── Constants ────────────────────────────────────────────────────────────────

// Changing PRF_SALT rotates ALL derived keys — all connected accounts change.
const PRF_SALT = new TextEncoder().encode('dotify-wallet-v1');
const CRED_KEY = 'dotify:passkey:credId';
const LAST_METHOD_KEY = 'dotify:wallet:lastMethod';
const SS58_PREFIX = 42; // adapt prefix for target chain (42 = generic Substrate, 0 = Polkadot, 2 = Kusama, etc.)
const CONNECT_TIMEOUT_MS = 42_000;

// ── Public types ─────────────────────────────────────────────────────────────

export type WalletMethod = 'passkey' | 'extension';

export type ConnectedWallet = {
  method: WalletMethod;
  /** Short label shown in the UI (e.g. "Passkey" or "5GrwvA…utQY") */
  label: string;
  /** Optional Substrate account used only for Bulletin Chain archival transactions */
  substrateAddress?: string;
  substrateSigner?: PolkadotSigner;
  /** EVM account used for Asset Hub contract calls */
  evmAddress: `0x${string}`;
  /** EIP-1193 chain id when the connected wallet reports one */
  chainId?: number;
  /** Build the right viem WalletClient for this connection type */
  createEvmClient: (chain: Chain, rpcUrl: string) => WalletClient;
};

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting'; via: WalletMethod }
  | { status: 'connected'; wallet: ConnectedWallet }
  | { status: 'error'; message: string };

// ── Internal: key derivation ─────────────────────────────────────────────────

/** Build a ConnectedWallet from a KeyManager (passkey path). */
function walletFromKeyManager(km: KeyManager, method: WalletMethod, label: string): ConnectedWallet {
  const subAcc = km.deriveAccount('dotify:substrate:v1', SS58_PREFIX);
  const evmKeyBytes = km.deriveSymmetricKey('dotify:evm:v1');
  const evmPrivKey = `0x${bytesToHex(evmKeyBytes)}` as `0x${string}`;
  const evmAcc = privateKeyToAccount(evmPrivKey);

  return {
    method,
    label,
    substrateAddress: subAcc.ss58Address,
    substrateSigner: subAcc.signer,
    evmAddress: evmAcc.address,
    createEvmClient: (chain, rpcUrl) => createWalletClient({ account: evmAcc, chain, transport: http(rpcUrl) })
  };
}

// ── Internal: WebAuthn PRF ────────────────────────────────────────────────────

// PRF extension types are not in the standard TS lib — assert as needed.
type PrfResult = { results?: { first?: ArrayBuffer } };
type PrfExtInput = { eval: { first: Uint8Array } };

async function prfGet(credId?: Uint8Array): Promise<Uint8Array> {
  const extensions = { prf: { eval: { first: PRF_SALT } } as unknown as PrfExtInput };

  if (credId) {
    // Returning user: assertion
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: credId }],
        userVerification: 'required',
        extensions: extensions as unknown as AuthenticationExtensionsClientInputs
      }
    })) as PublicKeyCredential;

    const prf = (assertion.getClientExtensionResults() as Record<string, PrfResult>).prf;
    if (!prf?.results?.first) throw new Error('Authenticator does not support the PRF extension.');
    return new Uint8Array(prf.results.first);
  }

  // New user: registration
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Dotify', id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'dotify-user',
        displayName: 'Dotify User'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256 (P-256)
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: extensions as unknown as AuthenticationExtensionsClientInputs
    }
  })) as PublicKeyCredential;

  const prf = (cred.getClientExtensionResults() as Record<string, PrfResult>).prf;
  if (!prf?.results?.first) {
    throw new Error('Your browser or authenticator does not support the PRF extension. ' + 'Try Chrome 116+, Firefox 119+, or a FIDO2 hardware key.');
  }

  // Persist credential ID so future logins can locate the right credential.
  localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
  return new Uint8Array(prf.results.first);
}

async function passkeyConnect(): Promise<ConnectedWallet> {
  const storedId = localStorage.getItem(CRED_KEY);
  const credId = storedId ? Uint8Array.from(atob(storedId), c => c.charCodeAt(0)) : undefined;
  const prfOutput = await prfGet(credId);
  const km = KeyManager.fromRawKey(prfOutput);
  return walletFromKeyManager(km, 'passkey', 'Passkey');
}

// ── Internal: browser extension ───────────────────────────────────────────────

type EIP1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereumProvider() {
  return (window as unknown as Record<string, unknown>).ethereum as EIP1193 | undefined;
}

function parseChainId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = value.startsWith('0x') ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function walletFromExtensionAddress(ethereum: EIP1193, evmAddress: `0x${string}`): Promise<ConnectedWallet> {
  const chainId = await ethereum.request({ method: 'eth_chainId' }).then(parseChainId).catch(() => undefined);
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
  const [state, setState] = useState<WalletState>({ status: 'disconnected' });

  const connectPasskey = useCallback(async () => {
    setState({ status: 'connecting', via: 'passkey' });
    try {
      const wallet = await withTimeout(passkeyConnect(), 'Passkey timed out. Check the browser prompt, then try again.');
      localStorage.setItem(LAST_METHOD_KEY, 'passkey');
      setState({ status: 'connected', wallet });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Passkey sign in failed.' });
    }
  }, []);

  const connectExtension = useCallback(async () => {
    setState({ status: 'connecting', via: 'extension' });
    try {
      const wallet = await withTimeout(extensionConnect(), 'Wallet connection timed out. Open your wallet, approve Dotify, then try again.');
      localStorage.setItem(LAST_METHOD_KEY, 'extension');
      setState({ status: 'connected', wallet });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Wallet connection failed.' });
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(LAST_METHOD_KEY);
    setState({ status: 'disconnected' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const lastMethod = localStorage.getItem(LAST_METHOD_KEY) as WalletMethod | null;
    if (lastMethod !== 'extension' && lastMethod !== 'passkey') return;
    const restoreMethod = lastMethod;

    async function restoreWallet() {
      setState({ status: 'connecting', via: restoreMethod });
      try {
        const wallet =
          restoreMethod === 'extension'
            ? await withTimeout(extensionConnect({ requestAccounts: false }), 'Wallet restore timed out.')
            : await withTimeout(passkeyConnect(), 'Passkey restore timed out.');
        if (!cancelled) {
          setState({ status: 'connected', wallet });
        }
      } catch {
        if (restoreMethod === 'extension') {
          localStorage.removeItem(LAST_METHOD_KEY);
        }
        if (!cancelled) {
          setState({ status: 'disconnected' });
        }
      }
    }

    void restoreWallet();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ethereum = getEthereumProvider();
    if (!ethereum?.on || !ethereum.removeListener) return;
    const provider = ethereum;

    function handleAccountsChanged(accounts: unknown) {
      const evmAddress = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
      if (!evmAddress) {
        localStorage.removeItem(LAST_METHOD_KEY);
        setState({ status: 'disconnected' });
        return;
      }

      void walletFromExtensionAddress(provider, evmAddress).then(wallet => {
        localStorage.setItem(LAST_METHOD_KEY, 'extension');
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
      localStorage.removeItem(LAST_METHOD_KEY);
      setState({ status: 'disconnected' });
    }

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);
    provider.on?.('disconnect', handleDisconnect);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, []);

  /** True when the browser supports WebAuthn with the PRF extension. */
  const hasPrfSupport =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator?.credentials?.get === 'function' &&
    typeof window.PublicKeyCredential !== 'undefined';

  /** True when the user has a stored passkey credential in this browser. */
  const hasStoredPasskey = typeof window !== 'undefined' && !!localStorage.getItem(CRED_KEY);

  const forgetPasskey = useCallback(() => {
    localStorage.removeItem(CRED_KEY);
    if (localStorage.getItem(LAST_METHOD_KEY) === 'passkey') {
      localStorage.removeItem(LAST_METHOD_KEY);
    }
  }, []);

  return { state, connectPasskey, connectExtension, disconnect, hasPrfSupport, hasStoredPasskey, forgetPasskey };
}
