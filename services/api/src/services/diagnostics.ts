// Runtime diagnostics for the key service (Sprint 2, Ticket 10).
//
// Answers one question for a developer staring at a failure: is the problem
// configuration, the chain RPC, the artist directory, or an external
// dependency? Every check reports a boolean plus a human-readable detail and
// never includes secret material (only whether a secret is configured).
//
// Readiness semantics:
//   - `ready` means the key-delivery spine can work: the content-key master
//     secret is configured, the RPC answers with the expected chain ID, and
//     the artist directory is readable on-chain.
//   - Pinata and the factory address only degrade `status` (uploads or artist
//     onboarding would fail) without flipping readiness, because key delivery
//     for existing tracks does not depend on them.

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { config } from '../config.js';

const artistDirectoryAbi = [
  { type: 'function', name: 'artistCount', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
] as const;

const RPC_TIMEOUT_MS = 5_000;
const REPORT_CACHE_MS = 10_000;

export type DiagnosticCheck = {
  ok: boolean;
  detail: string;
};

export type DiagnosticsReport = {
  status: 'ok' | 'degraded' | 'unavailable';
  ready: boolean;
  checkedAt: string;
  checks: {
    contentKeySecret: DiagnosticCheck;
    rpc: DiagnosticCheck & { expectedChainId: number; chainId: number | null };
    directory: DiagnosticCheck;
    factory: DiagnosticCheck;
    pinata: DiagnosticCheck;
  };
};

export type DiagnosticsDeps = {
  getChainId: () => Promise<number>;
  readArtistCount: (directory: Address) => Promise<bigint>;
  getCode: (address: Address) => Promise<string | undefined>;
  now: () => number;
};

let clientCache: PublicClient | null = null;

function getClient(): PublicClient {
  if (!clientCache) {
    clientCache = createPublicClient({
      transport: http(config.PASEO_ASSET_HUB_RPC, { timeout: RPC_TIMEOUT_MS }),
    });
  }
  return clientCache;
}

const defaultDeps: DiagnosticsDeps = {
  getChainId: () => getClient().getChainId(),
  readArtistCount: directory =>
    getClient().readContract({ address: directory, abi: artistDirectoryAbi, functionName: 'artistCount' }) as Promise<bigint>,
  getCode: address => getClient().getCode({ address }),
  now: () => Date.now(),
};

export function createDiagnostics(deps: DiagnosticsDeps = defaultDeps): () => Promise<DiagnosticsReport> {
  let cached: { report: DiagnosticsReport; at: number } | null = null;

  return async function runDiagnostics(): Promise<DiagnosticsReport> {
    // Health probes can be frequent; the cache keeps them from hammering the
    // RPC while staying fresh enough for operators.
    if (cached && deps.now() - cached.at < REPORT_CACHE_MS) return cached.report;

    const contentKeySecret: DiagnosticCheck = config.CONTENT_KEY_MASTER_SECRET
      ? { ok: true, detail: 'Content-key master secret is configured.' }
      : { ok: false, detail: 'CONTENT_KEY_MASTER_SECRET is not configured; key derivation and uploads are disabled.' };

    const pinata: DiagnosticCheck = config.PINATA_JWT
      ? { ok: true, detail: 'Pinata JWT is configured.' }
      : { ok: false, detail: 'PINATA_JWT is not configured; audio uploads are disabled.' };

    let rpc: DiagnosticsReport['checks']['rpc'];
    if (!config.PASEO_ASSET_HUB_RPC) {
      rpc = { ok: false, detail: 'PASEO_ASSET_HUB_RPC is not configured; all on-chain access checks fail closed.', expectedChainId: config.DOTIFY_CHAIN_ID, chainId: null };
    } else {
      try {
        const chainId = await deps.getChainId();
        rpc =
          chainId === config.DOTIFY_CHAIN_ID
            ? { ok: true, detail: 'RPC reachable and chain ID matches.', expectedChainId: config.DOTIFY_CHAIN_ID, chainId }
            : { ok: false, detail: `RPC chain ID ${chainId} does not match expected ${config.DOTIFY_CHAIN_ID}; access checks would read the wrong chain.`, expectedChainId: config.DOTIFY_CHAIN_ID, chainId };
      } catch {
        rpc = { ok: false, detail: 'RPC is configured but unreachable; all on-chain access checks fail closed.', expectedChainId: config.DOTIFY_CHAIN_ID, chainId: null };
      }
    }

    let directory: DiagnosticCheck;
    if (!config.DOTIFY_DIRECTORY_ADDRESS) {
      directory = { ok: false, detail: 'DOTIFY_DIRECTORY_ADDRESS is not configured; track-to-runtime resolution is disabled.' };
    } else if (!rpc.ok) {
      directory = { ok: false, detail: 'Directory is configured but unverifiable while the RPC check fails.' };
    } else {
      try {
        const count = await deps.readArtistCount(config.DOTIFY_DIRECTORY_ADDRESS as Address);
        directory = { ok: true, detail: `Artist directory readable (${count} registered artists).` };
      } catch {
        directory = { ok: false, detail: 'Artist directory read failed; the address may be wrong or not a directory contract.' };
      }
    }

    let factory: DiagnosticCheck;
    if (!config.DOTIFY_FACTORY_ADDRESS) {
      factory = { ok: false, detail: 'DOTIFY_FACTORY_ADDRESS is not configured; artist runtime bootstrap diagnostics are unavailable.' };
    } else if (!rpc.ok) {
      factory = { ok: false, detail: 'Factory is configured but unverifiable while the RPC check fails.' };
    } else {
      try {
        const code = await deps.getCode(config.DOTIFY_FACTORY_ADDRESS as Address);
        factory =
          code && code !== '0x'
            ? { ok: true, detail: 'Factory contract code is present at the configured address.' }
            : { ok: false, detail: 'No contract code at the configured factory address.' };
      } catch {
        factory = { ok: false, detail: 'Factory code lookup failed.' };
      }
    }

    const ready = contentKeySecret.ok && rpc.ok && directory.ok;
    const status: DiagnosticsReport['status'] = !ready ? 'unavailable' : factory.ok && pinata.ok ? 'ok' : 'degraded';

    const report: DiagnosticsReport = {
      status,
      ready,
      checkedAt: new Date(deps.now()).toISOString(),
      checks: { contentKeySecret, rpc, directory, factory, pinata },
    };

    cached = { report, at: deps.now() };
    return report;
  };
}

export const runDiagnostics = createDiagnostics();
