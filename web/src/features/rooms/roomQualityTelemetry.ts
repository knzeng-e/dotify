export type RoomQualityRole = 'host' | 'listener';

export type RoomQualityPhase =
  | 'room-create-started'
  | 'room-created'
  | 'room-join-started'
  | 'room-joined'
  | 'room-rejoined'
  | 'ice-servers-resolved'
  | 'listener-ready'
  | 'offer-sent'
  | 'offer-received'
  | 'answer-sent'
  | 'stream-ready'
  | 'remote-track'
  | 'remote-audio-cued'
  | 'peer-connected'
  | 'peer-disconnected'
  | 'peer-failed'
  | 'connection-timeout'
  | 'retry-requested'
  | 'host-reconnecting'
  | 'host-online'
  | 'room-closed';

export type RoomPeerStatsSummary = {
  relay: boolean | null;
  localCandidateType?: string;
  remoteCandidateType?: string;
  currentRoundTripTimeMs?: number;
  availableOutgoingBitrate?: number;
  jitterMs?: number;
  packetsLost?: number;
  packetsSent?: number;
  packetsReceived?: number;
  bytesSent?: number;
  bytesReceived?: number;
};

export type RoomQualityMetric = {
  phase: RoomQualityPhase;
  role: RoomQualityRole;
  timestamp: number;
  roomId?: string;
  peerId?: string;
  elapsedMs?: number;
  listenerCount?: number;
  retryCount?: number;
  turnRelayAvailable?: boolean;
  iceServerCount?: number;
  socketTransport?: string;
  connectionState?: string;
  iceConnectionState?: string;
  stats?: RoomPeerStatsSummary;
  detail?: string;
};

export type RoomQualityTelemetrySnapshot = {
  events: RoomQualityMetric[];
  latestJoinToConnectedMs: number | null;
  latestRemoteAudioMs: number | null;
  relayConnectionCount: number;
};

export type RoomQualityTelemetryApi = {
  snapshot: () => RoomQualityTelemetrySnapshot;
  clear: () => void;
};

type RoomQualityTelemetryTarget = EventTarget & {
  __DOTIFY_ROOM_QUALITY__?: RoomQualityTelemetryApi;
};

type StatsRecord = Record<string, unknown> & { id?: string; type?: string };

declare global {
  interface Window {
    __DOTIFY_ROOM_QUALITY__?: RoomQualityTelemetryApi;
  }
}

const MAX_ROOM_QUALITY_EVENTS = 200;
const roomQualityRoles = new Set<RoomQualityRole>(['host', 'listener']);
const roomQualityPhases = new Set<RoomQualityPhase>([
  'room-create-started',
  'room-created',
  'room-join-started',
  'room-joined',
  'room-rejoined',
  'ice-servers-resolved',
  'listener-ready',
  'offer-sent',
  'offer-received',
  'answer-sent',
  'stream-ready',
  'remote-track',
  'remote-audio-cued',
  'peer-connected',
  'peer-disconnected',
  'peer-failed',
  'connection-timeout',
  'retry-requested',
  'host-reconnecting',
  'host-online',
  'room-closed'
]);

