import { Activity, CircleAlert, CircleCheckBig, CircleHelp, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import {
  buildHealthUrl,
  displayEndpoint,
  pickIpfsProbeRef,
  statusTextForTone,
  summarizeReadiness,
  type ReadinessCheck,
  type ReadinessTone
} from '../features/observability/productionReadiness';
import { getGatewayUrlsForAssetRef } from '../services/pinata';
import { deployments } from '../shared/config/deployments';
import { ensureContract, getPublicClient } from '../shared/config/contracts';
import { EndpointRow } from '../shared/ui/EndpointRow';
import type { CatalogTrack } from '../shared/types';

const FETCH_TIMEOUT_MS = 5_000;
const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
const BACKEND_API_URL = import.meta.env.VITE_DOTIFY_API_URL as string | undefined;

export type ProductionReadinessPanelProps = {
  catalogTracks: CatalogTrack[];
  catalogStatus: string;
  ethRpcUrl: string;
  expectedChainId: number | null;
  walletChainId?: number;
};

export function ProductionReadinessPanel({ catalogTracks, catalogStatus, ethRpcUrl, expectedChainId, walletChainId }: ProductionReadinessPanelProps) {
  const { pushNotice } = useUiFeedback();
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const summary = useMemo(() => summarizeReadiness(checks), [checks]);

  async function refresh() {
    setRefreshing(true);
    const nextChecks = await runReadinessChecks({ catalogTracks, catalogStatus, ethRpcUrl, expectedChainId, walletChainId });
    setChecks(nextChecks);
    setLastCheckedAt(Date.now());
    setRefreshing(false);

    const nextSummary = summarizeReadiness(nextChecks);
    if (nextSummary.tone === 'error') {
      pushNotice({
        tone: 'error',
        title: 'Production checks need attention',
        message: `${nextSummary.problemCount} readiness check${nextSummary.problemCount === 1 ? '' : 's'} failed. Open You > Production readiness for details.`
      });
    }
  }

  useEffect(() => {
    void refresh();
    // Run when the environment inputs materially change; manual refresh covers
    // transient endpoint recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogTracks.length, catalogStatus, ethRpcUrl, expectedChainId, walletChainId]);

  return (
    <section className='you-panel readiness-panel' aria-labelledby='readiness-panel-title'>
      <div className='you-panel-head readiness-panel-head'>
        <span className='you-panel-icon'>
          <Activity size={18} />
        </span>
        <div>
          <strong id='readiness-panel-title'>Production readiness</strong>
          <span>Read-only checks for the public listening spine</span>
        </div>
        <span className='readiness-summary' data-tone={summary.tone}>
          {summary.label}
        </span>
      </div>

      <div className='readiness-meta'>
        <span>{lastCheckedAt ? `Checked ${new Date(lastCheckedAt).toLocaleTimeString()}` : 'Waiting for first check'}</span>
        <button className='secondary-action compact-action' type='button' onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : undefined} />
          Refresh
        </button>
      </div>

      <div className='readiness-list' aria-live='polite'>
        {checks.map(check => (
          <EndpointRow
            key={check.id}
            label={check.label}
            value={
              <div className='readiness-check-value'>
                <span className='readiness-check-state' data-tone={check.tone}>
                  <ReadinessIcon tone={check.tone} />
                  {statusTextForTone(check.tone)}
                </span>
                <small>{check.target}</small>
                <p>{check.detail}</p>
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}

function ReadinessIcon({ tone }: { tone: ReadinessTone }) {
  if (tone === 'ok') return <CircleCheckBig size={14} aria-hidden='true' />;
  if (tone === 'error') return <CircleAlert size={14} aria-hidden='true' />;
  return <CircleHelp size={14} aria-hidden='true' />;
}

async function runReadinessChecks(input: ProductionReadinessPanelProps): Promise<ReadinessCheck[]> {
  return Promise.all([
    checkBackend(),
    checkSignaling(),
    checkRpc(input.ethRpcUrl, input.expectedChainId),
    checkWalletChain(input.expectedChainId, input.walletChainId),
    checkContract('directory', 'Artist directory', deployments.directory, input.ethRpcUrl),
    checkContract('factory', 'Artist factory', deployments.factory, input.ethRpcUrl),
    checkCatalog(input.catalogStatus),
    checkIpfs(input.catalogTracks)
  ]);
}

async function checkBackend(): Promise<ReadinessCheck> {
  const target = displayEndpoint(BACKEND_API_URL);
  const url = buildHealthUrl(BACKEND_API_URL, '/health/ready');
  if (!BACKEND_API_URL) {
    return {
      id: 'backend',
      label: 'Backend API',
      target,
      tone: 'warning',
      detail: 'Backend API is not configured. Uploads and protected keys stay in demo/local mode.'
    };
  }
  if (!url) return { id: 'backend', label: 'Backend API', target, tone: 'error', detail: 'Backend API URL is invalid.' };

  const response = await fetchJson(url);
  if (!response.ok) return { id: 'backend', label: 'Backend API', target, tone: 'error', detail: response.detail };

  const body = response.body as { ready?: boolean; status?: string } | null;
  if (body?.ready === false) return { id: 'backend', label: 'Backend API', target, tone: 'error', detail: 'Backend readiness failed.' };
  if (body?.status === 'degraded')
    return { id: 'backend', label: 'Backend API', target, tone: 'warning', detail: 'Backend is reachable but reports degraded dependencies.' };
  return { id: 'backend', label: 'Backend API', target, tone: 'ok', detail: 'Backend readiness endpoint is reachable.' };
}

async function checkSignaling(): Promise<ReadinessCheck> {
  const target = displayEndpoint(SIGNAL_URL);
  const url = buildHealthUrl(SIGNAL_URL, '/health');
  if (!url) return { id: 'signaling', label: 'Signaling', target, tone: 'error', detail: 'Signaling URL is invalid.' };

  const response = await fetchJson(url);
  if (!response.ok) return { id: 'signaling', label: 'Signaling', target, tone: 'error', detail: response.detail };

  const body = response.body as { rooms?: number; listeners?: number; soloListeners?: number } | null;
  return {
    id: 'signaling',
    label: 'Signaling',
    target,
    tone: 'ok',
    detail: `Signaling is reachable (${body?.rooms ?? 0} rooms, ${body?.listeners ?? 0} room listeners, ${body?.soloListeners ?? 0} solo listeners).`
  };
}

async function checkRpc(ethRpcUrl: string, expectedChainId: number | null): Promise<ReadinessCheck> {
  const target = displayEndpoint(ethRpcUrl);
  try {
    const chainId = await getPublicClient(ethRpcUrl).getChainId();
    if (expectedChainId !== null && chainId !== expectedChainId) {
      return {
        id: 'rpc',
        label: 'Chain RPC',
        target,
        tone: 'error',
        detail: `RPC returned chain ${chainId}, but Dotify expected ${expectedChainId}.`
      };
    }
    return { id: 'rpc', label: 'Chain RPC', target, tone: 'ok', detail: `RPC is reachable on chain ${chainId}.` };
  } catch {
    return { id: 'rpc', label: 'Chain RPC', target, tone: 'error', detail: 'Chain RPC is not reachable. Catalog and access checks will fail closed.' };
  }
}

async function checkWalletChain(expectedChainId: number | null, walletChainId?: number): Promise<ReadinessCheck> {
  if (walletChainId === undefined) {
    return {
      id: 'wallet-chain',
      label: 'Wallet network',
      target: expectedChainId === null ? 'unknown chain' : `chain ${expectedChainId}`,
      tone: 'unknown',
      detail: 'No wallet is connected. Protected actions will ask for a wallet before signing.'
    };
  }
  if (expectedChainId !== null && walletChainId !== expectedChainId) {
    return {
      id: 'wallet-chain',
      label: 'Wallet network',
      target: `wallet chain ${walletChainId}`,
      tone: 'error',
      detail: `Wallet is on chain ${walletChainId}; Dotify expects chain ${expectedChainId}.`
    };
  }
  return {
    id: 'wallet-chain',
    label: 'Wallet network',
    target: `chain ${walletChainId}`,
    tone: 'ok',
    detail: 'Wallet network matches the configured Dotify chain.'
  };
}

async function checkContract(id: string, label: string, address: `0x${string}` | undefined, ethRpcUrl: string): Promise<ReadinessCheck> {
  if (!address) return { id, label, target: 'not configured', tone: 'error', detail: `${label} address is not configured.` };
  try {
    const exists = await ensureContract(address, ethRpcUrl);
    return exists
      ? { id, label, target: address, tone: 'ok', detail: `${label} code is present on the configured chain.` }
      : { id, label, target: address, tone: 'error', detail: `${label} code was not found on the configured chain.` };
  } catch {
    return { id, label, target: address, tone: 'error', detail: `${label} could not be checked because the chain read failed.` };
  }
}

async function checkCatalog(catalogStatus: string): Promise<ReadinessCheck> {
  const lowerStatus = catalogStatus.toLowerCase();
  if (lowerStatus.includes('temporarily unavailable') || lowerStatus.includes('unavailable') || lowerStatus.includes('not configured')) {
    return { id: 'catalog', label: 'Catalog read', target: 'artist directory', tone: 'error', detail: catalogStatus };
  }
  if (lowerStatus.includes('loading')) {
    return { id: 'catalog', label: 'Catalog read', target: 'artist directory', tone: 'unknown', detail: catalogStatus };
  }
  if (lowerStatus.includes('no tracks')) {
    return { id: 'catalog', label: 'Catalog read', target: 'artist directory', tone: 'warning', detail: catalogStatus };
  }
  return { id: 'catalog', label: 'Catalog read', target: 'artist directory', tone: 'ok', detail: catalogStatus };
}

async function checkIpfs(catalogTracks: CatalogTrack[]): Promise<ReadinessCheck> {
  const probeRef = pickIpfsProbeRef(catalogTracks);
  if (!probeRef) {
    return {
      id: 'ipfs',
      label: 'IPFS gateway',
      target: 'catalog asset',
      tone: 'unknown',
      detail: 'No IPFS-backed catalog asset is available to probe yet.'
    };
  }

  const gateways = getGatewayUrlsForAssetRef(probeRef);
  for (const gateway of gateways) {
    try {
      const response = await fetchWithTimeout(gateway, {
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store'
      });
      if (response.ok || response.status === 206) {
        return {
          id: 'ipfs',
          label: 'IPFS gateway',
          target: displayEndpoint(gateway),
          tone: 'ok',
          detail: 'A catalog asset was readable through the gateway fallback chain.'
        };
      }
    } catch {
      // Try the next configured gateway.
    }
  }

  return {
    id: 'ipfs',
    label: 'IPFS gateway',
    target: 'gateway fallback chain',
    tone: 'error',
    detail: 'Configured IPFS gateways could not read the selected catalog asset.'
  };
}

async function fetchJson(url: string): Promise<{ ok: true; body: unknown } | { ok: false; detail: string }> {
  try {
    const response = await fetchWithTimeout(url, { cache: 'no-store' });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) return { ok: false, detail: `Endpoint answered with HTTP ${response.status}.` };
    return { ok: true, body };
  } catch {
    return { ok: false, detail: 'Endpoint did not answer before the health-check timeout.' };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}
