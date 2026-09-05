export type AudioV2StartupPhase =
  | 'key-authorized'
  | 'gateway-selected'
  | 'header-ready'
  | 'first-range-ready'
  | 'first-chunk-decrypted'
  | 'first-chunk-appended'
  | 'fallback'
  | 'error';

export type AudioV2StartupMetric = {
  phase: AudioV2StartupPhase;
  audioRef: string;
  cid: string;
  elapsedMs: number;
  timestamp: number;
  gatewayUrl?: string;
  rangeStart?: number;
  rangeEnd?: number;
  chunkIndex?: number;
  hedged?: boolean;
  fromCache?: boolean;
  detail?: string;
};

export type HostAudioStartupMetric = {
  phase: 'source-selected' | 'metadata-ready' | 'first-audio' | 'error';
  source: string;
  elapsedMs: number;
  timestamp: number;
  durationSeconds?: number;
};

export type AudioStartupTelemetrySnapshot = {
  dav2: AudioV2StartupMetric[];
  host: HostAudioStartupMetric[];
  latestFirstSoundMs: number | null;
};

export type AudioStartupTelemetryApi = {
  snapshot: () => AudioStartupTelemetrySnapshot;
  clear: () => void;
};

type AudioStartupTelemetryTarget = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  __DOTIFY_AUDIO_STARTUP__?: AudioStartupTelemetryApi;
};

declare global {
  interface Window {
    __DOTIFY_AUDIO_STARTUP__?: AudioStartupTelemetryApi;
  }
}

const MAX_AUDIO_STARTUP_EVENTS = 160;
const audioV2Phases = new Set<AudioV2StartupPhase>([
  'key-authorized',
  'gateway-selected',
  'header-ready',
  'first-range-ready',
  'first-chunk-decrypted',
  'first-chunk-appended',
  'fallback',
  'error'
]);
const hostPhases = new Set<HostAudioStartupMetric['phase']>(['source-selected', 'metadata-ready', 'first-audio', 'error']);

let dav2Metrics: AudioV2StartupMetric[] = [];
let hostMetrics: HostAudioStartupMetric[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isAudioV2StartupMetric(value: unknown): value is AudioV2StartupMetric {
  if (!isRecord(value)) return false;
  return (
    audioV2Phases.has(value.phase as AudioV2StartupPhase) &&
    typeof value.audioRef === 'string' &&
    typeof value.cid === 'string' &&
    isFiniteNumber(value.elapsedMs) &&
    isFiniteNumber(value.timestamp) &&
    optionalString(value.gatewayUrl) &&
    optionalNumber(value.rangeStart) &&
    optionalNumber(value.rangeEnd) &&
    optionalNumber(value.chunkIndex) &&
    optionalBoolean(value.hedged) &&
    optionalBoolean(value.fromCache) &&
    optionalString(value.detail)
  );
}

function isHostAudioStartupMetric(value: unknown): value is HostAudioStartupMetric {
  if (!isRecord(value)) return false;
  return (
    hostPhases.has(value.phase as HostAudioStartupMetric['phase']) &&
    typeof value.source === 'string' &&
    isFiniteNumber(value.elapsedMs) &&
    isFiniteNumber(value.timestamp) &&
    optionalNumber(value.durationSeconds)
  );
}

function pushBounded<T>(items: T[], item: T): T[] {
  const next = [...items, item];
  return next.length > MAX_AUDIO_STARTUP_EVENTS ? next.slice(next.length - MAX_AUDIO_STARTUP_EVENTS) : next;
}

export function clearAudioStartupTelemetry(): void {
  dav2Metrics = [];
  hostMetrics = [];
}

export function recordAudioV2StartupMetric(metric: AudioV2StartupMetric): void {
  dav2Metrics = pushBounded(dav2Metrics, metric);
}

export function recordHostAudioStartupMetric(metric: HostAudioStartupMetric): void {
  hostMetrics = pushBounded(hostMetrics, metric);
}

export function getAudioStartupTelemetrySnapshot(): AudioStartupTelemetrySnapshot {
  const latestFirstAudio = [...hostMetrics].reverse().find(metric => metric.phase === 'first-audio');
  return {
    dav2: [...dav2Metrics],
    host: [...hostMetrics],
    latestFirstSoundMs: latestFirstAudio?.elapsedMs ?? null
  };
}

export function audioV2StartupPhaseLabel(metric: Pick<AudioV2StartupMetric, 'phase'>): string {
  switch (metric.phase) {
    case 'key-authorized':
      return 'Access confirmed';
    case 'gateway-selected':
      return 'Finding audio gateway';
    case 'header-ready':
      return 'Reading audio map';
    case 'first-range-ready':
      return 'Receiving first audio bytes';
    case 'first-chunk-decrypted':
      return 'Preparing first sound';
    case 'first-chunk-appended':
      return 'Starting audio';
    case 'fallback':
      return 'Switching playback path';
    case 'error':
      return 'Audio unavailable';
    default:
      return 'Preparing audio';
  }
}

export function installAudioStartupTelemetry(target: AudioStartupTelemetryTarget | undefined = typeof window === 'undefined' ? undefined : window): () => void {
  if (!target) return () => undefined;

  const handleDav2Metric = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isAudioV2StartupMetric(detail)) recordAudioV2StartupMetric(detail);
  };
  const handleHostMetric = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isHostAudioStartupMetric(detail)) recordHostAudioStartupMetric(detail);
  };
  const telemetryApi: AudioStartupTelemetryApi = {
    snapshot: getAudioStartupTelemetrySnapshot,
    clear: clearAudioStartupTelemetry
  };

  target.__DOTIFY_AUDIO_STARTUP__ = telemetryApi;
  target.addEventListener('dotify:dav2-startup', handleDav2Metric);
  target.addEventListener('dotify:host-audio-startup', handleHostMetric);

  return () => {
    target.removeEventListener('dotify:dav2-startup', handleDav2Metric);
    target.removeEventListener('dotify:host-audio-startup', handleHostMetric);
    if (target.__DOTIFY_AUDIO_STARTUP__ === telemetryApi) {
      delete target.__DOTIFY_AUDIO_STARTUP__;
    }
  };
}
