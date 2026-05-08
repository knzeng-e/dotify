// Dotify wallet — two-tier signing without seed phrases.
//
// Tier 1 · Passkey (WebAuthn PRF)
//   WebAuthn credential + PRF extension → 32-byte deterministic secret
//   → KeyManager.fromRawKey → Substrate signer + EVM private key
//   No extension, no seed phrase. Works via Face ID / Touch ID / Windows Hello.
//   Browser support: Chrome 116+, Firefox 119+, Safari 17.4+
//
// Tier 2 · Extension (Talisman / SubWallet)
//   SignerManager.connect("extension") → PolkadotSigner (Substrate)
//   window.ethereum (if present)       → EVM via EIP-1193
//
// Both tiers expose the same ConnectedWallet shape so callers don't care
// which tier is active.

import { KeyManager } from '@polkadot-apps/keys';
import { bytesToHex } from '@polkadot-apps/utils';
import type { PolkadotSigner } from 'polkadot-api';
import { privateKeyToAccount } from 'viem/accounts';
import { SignerManager } from '@polkadot-apps/signer';
import { useState, useCallback, useRef } from 'react';
import { createWalletClient, http, custom, type WalletClient, type Chain } from 'viem';

// ── Constants ────────────────────────────────────────────────────────────────

// Changing PRF_SALT rotates ALL derived keys — all connected accounts change.
const PRF_SALT = new TextEncoder().encode('dotify-wallet-v1');
const CRED_KEY = 'dotify:passkey:credId';
const SS58_PREFIX = 42; // adapt prefix for target chain (42 = generic Substrate, 0 = Polkadot, 2 = Kusama, etc.)
const CONNECT_TIMEOUT_MS = 42_000;

// ── Public types ─────────────────────────────────────────────────────────────

export type WalletMethod = 'passkey' | 'extension';

export type ConnectedWallet = {
  method: WalletMethod;
  /** Short label shown in the UI (e.g. "Passkey" or "5GrwvA…utQY") */
  label: string;
  /** Substrate account used for Bulletin Chain transactions */
  substrateAddress: string;
  substrateSigner: PolkadotSigner;
  /** EVM account used for Asset Hub contract calls */
  evmAddress: `0x${string}`;
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
    createEvmClient: (chain, rpcUrl) =>
      createWalletClient({ account: evmAcc, chain, transport: http(rpcUrl) }),
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
        extensions: extensions as unknown as AuthenticationExtensionsClientInputs,
      },
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
        displayName: 'Dotify User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (P-256)
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: extensions as unknown as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential;

  const prf = (cred.getClientExtensionResults() as Record<string, PrfResult>).prf;
  if (!prf?.results?.first) {
    throw new Error(
      'Your browser or authenticator does not support the PRF extension. ' +
        'Try Chrome 116+, Firefox 119+, or a FIDO2 hardware key.'
    );
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

async function extensionConnect(): Promise<ConnectedWallet> {
  const manager = new SignerManager({
    ss58Prefix: SS58_PREFIX,
    dappName: 'Dotify',
    persistence: localStorage,
  });

  const result = await manager.connect('extension');
  if (!result.ok || result.value.length === 0) {
    manager.destroy();
    throw new Error(
      'No extension accounts found. Install Talisman or SubWallet, create an account, and reload.'
    );
  }

  manager.selectAccount(result.value[0].address);
  const substrateSigner = manager.getSigner();
  if (!substrateSigner) {
    manager.destroy();
    throw new Error('Could not get signer from extension.');
  }

  const substrateAddress = result.value[0].address;
  const label = `${substrateAddress.slice(0, 6)}…${substrateAddress.slice(-4)}`;

  // EVM: use window.ethereum if available (Talisman EVM mode, MetaMask, etc.)
  type EIP1193 = { request: (args: { method: string }) => Promise<string[]> };
  const ethereum = (window as unknown as Record<string, unknown>).ethereum as EIP1193 | undefined;

  if (ethereum) {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const evmAddress = accounts[0] as `0x${string}`;
    return {
      method: 'extension',
      label,
      substrateAddress,
      substrateSigner,
      evmAddress,
      // Signing delegated to the extension via window.ethereum
      createEvmClient: (chain, _rpcUrl) =>
        createWalletClient({
          account: evmAddress,
          chain,
          transport: custom(ethereum as Parameters<typeof custom>[0]),
        }),
    };
  }

  // No window.ethereum: Substrate-only. EVM ops will throw with a clear message.
  const noEvmAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  return {
    method: 'extension',
    label,
    substrateAddress,
    substrateSigner,
    evmAddress: noEvmAddress,
    createEvmClient: () => {
      throw new Error(
        'Enable EVM in your wallet (Talisman → Settings → Enable Ethereum) to sign on-chain transactions.'
      );
    },
  };
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
  const managerRef = useRef<SignerManager | null>(null);

  const connectPasskey = useCallback(async () => {
    setState({ status: 'connecting', via: 'passkey' });
    try {
      const wallet = await withTimeout(passkeyConnect(), 'Passkey authentication timed out. Try again from a secure origin such as localhost or HTTPS.');
      setState({ status: 'connected', wallet });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Passkey authentication failed.' });
    }
  }, []);

  const connectExtension = useCallback(async () => {
    setState({ status: 'connecting', via: 'extension' });
    try {
      const wallet = await withTimeout(extensionConnect(), 'Wallet extension connection timed out. Unlock the extension, approve Dotify, then try again.');
      setState({ status: 'connected', wallet });
    } catch (e) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Extension connection failed.' });
    }
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.destroy();
    managerRef.current = null;
    setState({ status: 'disconnected' });
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
  }, []);

  return { state, connectPasskey, connectExtension, disconnect, hasPrfSupport, hasStoredPasskey, forgetPasskey };
}
