import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRoomQualityTelemetry,
  getRoomQualityTelemetrySnapshot,
  installRoomQualityTelemetry,
  recordRoomQualityMetric,
  summarizeRoomPeerStats,
  type RoomQualityMetric,
  type RoomQualityTelemetryApi
} from './roomQualityTelemetry';

type TestTarget = EventTarget & {
  __DOTIFY_ROOM_QUALITY__?: RoomQualityTelemetryApi;
};

const joinedMetric: RoomQualityMetric = {
  phase: 'room-joined',
  role: 'listener',
  roomId: 'AB12CD',
  elapsedMs: 220,
  timestamp: 1_700_000_000_000,
  listenerCount: 1,
  socketTransport: 'websocket'
};

describe('room quality telemetry', () => {
  afterEach(() => {
    clearRoomQualityTelemetry();
  });

  it('records room quality metrics in a bounded frontend snapshot', () => {
    recordRoomQualityMetric(joinedMetric);
    recordRoomQualityMetric({
      phase: 'remote-audio-cued',
      role: 'listener',
      roomId: 'AB12CD',
      elapsedMs: 680,
      timestamp: 1_700_000_000_100
    });
    recordRoomQualityMetric({
      phase: 'peer-connected',
      role: 'listener',
      roomId: 'AB12CD',
      elapsedMs: 740,
      timestamp: 1_700_000_000_200,
      stats: { relay: true, localCandidateType: 'relay' }
    });

    expect(getRoomQualityTelemetrySnapshot()).toEqual({
      events: [
        joinedMetric,
        {
          phase: 'remote-audio-cued',
          role: 'listener',
          roomId: 'AB12CD',
          elapsedMs: 680,
          timestamp: 1_700_000_000_100
        },
        {
          phase: 'peer-connected',
          role: 'listener',
          roomId: 'AB12CD',
          elapsedMs: 740,
          timestamp: 1_700_000_000_200,
          stats: { relay: true, localCandidateType: 'relay' }
        }
      ],
      latestJoinToConnectedMs: 740,
      latestRemoteAudioMs: 680,
      relayConnectionCount: 1
    });
  });

  it('installs window event listeners and exposes the QA snapshot API', () => {
    const target = new EventTarget() as TestTarget;
    const cleanup = installRoomQualityTelemetry(target);

    target.dispatchEvent(new CustomEvent('dotify:room-quality', { detail: joinedMetric }));
    target.dispatchEvent(new CustomEvent('dotify:room-quality', { detail: { phase: 'bad' } }));

    expect(target.__DOTIFY_ROOM_QUALITY__?.snapshot().events).toEqual([joinedMetric]);

    cleanup();
    expect(target.__DOTIFY_ROOM_QUALITY__).toBeUndefined();
  });

  it('keeps only the most recent telemetry records', () => {
    for (let index = 0; index < 210; index += 1) {
      recordRoomQualityMetric({ ...joinedMetric, elapsedMs: index });
    }

    const snapshot = getRoomQualityTelemetrySnapshot();
    expect(snapshot.events).toHaveLength(200);
    expect(snapshot.events[0].elapsedMs).toBe(10);
    expect(snapshot.events[snapshot.events.length - 1]?.elapsedMs).toBe(209);
  });

  it('summarizes listener WebRTC stats without exposing candidate addresses', () => {
    const report = new Map<string, Record<string, unknown>>([
      ['transport', { id: 'transport', type: 'transport', selectedCandidatePairId: 'pair-1' }],
      [
        'pair-1',
        {
          id: 'pair-1',
          type: 'candidate-pair',
          state: 'succeeded',
          localCandidateId: 'local-1',
          remoteCandidateId: 'remote-1',
          currentRoundTripTime: 0.083,
          availableOutgoingBitrate: 320_000
        }
      ],
      ['local-1', { id: 'local-1', type: 'local-candidate', candidateType: 'relay', address: '192.0.2.10' }],
      ['remote-1', { id: 'remote-1', type: 'remote-candidate', candidateType: 'srflx', address: '198.51.100.10' }],
      ['audio-in', { id: 'audio-in', type: 'inbound-rtp', kind: 'audio', jitter: 0.012, packetsLost: 2, packetsReceived: 144, bytesReceived: 8840 }]
    ]);

    expect(summarizeRoomPeerStats(report, 'listener')).toEqual({
      relay: true,
      localCandidateType: 'relay',
      remoteCandidateType: 'srflx',
      currentRoundTripTimeMs: 83,
      availableOutgoingBitrate: 320_000,
      jitterMs: 12,
      packetsLost: 2,
      packetsSent: undefined,
      packetsReceived: 144,
      bytesSent: undefined,
      bytesReceived: 8840
    });
  });

  it('summarizes host outbound and receiver-observed audio stats', () => {
    const report = [
      { id: 'pair-1', type: 'candidate-pair', selected: true, localCandidateId: 'local-1', remoteCandidateId: 'remote-1' },
      { id: 'local-1', type: 'local-candidate', candidateType: 'host' },
      { id: 'remote-1', type: 'remote-candidate', candidateType: 'host' },
      { id: 'audio-out', type: 'outbound-rtp', kind: 'audio', packetsSent: 88, bytesSent: 4096 },
      { id: 'remote-in', type: 'remote-inbound-rtp', kind: 'audio', roundTripTime: 0.044, jitter: 0.021, packetsLost: 1 }
    ];

    expect(summarizeRoomPeerStats(report, 'host')).toMatchObject({
      relay: false,
      localCandidateType: 'host',
      remoteCandidateType: 'host',
      currentRoundTripTimeMs: 44,
      jitterMs: 21,
      packetsLost: 1,
      packetsSent: 88,
      bytesSent: 4096
    });
  });
});
