import type { AudioStartupTelemetrySnapshot, HostAudioTerminalReason } from './audioStartupTelemetry';
import { normalizeIpfsCid } from '../../shared/utils/ipfsCid';

export const FIRST_SOUND_EVIDENCE_STORAGE_KEY = 'dotify:first-sound-evidence:v5';
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
export const FIRST_SOUND_DEVICE_CLASSES = ['desktop', 'laptop', 'phone', 'tablet', 'product-host', 'other'] as const;
export const FIRST_SOUND_OS_FAMILIES = ['windows', 'macos', 'linux', 'ios', 'android', 'product-host', 'other'] as const;
export const FIRST_SOUND_BROWSER_FAMILIES = ['chrome', 'firefox', 'safari', 'edge', 'product-webview', 'other'] as const;
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
export type FirstSoundDeviceClass = (typeof FIRST_SOUND_DEVICE_CLASSES)[number];
export type FirstSoundOsFamily = (typeof FIRST_SOUND_OS_FAMILIES)[number];
export type FirstSoundBrowserFamily = (typeof FIRST_SOUND_BROWSER_FAMILIES)[number];
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
  buildConfigDigest: string;
  productAppVersion: string | null;
  deployedCid: string | null;
};

export type FirstSoundTestProfile = {
  surface: FirstSoundSurface;
  device: FirstSoundDeviceClass;
  os: FirstSoundOsFamily;
  browser: FirstSoundBrowserFamily;
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
  measurement: 'human-confirmed' | 'automatic-error';
  firstSoundMs: number | null;
  capturedAt: string;
  dav2: {
    observed: boolean;
    fallback: boolean;
    hedged: boolean;
    gatewayRecovered: boolean;
    intentPrefetched: boolean;
    decryptor: 'worker' | 'main-thread' | null;
    firstRangeBytes: number | null;
    keyAuthorizationMs: number | null;
    authenticationFailed: boolean;
  };
  hostTerminalReason: HostAudioTerminalReason | null;
};

export type FirstSoundEvidenceDraft = {
  schemaVersion: 5;
  candidate: FirstSoundCandidate;
  profile: FirstSoundTestProfile | null;
  activeAttempt: FirstSoundAttempt | null;
  samples: FirstSoundSample[];
};

export type FirstSoundEvidence = {
  schemaVersion: 5;
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
  buildConfigDigest: string | null;
  buildClean: boolean;
  productAppVersion: string | null;
};

const FULL_SHA = /^[0-9a-f]{40}$/i;
const CONFIG_DIGEST = /^[0-9a-f]{64}$/i;
const PRODUCT_VERSION = /^\[\d+,\s*\d+,\s*\d+\]$/;
const PRODUCT_HOST_VERSION = /^\d{1,4}(?:\.\d{1,4}){1,3}$/;

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

function isDeviceClass(value: unknown): value is FirstSoundDeviceClass {
  return typeof value === 'string' && (FIRST_SOUND_DEVICE_CLASSES as readonly string[]).includes(value);
}

function isOsFamily(value: unknown): value is FirstSoundOsFamily {
  return typeof value === 'string' && (FIRST_SOUND_OS_FAMILIES as readonly string[]).includes(value);
}

function isBrowserFamily(value: unknown): value is FirstSoundBrowserFamily {
  return typeof value === 'string' && (FIRST_SOUND_BROWSER_FAMILIES as readonly string[]).includes(value);
}

function isScenario(value: unknown): value is FirstSoundScenario {
  return typeof value === 'string' && (FIRST_SOUND_SCENARIOS as readonly string[]).includes(value);
}

