import type { AudioStartupTelemetrySnapshot } from './audioStartupTelemetry';
import { normalizeIpfsCid } from '../../shared/utils/ipfsCid';

export const FIRST_SOUND_EVIDENCE_STORAGE_KEY = 'dotify:first-sound-evidence:v3';
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
export const FIRST_SOUND_CACHE_STATES = ['cold', 'warm'] as const;
export const FIRST_SOUND_CONNECTIONS = ['wifi', 'mobile', 'ethernet', 'other'] as const;
export const FIRST_SOUND_SCENARIOS = [
  'ordinary-playback',
  'denied-protected',
  'broken-gateway',
  'slow-key-service',
  'interrupted-navigation',
  'corrupted-dav2'
] as const;

export type FirstSoundSurface = (typeof FIRST_SOUND_SURFACES)[number];
export type FirstSoundFlow = (typeof FIRST_SOUND_FLOWS)[number];
export type FirstSoundCacheState = (typeof FIRST_SOUND_CACHE_STATES)[number];
export type FirstSoundConnection = (typeof FIRST_SOUND_CONNECTIONS)[number];
export type FirstSoundScenario = (typeof FIRST_SOUND_SCENARIOS)[number];
export type FirstSoundExpectedOutcome = 'first-audio' | 'error';

export const FIRST_SOUND_SCENARIO_EXPECTATIONS: Record<FirstSoundScenario, FirstSoundExpectedOutcome> = {
  'ordinary-playback': 'first-audio',
  'denied-protected': 'error',
  'broken-gateway': 'first-audio',
  'slow-key-service': 'first-audio',
  'interrupted-navigation': 'error',
  'corrupted-dav2': 'error'
};

export type FirstSoundCandidate = {
  gitSha: string;
  productAppVersion: string | null;
  deployedCid: string | null;
};

export type FirstSoundTestProfile = {
  surface: FirstSoundSurface;
  device: string;
  os: string;
  browser: string;
  productHostVersion: string | null;
  connection: FirstSoundConnection;
};

export type FirstSoundAttempt = {
  id: string;
  surface: FirstSoundSurface;
  flow: FirstSoundFlow;
  cacheState: FirstSoundCacheState;
  scenario: FirstSoundScenario;
  expectedOutcome: FirstSoundExpectedOutcome;
  startedAt: number;
};

export type FirstSoundSample = {
  id: string;
  surface: FirstSoundSurface;
  flow: FirstSoundFlow;
  cacheState: FirstSoundCacheState;
  scenario: FirstSoundScenario;
  expectedOutcome: FirstSoundExpectedOutcome;
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
  schemaVersion: 3;
  candidate: FirstSoundCandidate;
  profile: FirstSoundTestProfile | null;
  activeAttempt: FirstSoundAttempt | null;
  samples: FirstSoundSample[];
};

export type FirstSoundEvidence = {
  schemaVersion: 3;
  candidate: FirstSoundCandidate;
  profile: FirstSoundTestProfile;
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
  buildClean: boolean;
  productAppVersion: string | null;
};

const FULL_SHA = /^[0-9a-f]{40}$/i;
const PRODUCT_VERSION = /^\[\d+,\s*\d+,\s*\d+\]$/;
const PROFILE_TEXT_MAX_LENGTH = 80;

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

function isCacheState(value: unknown): value is FirstSoundCacheState {
  return typeof value === 'string' && (FIRST_SOUND_CACHE_STATES as readonly string[]).includes(value);
}

function isConnection(value: unknown): value is FirstSoundConnection {
  return typeof value === 'string' && (FIRST_SOUND_CONNECTIONS as readonly string[]).includes(value);
}

function isScenario(value: unknown): value is FirstSoundScenario {
  return typeof value === 'string' && (FIRST_SOUND_SCENARIOS as readonly string[]).includes(value);
}

function cleanProfileText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const printable = Array.from(value, character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, PROFILE_TEXT_MAX_LENGTH);
}

