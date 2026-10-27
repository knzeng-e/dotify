import { afterEach, describe, expect, it } from 'vitest';
import {
  streamingStartupPhaseLabel,
  clearAudioStartupTelemetry,
  getAudioStartupTelemetrySnapshot,
  installAudioStartupTelemetry,
  recordStreamingStartupMetric,
  recordHostAudioStartupMetric,
  type AudioStartupTelemetryApi,
  type StreamingStartupMetric,
  type HostAudioStartupMetric
} from './audioStartupTelemetry';

type TestTarget = EventTarget & {
  __DOTIFY_AUDIO_STARTUP__?: AudioStartupTelemetryApi;
};

const streamingMetric: StreamingStartupMetric = {
  phase: 'first-object-ready',
  audioRef: 'dotify:enc:v3:key-v2:ipfs://Qm9xbPnX2h2VnxfRwzFjHa13DQXGJM66ikuLncRHkKydcZ',
  cid: 'QmAudio',
  elapsedMs: 412.4,
  timestamp: 1_700_000_000_000,
  gatewayUrl: 'https://gateway.example/ipfs/QmAudio',
  objectBytes: 385,
  segmentIndex: 0,
  gatewayRecovered: true,
  fromCache: false
};

const hostMetric: HostAudioStartupMetric = {
  phase: 'media-playing',
  attemptId: 'attempt-a',
  source: 'blob:http://localhost/audio',
  elapsedMs: 820.2,
  timestamp: 1_700_000_000_100,
  durationSeconds: 184
};

describe('audio startup telemetry', () => {
  afterEach(() => {
    clearAudioStartupTelemetry();
  });

  it('records streaming and host metrics in a bounded frontend snapshot', () => {
    recordStreamingStartupMetric(streamingMetric);
    recordHostAudioStartupMetric(hostMetric);

    expect(getAudioStartupTelemetrySnapshot()).toEqual({
      continuity: { nextLatencyMs: [], playingMs: 0, waitingMs: 0, rebufferRatio: 0 },
      streaming: [streamingMetric],
      host: [hostMetric],
      latestMediaPlayingMs: 820.2
    });
  });

  it('installs window event listeners and exposes the QA snapshot API', () => {
    const target = new EventTarget() as TestTarget;
    const cleanup = installAudioStartupTelemetry(target);

    target.dispatchEvent(new CustomEvent('dotify:streaming-startup', { detail: streamingMetric }));
    target.dispatchEvent(new CustomEvent('dotify:host-audio-startup', { detail: hostMetric }));
    target.dispatchEvent(new CustomEvent('dotify:streaming-startup', { detail: { phase: 'bad' } }));

    expect(target.__DOTIFY_AUDIO_STARTUP__?.snapshot()).toEqual({
      continuity: { nextLatencyMs: [], playingMs: 0, waitingMs: 0, rebufferRatio: 0 },
      streaming: [streamingMetric],
      host: [hostMetric],
      latestMediaPlayingMs: 820.2
    });

    cleanup();
    expect(target.__DOTIFY_AUDIO_STARTUP__).toBeUndefined();
  });

  it('keeps only the most recent telemetry records', () => {
    for (let index = 0; index < 170; index += 1) {
      recordStreamingStartupMetric({ ...streamingMetric, elapsedMs: index });
    }

    const snapshot = getAudioStartupTelemetrySnapshot();
    expect(snapshot.streaming).toHaveLength(160);
    expect(snapshot.streaming[0].elapsedMs).toBe(10);
    expect(snapshot.streaming[snapshot.streaming.length - 1]?.elapsedMs).toBe(169);
  });

  it('maps streaming phases to listener-safe progress labels', () => {
    expect(streamingStartupPhaseLabel({ phase: 'key-authorized' })).toBe('Loading your track…');
    expect(streamingStartupPhaseLabel({ phase: 'first-object-ready' })).toBe('Loading your track…');
    expect(streamingStartupPhaseLabel({ phase: 'error' })).toBe('Audio unavailable');
  });
});