function normalizeProfile(value: unknown): FirstSoundTestProfile | null {
  if (
    !isRecord(value) ||
    !isSurface(value.surface) ||
    !isConnection(value.connection) ||
    !isDeviceClass(value.device) ||
    !isOsFamily(value.os) ||
    !isBrowserFamily(value.browser)
  )
    return null;
  const productHostVersion =
    typeof value.productHostVersion === 'string' && PRODUCT_HOST_VERSION.test(value.productHostVersion) ? value.productHostVersion : null;
  if (surfaceNeedsProductCandidate(value.surface) && !productHostVersion) return null;
  return {
    surface: value.surface,
    device: value.device,
    os: value.os,
    browser: value.browser,
    productHostVersion: surfaceNeedsProductCandidate(value.surface) ? productHostVersion : null,
    connection: value.connection
  };
}

function normalizeCandidate(candidate: FirstSoundCandidate): FirstSoundCandidate | null {
  const gitSha = candidate.gitSha.trim().toLowerCase();
  const buildConfigDigest = candidate.buildConfigDigest.trim().toLowerCase();
  const productAppVersion = candidate.productAppVersion?.trim() || null;
  const rawCid = candidate.deployedCid?.trim() ?? '';
  const deployedCid = normalizeIpfsCid(rawCid) || null;
  if (!FULL_SHA.test(gitSha) || !CONFIG_DIGEST.test(buildConfigDigest)) return null;
  if (productAppVersion && !PRODUCT_VERSION.test(productAppVersion)) return null;
  if (rawCid && !deployedCid) return null;
  return { gitSha, buildConfigDigest, productAppVersion, deployedCid };
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
  if (value.measurement !== (value.outcome === 'first-audio' ? 'human-confirmed' : 'automatic-error')) return null;
  if (value.firstSoundMs !== null && (typeof value.firstSoundMs !== 'number' || !Number.isFinite(value.firstSoundMs) || value.firstSoundMs < 0)) return null;
  if (typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))) return null;
  if (!isRecord(value.dav2)) return null;
  const decryptor = value.dav2.decryptor;
  if (decryptor !== null && decryptor !== 'worker' && decryptor !== 'main-thread') return null;
  const firstRangeBytes = value.dav2.firstRangeBytes;
  if (firstRangeBytes !== null && (!Number.isSafeInteger(firstRangeBytes) || (firstRangeBytes as number) <= 0)) return null;
  const keyAuthorizationMs = value.dav2.keyAuthorizationMs;
  if (keyAuthorizationMs !== null && (typeof keyAuthorizationMs !== 'number' || !Number.isFinite(keyAuthorizationMs) || keyAuthorizationMs < 0)) return null;
  for (const field of ['observed', 'fallback', 'hedged', 'gatewayRecovered', 'intentPrefetched', 'authenticationFailed'] as const) {
    if (typeof value.dav2[field] !== 'boolean') return null;
  }
  if (
    value.hostTerminalReason !== null &&
    !['access-denied', 'selection-failed', 'selection-interrupted', 'autoplay-blocked', 'media-error', 'muted-output'].includes(
      value.hostTerminalReason as string
    )
  )
    return null;
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
  if (!isRecord(value) || value.schemaVersion !== 5 || !isRecord(value.candidate) || !Array.isArray(value.samples)) return null;
  const candidate = normalizeCandidate({
    gitSha: typeof value.candidate.gitSha === 'string' ? value.candidate.gitSha : '',
    buildConfigDigest: typeof value.candidate.buildConfigDigest === 'string' ? value.candidate.buildConfigDigest : '',
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
  return { schemaVersion: 5, candidate, profile, activeAttempt, samples: samples.slice(-MAX_FIRST_SOUND_SAMPLES) as FirstSoundSample[] };
}

function sameCandidate(left: FirstSoundCandidate, right: FirstSoundCandidate): boolean {
  return (
    left.gitSha === right.gitSha &&
    left.buildConfigDigest === right.buildConfigDigest &&
    left.productAppVersion === right.productAppVersion &&
    left.deployedCid === right.deployedCid
  );
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
    buildConfigDigest: context.buildConfigDigest ?? '',
    productAppVersion: context.productAppVersion,
    deployedCid
  });
  if (!candidate) return null;
  const current = readFirstSoundEvidenceDraft();
  if (current && sameCandidate(current.candidate, candidate)) return current;
  const next: FirstSoundEvidenceDraft = { schemaVersion: 5, candidate, profile: null, activeAttempt: null, samples: [] };
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