let roomQualityEvents: RoomQualityMetric[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function optionalBooleanOrNull(value: unknown): value is boolean | null | undefined {
  return value === undefined || value === null || typeof value === 'boolean';
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isRoomPeerStatsSummary(value: unknown): value is RoomPeerStatsSummary {
  if (!isRecord(value)) return false;
  return (
    optionalBooleanOrNull(value.relay) &&
    optionalString(value.localCandidateType) &&
    optionalString(value.remoteCandidateType) &&
    optionalNumber(value.currentRoundTripTimeMs) &&
    optionalNumber(value.availableOutgoingBitrate) &&
    optionalNumber(value.jitterMs) &&
    optionalNumber(value.packetsLost) &&
    optionalNumber(value.packetsSent) &&
    optionalNumber(value.packetsReceived) &&
    optionalNumber(value.bytesSent) &&
    optionalNumber(value.bytesReceived)
  );
}

function isRoomQualityMetric(value: unknown): value is RoomQualityMetric {
  if (!isRecord(value)) return false;
  return (
    roomQualityPhases.has(value.phase as RoomQualityPhase) &&
    roomQualityRoles.has(value.role as RoomQualityRole) &&
    isFiniteNumber(value.timestamp) &&
    optionalString(value.roomId) &&
    optionalString(value.peerId) &&
    optionalNumber(value.elapsedMs) &&
    optionalNumber(value.listenerCount) &&
    optionalNumber(value.retryCount) &&
    (value.turnRelayAvailable === undefined || typeof value.turnRelayAvailable === 'boolean') &&
    optionalNumber(value.iceServerCount) &&
    optionalString(value.socketTransport) &&
    optionalString(value.connectionState) &&
    optionalString(value.iceConnectionState) &&
    (value.stats === undefined || isRoomPeerStatsSummary(value.stats)) &&
    optionalString(value.detail)
  );
}

function pushBounded<T>(items: T[], item: T, maxItems: number): T[] {
  const next = [...items, item];
  return next.length > maxItems ? next.slice(next.length - maxItems) : next;
}

function numberValue(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function secondsToMs(value: unknown): number | undefined {
  const seconds = numberValue(value);
  return seconds === undefined ? undefined : Math.round(seconds * 1000);
}

function collectStats(report: unknown): StatsRecord[] {
  if (!report) return [];
  const stats: StatsRecord[] = [];

  if (typeof (report as { forEach?: unknown }).forEach === 'function') {
    (report as { forEach: (callback: (value: unknown) => void) => void }).forEach(value => {
      if (isRecord(value)) stats.push(value as StatsRecord);
    });
    return stats;
  }

  if (Symbol.iterator in Object(report)) {
    for (const entry of report as Iterable<unknown>) {
      const stat = Array.isArray(entry) ? entry[1] : entry;
      if (isRecord(stat)) stats.push(stat as StatsRecord);
    }
  }

  return stats;
}

function sumNumber(stats: StatsRecord[], field: string): number | undefined {
  let total = 0;
  let seen = false;
  for (const stat of stats) {
    const value = numberValue(stat[field]);
    if (value === undefined) continue;
    total += value;
    seen = true;
  }
  return seen ? total : undefined;
}

function firstMs(stats: StatsRecord[], field: string): number | undefined {
  for (const stat of stats) {
    const value = secondsToMs(stat[field]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function findSelectedPair(stats: StatsRecord[], byId: Map<string, StatsRecord>): StatsRecord | undefined {
  const selectedPairId = stats.find(stat => stat.type === 'transport' && typeof stat.selectedCandidatePairId === 'string')?.selectedCandidatePairId;
  if (typeof selectedPairId === 'string') return byId.get(selectedPairId);

  return (
    stats.find(stat => stat.type === 'candidate-pair' && stat.selected === true) ??
    stats.find(stat => stat.type === 'candidate-pair' && stat.nominated === true && stat.state === 'succeeded') ??
    stats.find(stat => stat.type === 'candidate-pair' && stat.state === 'succeeded')
  );
}

function candidateType(candidate: StatsRecord | undefined): string | undefined {
  return typeof candidate?.candidateType === 'string' ? candidate.candidateType : undefined;
}

function audioStats(stats: StatsRecord[], type: string): StatsRecord[] {
  return stats.filter(stat => stat.type === type && (stat.kind === 'audio' || stat.mediaType === 'audio'));
}

export function clearRoomQualityTelemetry(): void {
  roomQualityEvents = [];
}

export function recordRoomQualityMetric(metric: RoomQualityMetric): void {
  roomQualityEvents = pushBounded(roomQualityEvents, metric, MAX_ROOM_QUALITY_EVENTS);
}

export function getRoomQualityTelemetrySnapshot(): RoomQualityTelemetrySnapshot {
  const latestJoin = [...roomQualityEvents].reverse().find(metric => metric.phase === 'peer-connected' && metric.role === 'listener');
  const latestRemoteAudio = [...roomQualityEvents].reverse().find(metric => metric.phase === 'remote-audio-cued');
  return {
    events: [...roomQualityEvents],
    latestJoinToConnectedMs: latestJoin?.elapsedMs ?? null,
    latestRemoteAudioMs: latestRemoteAudio?.elapsedMs ?? null,
    relayConnectionCount: roomQualityEvents.filter(metric => metric.phase === 'peer-connected' && metric.stats?.relay === true).length
  };
}

export function installRoomQualityTelemetry(target: RoomQualityTelemetryTarget | undefined = typeof window === 'undefined' ? undefined : window): () => void {
  if (!target) return () => undefined;

  const handleMetric = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isRoomQualityMetric(detail)) recordRoomQualityMetric(detail);
  };
  const telemetryApi: RoomQualityTelemetryApi = {
    snapshot: getRoomQualityTelemetrySnapshot,
    clear: clearRoomQualityTelemetry
  };

  target.__DOTIFY_ROOM_QUALITY__ = telemetryApi;
  target.addEventListener('dotify:room-quality', handleMetric);

  return () => {
    target.removeEventListener('dotify:room-quality', handleMetric);
    if (target.__DOTIFY_ROOM_QUALITY__ === telemetryApi) {
      delete target.__DOTIFY_ROOM_QUALITY__;
    }
  };
}

export function publishRoomQualityMetric(
  metric: RoomQualityMetric,
  target: Pick<EventTarget, 'dispatchEvent'> | undefined = typeof window === 'undefined' ? undefined : window
): void {
  if (!target || typeof CustomEvent !== 'function') return;
  target.dispatchEvent(new CustomEvent('dotify:room-quality', { detail: metric }));
}

export function summarizeRoomPeerStats(report: unknown, role: RoomQualityRole): RoomPeerStatsSummary {
  const stats = collectStats(report);
  const byId = new Map(stats.map(stat => [stat.id, stat]).filter((entry): entry is [string, StatsRecord] => typeof entry[0] === 'string'));
  const selectedPair = findSelectedPair(stats, byId);
  const localCandidate = typeof selectedPair?.localCandidateId === 'string' ? byId.get(selectedPair.localCandidateId) : undefined;
  const remoteCandidate = typeof selectedPair?.remoteCandidateId === 'string' ? byId.get(selectedPair.remoteCandidateId) : undefined;
  const localCandidateType = candidateType(localCandidate);
  const remoteCandidateType = candidateType(remoteCandidate);
  const outbound = audioStats(stats, 'outbound-rtp');
  const inbound = audioStats(stats, 'inbound-rtp');
  const remoteInbound = audioStats(stats, 'remote-inbound-rtp');
  const receiverObservedAudio = role === 'host' ? remoteInbound : inbound;
  const roundTripTimeMs = secondsToMs(selectedPair?.currentRoundTripTime) ?? firstMs(remoteInbound, 'roundTripTime');
  const relay = localCandidateType || remoteCandidateType ? localCandidateType === 'relay' || remoteCandidateType === 'relay' : null;

  return {
    relay,
    localCandidateType,
    remoteCandidateType,
    currentRoundTripTimeMs: roundTripTimeMs,
    availableOutgoingBitrate: numberValue(selectedPair?.availableOutgoingBitrate),
    jitterMs: firstMs(receiverObservedAudio, 'jitter'),
    packetsLost: sumNumber(receiverObservedAudio, 'packetsLost'),
    packetsSent: sumNumber(outbound, 'packetsSent'),
    packetsReceived: sumNumber(inbound, 'packetsReceived'),
    bytesSent: sumNumber(outbound, 'bytesSent'),
    bytesReceived: sumNumber(inbound, 'bytesReceived')
  };
}