function normalizeProfile(value: unknown): FirstSoundTestProfile | null {
  if (!isRecord(value) || !isSurface(value.surface) || !isConnection(value.connection)) return null;
  const device = cleanProfileText(value.device);
  const os = cleanProfileText(value.os);
  const browser = cleanProfileText(value.browser);
  const productHostVersion = cleanProfileText(value.productHostVersion) || null;
  if (!device || !os || !browser) return null;
  if (surfaceNeedsProductCandidate(value.surface) && !productHostVersion) return null;
  return {
    surface: value.surface,
    device,
    os,
    browser,
    productHostVersion: surfaceNeedsProductCandidate(value.surface) ? productHostVersion : null,
    connection: value.connection
  };
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
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isSurface(value.surface) ||
    !isFlow(value.flow) ||
    !isCacheState(value.cacheState) ||
    !isScenario(value.scenario) ||
    value.expectedOutcome !== FIRST_SOUND_SCENARIO_EXPECTATIONS[value.scenario]
  )
    return null;
  if (value.flow === 'warm-next-track' && value.cacheState !== 'warm') return null;
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
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isSurface(value.surface) ||
    !isFlow(value.flow) ||
    !isCacheState(value.cacheState) ||
    !isScenario(value.scenario) ||
    value.expectedOutcome !== FIRST_SOUND_SCENARIO_EXPECTATIONS[value.scenario]
  )
    return null;
  if (value.flow === 'warm-next-track' && value.cacheState !== 'warm') return null;
  if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt) || value.startedAt <= 0) return null;
  return value as FirstSoundAttempt;
}

function parseDraft(value: unknown): FirstSoundEvidenceDraft | null {
  if (!isRecord(value) || value.schemaVersion !== 3 || !isRecord(value.candidate) || !Array.isArray(value.samples)) return null;
  const candidate = normalizeCandidate({
    gitSha: typeof value.candidate.gitSha === 'string' ? value.candidate.gitSha : '',
    productAppVersion: typeof value.candidate.productAppVersion === 'string' ? value.candidate.productAppVersion : null,
    deployedCid: typeof value.candidate.deployedCid === 'string' ? value.candidate.deployedCid : null
  });
  if (!candidate) return null;
  const samples = value.samples.map(parseSample);
  if (samples.some(sample => !sample)) return null;
  const profile = value.profile === null ? null : normalizeProfile(value.profile);
  if (value.profile !== null && !profile) return null;
  if (!profile && samples.length > 0) return null;
  if (profile && samples.some(sample => sample?.surface !== profile.surface)) return null;
  const activeAttempt = value.activeAttempt === null ? null : parseAttempt(value.activeAttempt);
  if (value.activeAttempt !== null && !activeAttempt) return null;
  if (!profile && activeAttempt) return null;
  if (profile && activeAttempt && activeAttempt.surface !== profile.surface) return null;
  return { schemaVersion: 3, candidate, profile, activeAttempt, samples: samples.slice(-MAX_FIRST_SOUND_SAMPLES) as FirstSoundSample[] };
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
  if (!context.buildClean) return null;
  const candidate = normalizeCandidate({
    gitSha: context.buildSha ?? '',
    productAppVersion: context.productAppVersion,
    deployedCid
  });
  if (!candidate) return null;
  const current = readFirstSoundEvidenceDraft();
  if (current && sameCandidate(current.candidate, candidate)) return current;
  const next: FirstSoundEvidenceDraft = { schemaVersion: 3, candidate, profile: null, activeAttempt: null, samples: [] };
  writeDraft(next);
  return next;
}

export function bindFirstSoundTestProfile(value: FirstSoundTestProfile): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  const profile = normalizeProfile(value);
  if (!current || current.activeAttempt || !profile) return null;
  const unchanged = current.profile && JSON.stringify(current.profile) === JSON.stringify(profile);
  const next: FirstSoundEvidenceDraft = {
    ...current,
    profile,
    activeAttempt: null,
    samples: unchanged ? current.samples : []
  };
  writeDraft(next);
  return next;
}