export function finishFirstSoundAttempt(snapshot: AudioStartupTelemetrySnapshot, now = Date.now(), audibleConfirmed = false): FirstSoundEvidenceDraft | null {
  const current = readFirstSoundEvidenceDraft();
  const attempt = current?.activeAttempt;
  if (!Number.isFinite(now) || now <= 0 || !current || !attempt) return null;

  const hostEvents = snapshot.host.filter(metric => metric.timestamp >= attempt.startedAt);
  const playbackIntentIndex = hostEvents.findIndex(metric => metric.phase === 'playback-intent');
  const playbackIntent = hostEvents[playbackIntentIndex];
  if (!playbackIntent) return null;

  const attemptId = playbackIntent.attemptId;
  const nextIntentOffset = hostEvents.slice(playbackIntentIndex + 1).findIndex(metric => metric.phase === 'playback-intent');
  const nextIntentIndex = nextIntentOffset < 0 ? hostEvents.length : playbackIntentIndex + 1 + nextIntentOffset;
  const nextIntent = hostEvents[nextIntentIndex];
  const correlatedHostEvents = hostEvents.filter(metric => metric.attemptId === attemptId);
  const dav2Events = snapshot.dav2.filter(metric => metric.timestamp >= playbackIntent.timestamp && (!nextIntent || metric.timestamp < nextIntent.timestamp));
  const hostError = correlatedHostEvents.find(metric => metric.phase === 'error');
  const mediaPlaying = correlatedHostEvents.find(metric => metric.phase === 'media-playing');
  const dav2Error = dav2Events.find(metric => metric.phase === 'error');
  const terminalError = [hostError, dav2Error].filter(metric => metric !== undefined).sort((left, right) => left.timestamp - right.timestamp)[0];
  const outcome = terminalError ? 'error' : audibleConfirmed && mediaPlaying ? 'first-audio' : null;
  if (!outcome) return null;

  const firstRange = dav2Events.find(metric => metric.phase === 'first-range-ready' && metric.rangeStart !== undefined && metric.rangeEnd !== undefined);
  const decryptor = [...dav2Events].reverse().find(metric => metric.decryptor)?.decryptor ?? null;
  const keyAuthorization = dav2Events.find(metric => metric.phase === 'key-authorized');
  const sample: FirstSoundSample = {
    id: attempt.id,
    surface: attempt.surface,
    flow: attempt.flow,
    cacheState: attempt.cacheState,
    scenario: attempt.scenario,
    expectedOutcome: attempt.expectedOutcome,
    outcome,
    measurement: outcome === 'first-audio' ? 'human-confirmed' : 'automatic-error',
    firstSoundMs: outcome === 'first-audio' ? Math.max(0, now - playbackIntent.timestamp) : null,
    capturedAt: new Date(now).toISOString(),
    dav2: {
      observed: dav2Events.length > 0,
      fallback: dav2Events.some(metric => metric.phase === 'fallback'),
      hedged: dav2Events.some(metric => metric.hedged === true),
      gatewayRecovered: dav2Events.some(metric => metric.gatewayRecovered === true),
      intentPrefetched: dav2Events.some(metric => metric.intentPrefetched === true),
      decryptor,
      firstRangeBytes: firstRange?.rangeStart !== undefined && firstRange.rangeEnd !== undefined ? firstRange.rangeEnd - firstRange.rangeStart + 1 : null,
      keyAuthorizationMs: keyAuthorization?.elapsedMs ?? null,
      authenticationFailed: dav2Events.some(metric => metric.phase === 'error' && metric.errorKind === 'authentication')
    },
    hostTerminalReason: hostError?.terminalReason ?? null
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
    schemaVersion: 5,
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
