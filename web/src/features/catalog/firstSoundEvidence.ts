import type { AudioStartupTelemetrySnapshot } from './audioStartupTelemetry';
import { normalizeIpfsCid } from '../../shared/utils/ipfsCid';

export const FIRST_SOUND_EVIDENCE_STORAGE_KEY = 'dotify:first-sound-evidence:v1';
export const MAX_FIRST_SOUND_SAMPLES = 120;

export const FIRST_SOUND_SURFACES = [
  'standalone-chrome',
  'standalone-firefox',
  'standalone-safari',
  'ios-safari',
  'android-chrome',
  'product-desktop',
  'product-web-gateway'
] as const;

export const FIRST_SOUND_FLOWS = ['free', 'authorized-protected', 'warm-next-track'] as const;

export type FirstSoundSurface = (typeof FIRST_SOUND_SURFACES)[number];
export type FirstSoundFlow = (typeof FIRST_SOUND_FLOWS)[number];

export type FirstSoundCandidate = {
  gitSha: string;
  productAppVersion: string | null;
  deployedCid: string | null;
};

export type FirstSoundAttempt = {
  id: string;
  surface: FirstSoundSurface;
  flow: FirstSoundFlow;
  startedAt: number;
};

export type FirstSoundSample = {
  id: string;
  surface: FirstSoundSurface;
  flow: FirstSoundFlow;
  outcome: 'first-audio' | 'error';
  firstSoundMs: number | null;
  capturedAt: string;
  dav2: {
    observed: boolean;
    fallback: boolean;
    hedged: boolean;
    intentPrefetched: boolean;
    decryptor: 'worker' | 'main-thread' | null;
    firstRangeBytes: number | null;
  };
};

export type FirstSoundEvidenceDraft = {
  schemaVersion: 1;
  candidate: FirstSoundCandidate;
  activeAttempt: FirstSoundAttempt | null;
  samples: FirstSoundSample[];
};

export type FirstSoundEvidence = {
  schemaVersion: 1;
  candidate: FirstSoundCandidate;
  capturedAt: string;
  samples: FirstSoundSample[];
  privacy: {
    walletAddressesCollected: false;
    mediaReferencesCollected: false;
    gatewayUrlsCollected: false;
    perListenerHistoryCollected: false;
  };
};

export type FirstSoundEvidenceContext = {
  buildSha: string | null;
  productAppVersion: string | null;
};

const FULL_SHA = /^[0-9a-f]{40}$/i;
const PRODUCT_VERSION = /^\[\d+,\s*\d+,\s*\d+\]$/;

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isSurface(value: unknown): value is FirstSoundSurface {
  return typeof value === 'string' && (FIRST_SOUND_SURFACES as readonly string[]).includes(value);
}

function isFlow(value: unknown): value is FirstSoundFlow {
  return typeof value === 'string' && (FIRST_SOUND_FLOWS as readonly string[]).includes(value);
}

function normalizeCandidate(candidate: FirstSoundCandidate): FirstSoundCandidate | null {
  const gitSha = candidate.gitSha.trim().toLowerCase();
  const productAppVersion = candidate.productAppVersion?.trim() || null;
  const rawCid = candidate.deployedCid?.trim() ?? '';
  const deployedCid = normalizeIpfsCid(rawCid) || null;
  if (!FULL_SHA.test(gitSha)) return null;
  if (productAppVersion && !PRODUCT_VERSION.test(productAppVersion)) return null;
  if (rawCid && !deployedCid) return null;
  return { gitSha, productAppVersion, deployedCid };
}

function parseSample(value: unknown): FirstSoundSample | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isSurface(value.surface) || !isFlow(value.flow)) return null;
  if (value.outcome !== 'first-audio' && value.outcome !== 'error') return null;
  if (value.firstSoundMs !== null && (typeof value.firstSoundMs !== 'number' || !Number.isFinite(value.firstSoundMs) || value.firstSoundMs < 0)) return null;
  if (typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))) return null;
  if (!isRecord(value.dav2)) return null;
  const decryptor = value.dav2.decryptor;
  if (decryptor !== null && decryptor !== 'worker' && decryptor !== 'main-thread') return null;
  const firstRangeBytes = value.dav2.firstRangeBytes;
  if (firstRangeBytes !== null && (!Number.isSafeInteger(firstRangeBytes) || (firstRangeBytes as number) <= 0)) return null;
  for (const field of ['observed', 'fallback', 'hedged', 'intentPrefetched'] as const) {
    if (typeof value.dav2[field] !== 'boolean') return null;
  }
  return value as FirstSoundSample;
}

function parseAttempt(value: unknown): FirstSoundAttempt | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isSurface(value.surface) || !isFlow(value.flow)) return null;
  if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt) || value.startedAt <= 0) return null;
  return value as FirstSoundAttempt;
}

function parseDraft(value: unknown): FirstSoundEvidenceDraft | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.candidate) || !Array.isArray(value.samples)) return null;
  const candidate = normalizeCandidate({
    gitSha: typeof value.candidate.gitSha === 'string' ? value.candidate.gitSha : '',
    productAppVersion: typeof value.candidate.productAppVersion === 'string' ? value.candidate.productAppVersion : null,
    deployedCid: typeof value.candidate.deployedCid === 'string' ? value.candidate.deployedCid : null
  });
  if (!candidate) return null;
  const samples = value.samples.map(parseSample);
  if (samples.some(sample => !sample)) return null;
  const activeAttempt = value.activeAttempt === null ? null : parseAttempt(value.activeAttempt);
  if (value.activeAttempt !== null && !activeAttempt) return null;
  return { schemaVersion: 1, candidate, activeAttempt, samples: samples.slice(-MAX_FIRST_SOUND_SAMPLES) as FirstSoundSample[] };
}

