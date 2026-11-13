import { serializeAudioDiagnostics } from './audioStartupTelemetry';
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
      output: [],
      artwork: [],
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
      output: [],
      artwork: [],
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

it('exports support timings without source identifiers or arbitrary transport detail', () => {
  const serialized = serializeAudioDiagnostics(
    {
      streaming: [
        {
          ...streamingMetric,
          audioRef: 'PRIVATE-AUDIO',
          cid: 'PRIVATE-CID',
          gatewayUrl: 'https://private-origin.invalid',
          detail: 'PRIVATE-DETAIL',
          objectPath: 'PRIVATE-PATH'
        }
      ],
      host: [{ ...hostMetric, source: 'PRIVATE-SOURCE', attemptId: 'PRIVATE-ATTEMPT' }],
      output: [],
      artwork: [],
      latestMediaPlayingMs: 0
    },
    'PRIVATE-BUILD-INPUT'
  );
  expect(serialized).not.toContain('PRIVATE');
  expect(serialized).not.toContain('private-origin');
  const diagnostic = JSON.parse(serialized);
  expect(diagnostic.schema).toBe('dotify.audio-diagnostics.v1');
  expect(diagnostic.host[0]).toMatchObject({ phase: 'media-playing', elapsedMs: 820.2 });
  expect(diagnostic.buildSha).toBeNull();
});

it('correlates retries and host readiness with export-local numbers without leaking identities', () => {
  const report = JSON.parse(
    serializeAudioDiagnostics({
      streaming: [
        { ...streamingMetric, phase: 'preparation-started', attemptId: 'PRIVATE-ONE', readAttempt: 1, selectionElapsedMs: 20, forRoomCapture: true },
        { ...streamingMetric, phase: 'preparation-started', attemptId: 'PRIVATE-ONE', readAttempt: 2, selectionElapsedMs: 200, forRoomCapture: true },
        { ...streamingMetric, phase: 'compatibility-ready', attemptId: 'PRIVATE-TWO', readAttempt: 1, forRoomCapture: false }
      ],
      host: [
        { ...hostMetric, attemptId: 'PRIVATE-ONE' },
        { ...hostMetric, attemptId: 'PRIVATE-TWO' }
      ],
      latestMediaPlayingMs: null
    })
  );
  expect(report.streaming.map((event: { attempt: number }) => event.attempt)).toEqual([1, 1, 2]);
  expect(report.host.map((event: { attempt: number }) => event.attempt)).toEqual([1, 2]);
  expect(report.streaming[1]).toMatchObject({ readAttempt: 2, selectionElapsedMs: 200, forRoomCapture: true });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});

it('allowlists aggregate counters and rejects injected nonnumeric values in the support export', () => {
  const snapshot = {
    streaming: [
      {
        ...streamingMetric,
        readTimings: {
          objectsRead: 10,
          objectsDecrypted: 9,
          encryptedBytes: 400,
          cachedObjects: 2,
          hostObjects: 0,
          httpObjects: 8,
          recoveredObjects: 1,
          readWorkMs: 500,
          decryptWorkMs: 8,
          maxReadMs: 130,
          privateKey: 'DO-NOT-EXPORT',
          gatewayUrl: 'PRIVATE-URL'
        }
      }
    ],
    host: [],
    latestMediaPlayingMs: null
  };
  const report = JSON.parse(serializeAudioDiagnostics(snapshot));
  expect(report.streaming[0].readTimings).toEqual({
    objectsRead: 10,
    objectsDecrypted: 9,
    encryptedBytes: 400,
    cachedObjects: 2,
    hostObjects: 0,
    httpObjects: 8,
    recoveredObjects: 1,
    readWorkMs: 500,
    decryptWorkMs: 8,
    maxReadMs: 130
  });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|DO-NOT-EXPORT/);
  snapshot.streaming[0].readTimings.readWorkMs = NaN;
  expect(JSON.parse(serializeAudioDiagnostics(snapshot)).streaming[0].readTimings.readWorkMs).toBeUndefined();
});

it('includes bounded sanitized artwork observations in the existing explicit report', () => {
  const base = { streaming: [], host: [], latestMediaPlayingMs: null };
  const event = {
    attempt: 674,
    phase: 'metadata-published' as const,
    elapsedMs: 15,
    timestamp: 123,
    visibility: 'visible' as const,
    kind: 'png' as const,
    imageRef: 'https://private.example/art',
    title: 'Private track',
    contentKey: 'secret'
  };
  const report = JSON.parse(serializeAudioDiagnostics({ ...base, artwork: [event] }));
  expect(report.artwork).toEqual([{ attempt: 1, phase: 'metadata-published', elapsedMs: 15, timestamp: 123, visibility: 'visible', kind: 'png' }]);
  expect(JSON.stringify(report)).not.toMatch(/private\.example|Private track|secret/);
});

it('includes only allowlisted Host software labels when About supplies a completed observation', () => {
  const hostSoftware = {
    status: 'reported' as const,
    platform: 'Ios' as const,
    name: 'Polkadot Mobile',
    version: '0.10.0 (20)',
    account: 'PRIVATE-ACCOUNT',
    payment: 'PRIVATE-PAYMENT'
  };
  const snapshot = { streaming: [], host: [], latestMediaPlayingMs: null };
  const report = JSON.parse(serializeAudioDiagnostics(snapshot, null, hostSoftware));
  expect(report.hostSoftware).toEqual({ status: 'reported', platform: 'Ios', name: 'Polkadot Mobile', version: '0.10.0 (20)' });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
  expect(report.hostSoftware).not.toHaveProperty('paymentSupported');
  expect(JSON.parse(serializeAudioDiagnostics(snapshot))).not.toHaveProperty('hostSoftware');
});

it('keeps pending or unavailable Host observations explicit without leaking extra fields', () => {
  const snapshot = { streaming: [], host: [], latestMediaPlayingMs: null };
  const pending = { status: 'pending' as const, source: 'PRIVATE' };
  expect(JSON.parse(serializeAudioDiagnostics(snapshot, null, pending)).hostSoftware).toEqual({ status: 'pending' });
  const invalid = { status: 'reported' as const, platform: 'Desktop' as const, name: 'https://PRIVATE.example', version: '1.0' };
  expect(JSON.parse(serializeAudioDiagnostics(snapshot, null, invalid))).not.toHaveProperty('hostSoftware');
});
