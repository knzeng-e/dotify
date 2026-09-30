import type { CelerityClock, ClockSample } from './celerityClock';

export type CaptureKind = 'presence' | 'reaction' | 'chat' | 'request';
export type CaptureStage = 'attempt' | 'submitted' | 'rejected' | 'accepted' | 'duplicate' | 'reordered' | 'expired';
export type CaptureMetadata = { run: string; client: 'A' | 'B'; cid: string; device: string; hostVersion: string; network: string };
export type CaptureFrame = {
  at: number;
  clock: number | null;
  phase: string;
  kind: CaptureKind;
  stage: CaptureStage;
  frame: string;
  stream: string;
  seq: number;
  bytes: number;
  ttlMs: number;
  outOfOrder: boolean;
};
type Capture = {
  version: 1;
  metadata: CaptureMetadata;
  buildSha: string | null;
  sdk: '0.6.9';
  startedAt: number;
  endedAt: number | null;
  clocks: CelerityClock[];
  frames: CaptureFrame[];
  markers: { at: number; phase: string; visibility: string; online: boolean | null }[];
  dropped: number;
  pending: number;
};

const PHASES = ['baseline', 'background', 'network-change', 'reconnect', 'expiry'] as const;
const MAX_FRAMES = 2000;
const encoder = new TextEncoder();
const digest = async (value: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))].map(x => x.toString(16).padStart(2, '0')).join('');

export function createCelerityCapture() {
  let capture: Capture | null = null;
  let clock: ClockSample | null = null;
  let phase = 'baseline';
  let generation = 0;
  let probe: (() => Promise<ClockSample>) | undefined;
  let removeEnvironment: (() => void) | undefined;
  let calibrating = false;
  const pending = new Set<Promise<void>>();

  async function calibrate() {
    const current = probe;
    if (!current) throw new Error('A connected Product room is required for capture');
    if (calibrating) throw new Error('Clock calibration already in progress');
    calibrating = true;
    try {
      const samples: ClockSample[] = [];
      for (let index = 0; index < 3; index++) samples.push(await current());
      if (probe !== current) throw new Error('Room changed during calibration');
      if (samples.some(sample => sample.server !== samples[0].server)) throw new Error('Room server changed during calibration');
      return samples.reduce((best, sample) => (sample.uncertaintyMs < best.uncertaintyMs ? sample : best));
    } finally {
      calibrating = false;
    }
  }
  function marker() {
    if (!capture || capture.endedAt !== null) return;
    if (capture.markers.length >= 100) {
      capture.dropped++;
      return;
    }
    capture.markers.push({
      at: Date.now(),
      phase,
      visibility: typeof document === 'undefined' ? 'unknown' : document.visibilityState,
      online: typeof navigator === 'undefined' ? null : navigator.onLine
    });
  }
  function exportClock(sample: ClockSample): CelerityClock {
    return { at: sample.at, server: sample.server, offsetMs: sample.offsetMs, uncertaintyMs: sample.uncertaintyMs };
  }
  function snapshot(): Capture | null {
    return capture ? structuredClone(capture) : null;
  }
  return {
    setProbe(next: () => Promise<ClockSample>) {
      probe = next;
      clock = null;
      marker();
      return () => {
        if (probe === next) {
          probe = undefined;
          clock = null;
          marker();
        }
      };
    },
    async start(metadata: CaptureMetadata) {
      if (!metadata || !/^[a-zA-Z0-9_-]{8,64}$/.test(metadata.run) || !['A', 'B'].includes(metadata.client)) throw new Error('Invalid run/client label');
      for (const key of ['cid', 'device', 'hostVersion', 'network'] as const)
        if (typeof metadata[key] !== 'string' || !metadata[key].trim() || metadata[key].length > 160) throw new Error(`Missing or oversized ${key}`);
      if (capture?.endedAt === null) throw new Error('Stop the current capture first');
      const token = ++generation;
      const sample = await calibrate();
      if (token !== generation) throw new Error('Capture was cancelled');
      clock = sample;
      phase = 'baseline';
      // Copy only declared metadata; never retain arbitrary caller fields.
      const { run, client, cid, device, hostVersion, network } = metadata;
      capture = {
        version: 1,
        metadata: { run, client, cid, device, hostVersion, network },
        buildSha: import.meta.env.VITE_DOTIFY_BUILD_SHA || null,
        sdk: '0.6.9',
        startedAt: Date.now(),
        endedAt: null,
        clocks: [exportClock(sample)],
        frames: [],
        markers: [],
        dropped: 0,
        pending: 0
      };
      marker();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', marker);
        window.addEventListener('offline', marker);
        document.addEventListener('visibilitychange', marker);
        removeEnvironment = () => {
          window.removeEventListener('online', marker);
          window.removeEventListener('offline', marker);
          document.removeEventListener('visibilitychange', marker);
        };
      }
      return snapshot();
    },
    async calibrate() {
      const target = capture;
      if (!target || target.endedAt !== null || target.clocks.length >= 16) throw new Error('No active capture or calibration limit reached');
      const sample = await calibrate();
      if (capture !== target || target.endedAt !== null) throw new Error('Capture stopped during calibration');
      clock = sample;
      target.clocks.push(exportClock(sample));
      return exportClock(sample);
    },
    phase(next: (typeof PHASES)[number]) {
      if (!PHASES.includes(next)) throw new Error('Unknown capture phase');
      phase = next;
      marker();
    },
    frame(bytes: Uint8Array, input: { stream: string; seq: number; kind: CaptureKind; stage: CaptureStage; ttlMs: number; outOfOrder?: boolean }) {
      const target = capture;
      if (!target || target.endedAt !== null) return;
      if (target.frames.length + target.pending >= MAX_FRAMES || pending.size >= 16 || bytes.length > 512 || Date.now() - target.startedAt > 300_000) {
        target.dropped++;
        return;
      }
      const at = Date.now();
      const calibrated = clock && at - clock.at >= 0 && at - clock.at <= 120_000 && Math.abs(at - clock.at - (performance.now() - clock.monotonicAt)) <= 25;
      const base = {
        at,
        clock: calibrated ? target.clocks.length - 1 : null,
        phase,
        kind: input.kind,
        stage: input.stage,
        seq: input.seq,
        ttlMs: input.ttlMs,
        outOfOrder: input.outOfOrder ?? false,
        bytes: bytes.length
      };
      const prefix = encoder.encode(`${target.metadata.run}/frame/`);
      const encoded = new Uint8Array(prefix.length + bytes.length);
      encoded.set(prefix);
      encoded.set(bytes, prefix.length);
      target.pending++;
      const task = Promise.all([digest(encoded), digest(encoder.encode(`${target.metadata.run}/stream/${input.stream}`))])
        .then(([frame, stream]) => {
          target.frames.push({ ...base, frame, stream });
        })
        .catch(() => {
          target.dropped++;
        })
        .finally(() => {
          target.pending--;
          pending.delete(task);
        });
      pending.add(task);
    },
    async stop() {
      generation++;
      const target = capture;
      if (target && target.endedAt === null) target.endedAt = Date.now();
      removeEnvironment?.();
      removeEnvironment = undefined;
      await Promise.all([...pending]);
      return target ? structuredClone(target) : null;
    },
    clear() {
      generation++;
      capture = null;
      clock = null;
      removeEnvironment?.();
      removeEnvironment = undefined;
    },
    snapshot
  };
}

export const celerityCapture = createCelerityCapture();
