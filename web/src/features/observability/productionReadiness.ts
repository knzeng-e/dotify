import type { CatalogTrack } from '../../shared/types';

export type ReadinessTone = 'ok' | 'warning' | 'error' | 'unknown';

export type ReadinessCheck = {
  id: string;
  label: string;
  target: string;
  tone: ReadinessTone;
  detail: string;
};

export type ReadinessSummary = {
  tone: ReadinessTone;
  label: string;
  problemCount: number;
};

type DebugPanelEnv = {
  VITE_DOTIFY_DEBUG_PANEL?: string | boolean;
};

export function isProductionReadinessPanelEnabled(env: DebugPanelEnv): boolean {
  return (
    String(env.VITE_DOTIFY_DEBUG_PANEL ?? '')
      .trim()
      .toLowerCase() === 'true'
  );
}

export function summarizeReadiness(checks: ReadinessCheck[]): ReadinessSummary {
  if (checks.length === 0) return { tone: 'unknown', label: 'Not checked yet', problemCount: 0 };

  const problemCount = checks.filter(check => check.tone === 'error' || check.tone === 'warning').length;
  if (checks.some(check => check.tone === 'error')) return { tone: 'error', label: 'Needs attention', problemCount };
  if (checks.some(check => check.tone === 'warning')) return { tone: 'warning', label: 'Usable with caveats', problemCount };
  if (checks.some(check => check.tone === 'unknown')) return { tone: 'unknown', label: 'Partly unknown', problemCount };
  return { tone: 'ok', label: 'Ready', problemCount };
}

export function buildHealthUrl(baseUrl: string | undefined, path: '/health' | '/health/ready'): string | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function displayEndpoint(value: string | undefined): string {
  if (!value?.trim()) return 'not configured';

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return 'invalid URL';
  }
}

export function pickIpfsProbeRef(tracks: CatalogTrack[]): string | null {
  for (const track of tracks) {
    for (const ref of [track.metadataRef, track.imageRef, track.audioRef]) {
      if (ref.startsWith('ipfs://') || ref.includes('/ipfs/')) return ref;
    }
  }
  return null;
}

export function statusTextForTone(tone: ReadinessTone): string {
  switch (tone) {
    case 'ok':
      return 'Ready';
    case 'warning':
      return 'Check';
    case 'error':
      return 'Down';
    case 'unknown':
      return 'Unknown';
  }
}
