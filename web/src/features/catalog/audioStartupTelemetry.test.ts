import { afterEach, describe, expect, it } from 'vitest';
import {
  audioV2StartupPhaseLabel,
  clearAudioStartupTelemetry,
  getAudioStartupTelemetrySnapshot,
  installAudioStartupTelemetry,
  recordAudioV2StartupMetric,
  recordHostAudioStartupMetric,
  type AudioStartupTelemetryApi,
  type AudioV2StartupMetric,
  type HostAudioStartupMetric
} from './audioStartupTelemetry';

type TestTarget = EventTarget & {
  __DOTIFY_AUDIO_STARTUP__?: AudioStartupTelemetryApi;
};

const dav2Metric: AudioV2StartupMetric = {
  phase: 'first-range-ready',
  audioRef: 'dotify:enc:v2:ipfs://QmAudio',
  cid: 'QmAudio',
  elapsedMs: 412.4,
  timestamp: 1_700_000_000_000,
  gatewayUrl: 'https://gateway.example/ipfs/QmAudio',
  rangeStart: 128,
  rangeEnd: 512,
  chunkIndex: 0,
  hedged: true,
  fromCache: false
};

const hostMetric: HostAudioStartupMetric = {
  phase: 'first-audio',
  source: 'blob:http://localhost/audio',
  elapsedMs: 820.2,
  timestamp: 1_700_000_000_100,
  durationSeconds: 184
};

describe('audio startup telemetry', () => {
  afterEach(() => {
    clearAudioStartupTelemetry();
  });

  it('records DAV2 and host metrics in a bounded frontend snapshot', () => {
    recordAudioV2StartupMetric(dav2Metric);
    recordHostAudioStartupMetric(hostMetric);

    expect(getAudioStartupTelemetrySnapshot()).toEqual({
      dav2: [dav2Metric],
      host: [hostMetric],
      latestFirstSoundMs: 820.2
    });
  });

  it('installs window event listeners and exposes the QA snapshot API', () => {
    const target = new EventTarget() as TestTarget;
    const cleanup = installAudioStartupTelemetry(target);

    target.dispatchEvent(new CustomEvent('dotify:dav2-startup', { detail: dav2Metric }));
    target.dispatchEvent(new CustomEvent('dotify:host-audio-startup', { detail: hostMetric }));
    target.dispatchEvent(new CustomEvent('dotify:dav2-startup', { detail: { phase: 'bad' } }));

    expect(target.__DOTIFY_AUDIO_STARTUP__?.snapshot()).toEqual({
      dav2: [dav2Metric],
      host: [hostMetric],
      latestFirstSoundMs: 820.2
    });

    cleanup();
    expect(target.__DOTIFY_AUDIO_STARTUP__).toBeUndefined();
  });

  it('keeps only the most recent telemetry records', () => {
    for (let index = 0; index < 170; index += 1) {
      recordAudioV2StartupMetric({ ...dav2Metric, elapsedMs: index });
    }

    const snapshot = getAudioStartupTelemetrySnapshot();
    expect(snapshot.dav2).toHaveLength(160);
    expect(snapshot.dav2[0].elapsedMs).toBe(10);
    expect(snapshot.dav2[snapshot.dav2.length - 1]?.elapsedMs).toBe(169);
  });

  it('maps DAV2 phases to listener-safe progress labels', () => {
    expect(audioV2StartupPhaseLabel({ phase: 'key-authorized' })).toBe('Access confirmed');
    expect(audioV2StartupPhaseLabel({ phase: 'first-range-ready' })).toBe('Receiving first audio bytes');
    expect(audioV2StartupPhaseLabel({ phase: 'error' })).toBe('Audio unavailable');
  });
});