export function productCandidateComplete(candidate: FirstSoundCandidate): boolean {
  return Boolean(candidate.productAppVersion && candidate.deployedCid);
}

export function surfaceNeedsProductCandidate(surface: FirstSoundSurface): boolean {
  return surface === 'product-desktop' || surface === 'product-web-gateway';
}

export function beginFirstSoundAttempt(
  surface: FirstSoundSurface,
  flow: FirstSoundFlow,
  cacheState: FirstSoundCacheState,
  scenario: FirstSoundScenario,
  now = Date.now()
): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  if (
    !Number.isFinite(now) ||
    now <= 0 ||
    !current ||
    !current.profile ||
    current.profile.surface !== surface ||
    !isScenario(scenario) ||
    (flow === 'warm-next-track' && cacheState !== 'warm') ||
    (surfaceNeedsProductCandidate(surface) && !productCandidateComplete(current.candidate))
  )
    return null;
  const next = {
    ...current,
    activeAttempt: {
      id: createAttemptId(now),
      surface,
      flow,
      cacheState,
      scenario,
      expectedOutcome: FIRST_SOUND_SCENARIO_EXPECTATIONS[scenario],
      startedAt: now
    }
  };
  writeDraft(next);
  return next;
}

export function finishFirstSoundAttempt(snapshot: AudioStartupTelemetrySnapshot, now = Date.now()): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  const attempt = current?.activeAttempt;
  if (!Number.isFinite(now) || now <= 0 || !current || !attempt) return null;

  const hostEvents = snapshot.host.filter(metric => metric.timestamp >= attempt.startedAt);
  const playbackIntentIndex = hostEvents.findIndex(metric => metric.phase === 'playback-intent');
  const playbackIntent = hostEvents[playbackIntentIndex];
  if (!playbackIntent) return null;

  const nextIntentOffset = hostEvents.slice(playbackIntentIndex + 1).findIndex(metric => metric.phase === 'playback-intent');
  const nextIntentIndex = nextIntentOffset < 0 ? hostEvents.length : playbackIntentIndex + 1 + nextIntentOffset;
  const nextIntent = hostEvents[nextIntentIndex];
  const correlatedHostEvents = hostEvents.slice(playbackIntentIndex, nextIntentIndex);
  const dav2Events = snapshot.dav2.filter(metric => metric.timestamp >= playbackIntent.timestamp && (!nextIntent || metric.timestamp < nextIntent.timestamp));
  const hostTerminal = correlatedHostEvents.find(metric => metric.phase === 'first-audio' || metric.phase === 'error');
  const dav2Error = dav2Events.find(metric => metric.phase === 'error');
  const terminal = [hostTerminal, dav2Error].filter(metric => metric !== undefined).sort((left, right) => left.timestamp - right.timestamp)[0];
  const firstAudio = terminal?.phase === 'first-audio' ? terminal : null;
  const outcome = firstAudio ? 'first-audio' : terminal?.phase === 'error' ? 'error' : null;
  if (!outcome) return null;

  const firstRange = dav2Events.find(metric => metric.phase === 'first-range-ready' && metric.rangeStart !== undefined && metric.rangeEnd !== undefined);
  const decryptor = [...dav2Events].reverse().find(metric => metric.decryptor)?.decryptor ?? null;
  const sample: FirstSoundSample = {
    id: attempt.id,
    surface: attempt.surface,
    flow: attempt.flow,
    cacheState: attempt.cacheState,
    scenario: attempt.scenario,
    expectedOutcome: attempt.expectedOutcome,
    outcome,
    firstSoundMs: firstAudio ? Math.max(0, firstAudio.timestamp - playbackIntent.timestamp) : null,
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

export function buildFirstSoundEvidence(draft: FirstSoundEvidenceDraft, now = Date.now()): FirstSoundEvidence | null {
  if (!draft.profile) return null;
  return {
    schemaVersion: 3,
    candidate: draft.candidate,
    profile: draft.profile,
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