function sameCandidate(left: FirstSoundCandidate, right: FirstSoundCandidate): boolean {
  return left.gitSha === right.gitSha && left.productAppVersion === right.productAppVersion && left.deployedCid === right.deployedCid;
}

function writeDraft(draft: FirstSoundEvidenceDraft | null): void {
  const target = storage();
  if (!target) return;
  if (!draft) target.removeItem(FIRST_SOUND_EVIDENCE_STORAGE_KEY);
  else target.setItem(FIRST_SOUND_EVIDENCE_STORAGE_KEY, JSON.stringify(draft));
}

function createAttemptId(now: number): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${now}-${random}`;
}

export function readFirstSoundEvidenceDraft(): FirstSoundEvidenceDraft | null {
  const raw = storage()?.getItem(FIRST_SOUND_EVIDENCE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function bindFirstSoundCandidate(context: FirstSoundEvidenceContext, deployedCid: string): FirstSoundEvidenceDraft | null {
  const candidate = normalizeCandidate({
    gitSha: context.buildSha ?? '',
    productAppVersion: context.productAppVersion,
    deployedCid
  });
  if (!candidate) return null;
  const current = readFirstSoundEvidenceDraft();
  if (current && sameCandidate(current.candidate, candidate)) return current;
  const next: FirstSoundEvidenceDraft = { schemaVersion: 1, candidate, activeAttempt: null, samples: [] };
  writeDraft(next);
  return next;
}

export function productCandidateComplete(candidate: FirstSoundCandidate): boolean {
  return Boolean(candidate.productAppVersion && candidate.deployedCid);
}

export function surfaceNeedsProductCandidate(surface: FirstSoundSurface): boolean {
  return surface === 'product-desktop' || surface === 'product-web-gateway';
}

export function beginFirstSoundAttempt(surface: FirstSoundSurface, flow: FirstSoundFlow, now = Date.now()): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  if (!Number.isFinite(now) || now <= 0 || !current || (surfaceNeedsProductCandidate(surface) && !productCandidateComplete(current.candidate))) return null;
  const next = { ...current, activeAttempt: { id: createAttemptId(now), surface, flow, startedAt: now } };
  writeDraft(next);
  return next;
}

export function finishFirstSoundAttempt(snapshot: AudioStartupTelemetrySnapshot, now = Date.now()): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  const attempt = current?.activeAttempt;
  if (!Number.isFinite(now) || now <= 0 || !current || !attempt) return null;

  const hostEvents = snapshot.host.filter(metric => metric.timestamp >= attempt.startedAt);
  const sourceSelected = hostEvents.some(metric => metric.phase === 'source-selected');
  const terminal = [...hostEvents].reverse().find(metric => metric.phase === 'first-audio' || metric.phase === 'error');
  if (!sourceSelected || !terminal || (terminal.phase !== 'first-audio' && terminal.phase !== 'error')) return null;

  const dav2Events = snapshot.dav2.filter(metric => metric.timestamp >= attempt.startedAt);
  const firstRange = dav2Events.find(metric => metric.phase === 'first-range-ready' && metric.rangeStart !== undefined && metric.rangeEnd !== undefined);
  const decryptor = [...dav2Events].reverse().find(metric => metric.decryptor)?.decryptor ?? null;
  const sample: FirstSoundSample = {
    id: attempt.id,
    surface: attempt.surface,
    flow: attempt.flow,
    outcome: terminal.phase,
    firstSoundMs: terminal.phase === 'first-audio' ? terminal.elapsedMs : null,
    capturedAt: new Date(now).toISOString(),
    dav2: {
      observed: dav2Events.length > 0,
      fallback: dav2Events.some(metric => metric.phase === 'fallback'),
      hedged: dav2Events.some(metric => metric.hedged === true),
      intentPrefetched: dav2Events.some(metric => metric.intentPrefetched === true),
      decryptor,
      firstRangeBytes: firstRange?.rangeStart !== undefined && firstRange.rangeEnd !== undefined ? firstRange.rangeEnd - firstRange.rangeStart + 1 : null
    }
  };
  const next: FirstSoundEvidenceDraft = {
    ...current,
    activeAttempt: null,
    samples: [...current.samples, sample].slice(-MAX_FIRST_SOUND_SAMPLES)
  };
  writeDraft(next);
  return next;
}

export function cancelFirstSoundAttempt(): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  if (!current) return null;
  const next = { ...current, activeAttempt: null };
  writeDraft(next);
  return next;
}

export function clearFirstSoundEvidence(): void {
  writeDraft(null);
}

export function buildFirstSoundEvidence(draft: FirstSoundEvidenceDraft, now = Date.now()): FirstSoundEvidence {
  return {
    schemaVersion: 1,
    candidate: draft.candidate,
    capturedAt: new Date(now).toISOString(),
    samples: [...draft.samples],
    privacy: {
      walletAddressesCollected: false,
      mediaReferencesCollected: false,
      gatewayUrlsCollected: false,
      perListenerHistoryCollected: false
    }
  };
}

export function serializeFirstSoundEvidence(evidence: FirstSoundEvidence): string {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

export function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0 || !Number.isFinite(quantile) || quantile <= 0 || quantile > 1) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? null;
}
