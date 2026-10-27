import { playbackContinuity } from '../player/playbackContinuity';
export type StreamingStartupPhase =
  | 'prepared-source-adopted'
  | 'rendition-selected'
  | 'key-authorized'
  | 'gateway-selected'
  | 'manifest-ready'
  | 'first-object-ready'
  | 'first-segment-decrypted'
  | 'first-segment-appended'
  | 'compatibility-reader'
  | 'error';

export type StreamingStartupErrorKind = 'key-unavailable' | 'authentication' | 'transport';
export type HostAudioTerminalReason = 'access-denied' | 'selection-failed' | 'selection-interrupted' | 'autoplay-blocked' | 'media-error' | 'muted-output';

export type StreamingStartupMetric = {
  phase: StreamingStartupPhase;
  audioRef: string;
  cid: string;
  elapsedMs: number;
  timestamp: number;
  gatewayUrl?: string;
  objectPath?: string;
  objectBytes?: number;
  segmentIndex?: number;
  gatewayRecovered?: boolean;
  fromCache?: boolean;
  errorKind?: StreamingStartupErrorKind;
  bitrateKbps?: number;
  bufferedSeconds?: number;
  throughputKbps?: number;
  detail?: string;
};

export type HostAudioStartupMetric = {
  phase: 'playback-intent' | 'source-selected' | 'metadata-ready' | 'media-playing' | 'error';
  attemptId: string;
  source: string;
  elapsedMs: number;
  timestamp: number;
  durationSeconds?: number;
  terminalReason?: HostAudioTerminalReason;
};

export type AudioStartupTelemetrySnapshot = {
  continuity?: ReturnType<typeof playbackContinuity.snapshot>;
  streaming: StreamingStartupMetric[];
  host: HostAudioStartupMetric[];
  latestMediaPlayingMs: number | null;
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
const streamingPhases = new Set<StreamingStartupPhase>([
  'prepared-source-adopted',
  'rendition-selected',
  'key-authorized',
  'gateway-selected',
  'manifest-ready',
  'first-object-ready',
  'first-segment-decrypted',
  'first-segment-appended',
  'compatibility-reader',
  'error'
]);
const hostPhases = new Set<HostAudioStartupMetric['phase']>(['playback-intent', 'source-selected', 'metadata-ready', 'media-playing', 'error']);
const streamingErrorKinds = new Set<StreamingStartupErrorKind>(['key-unavailable', 'authentication', 'transport']);
const hostTerminalReasons = new Set<HostAudioTerminalReason>([
  'access-denied',
  'selection-failed',
  'selection-interrupted',
  'autoplay-blocked',
  'media-error',
  'muted-output'
]);

let streamingMetrics: StreamingStartupMetric[] = [];
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

function isStreamingStartupMetric(value: unknown): value is StreamingStartupMetric {
  if (!isRecord(value)) return false;
  return (
    streamingPhases.has(value.phase as StreamingStartupPhase) &&
    typeof value.audioRef === 'string' &&
    typeof value.cid === 'string' &&
    isFiniteNumber(value.elapsedMs) &&
    isFiniteNumber(value.timestamp) &&
    optionalString(value.gatewayUrl) &&
    optionalString(value.objectPath) &&
    optionalNumber(value.objectBytes) &&
    optionalNumber(value.segmentIndex) &&
    optionalBoolean(value.gatewayRecovered) &&
    optionalBoolean(value.fromCache) &&
    (value.errorKind === undefined || streamingErrorKinds.has(value.errorKind as StreamingStartupErrorKind)) &&
    optionalNumber(value.bitrateKbps) &&
    optionalNumber(value.bufferedSeconds) &&
    optionalNumber(value.throughputKbps) &&
    optionalString(value.detail)
  );
}

function isHostAudioStartupMetric(value: unknown): value is HostAudioStartupMetric {
  if (!isRecord(value)) return false;
  return (
    hostPhases.has(value.phase as HostAudioStartupMetric['phase']) &&
    typeof value.attemptId === 'string' &&
    value.attemptId.length > 0 &&
    typeof value.source === 'string' &&
    isFiniteNumber(value.elapsedMs) &&
    isFiniteNumber(value.timestamp) &&
    optionalNumber(value.durationSeconds) &&
    (value.terminalReason === undefined || hostTerminalReasons.has(value.terminalReason as HostAudioTerminalReason))
  );
}

function pushBounded<T>(items: T[], item: T): T[] {
  const next = [...items, item];
  return next.length > MAX_AUDIO_STARTUP_EVENTS ? next.slice(next.length - MAX_AUDIO_STARTUP_EVENTS) : next;
}

export function clearAudioStartupTelemetry(): void {
  playbackContinuity.reset();
  streamingMetrics = [];
  hostMetrics = [];
}

export function recordStreamingStartupMetric(metric: StreamingStartupMetric): void {
  streamingMetrics = pushBounded(streamingMetrics, metric);
}

export function recordHostAudioStartupMetric(metric: HostAudioStartupMetric): void {
  hostMetrics = pushBounded(hostMetrics, metric);
}

export function publishStreamingStartupMetric(detail: StreamingStartupMetric): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dotify:streaming-startup', { detail }));
}

export function publishHostAudioStartupMetric(detail: HostAudioStartupMetric): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('dotify:host-audio-startup', { detail }));
  if (import.meta.env.DEV) {
    console.info('[dotify.audio.startup]', detail);
  }
}

export function getAudioStartupTelemetrySnapshot(): AudioStartupTelemetrySnapshot {
  const latestMediaPlaying = [...hostMetrics].reverse().find(metric => metric.phase === 'media-playing');
  return {
    continuity: playbackContinuity.snapshot(),
    streaming: [...streamingMetrics],
    host: [...hostMetrics],
    latestMediaPlayingMs: latestMediaPlaying?.elapsedMs ?? null
  };
}

export function streamingStartupPhaseLabel(metric: Pick<StreamingStartupMetric, 'phase'>): string {
  switch (metric.phase) {
    case 'key-authorized':
      return 'Loading your track…';
    case 'rendition-selected':
    case 'prepared-source-adopted':
    case 'gateway-selected':
    case 'manifest-ready':
    case 'first-object-ready':
    case 'first-segment-decrypted':
    case 'first-segment-appended':
    case 'compatibility-reader':
      return 'Loading your track…';
    case 'error':
      return 'Audio unavailable';
    default:
      return 'Loading your track…';
  }
}

export function installAudioStartupTelemetry(target: AudioStartupTelemetryTarget | undefined = typeof window === 'undefined' ? undefined : window): () => void {
  if (!target) return () => undefined;

  const handleStreamingMetric = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isStreamingStartupMetric(detail)) recordStreamingStartupMetric(detail);
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
  target.addEventListener('dotify:streaming-startup', handleStreamingMetric);
  target.addEventListener('dotify:host-audio-startup', handleHostMetric);

  return () => {
    target.removeEventListener('dotify:streaming-startup', handleStreamingMetric);
    target.removeEventListener('dotify:host-audio-startup', handleHostMetric);
    if (target.__DOTIFY_AUDIO_STARTUP__ === telemetryApi) {
      delete target.__DOTIFY_AUDIO_STARTUP__;
    }
  };
}
