import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCelerityCapture } from './celerityCapture';

const now = 1_800_000_000_000;
const metadata = { run: 'test-run-123', client: 'A' as const, cid: 'candidate-cid', device: 'desktop', hostVersion: 'test', network: 'wifi' };
const input = { stream: 'private-scope/sender/recipient', seq: 1, kind: 'chat' as const, stage: 'accepted' as const, ttlMs: 10_000 };
const packet = new TextEncoder().encode('ciphertext-not-chat');
function setup() {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(performance, 'now').mockReturnValue(100);
  const capture = createCelerityCapture();
  const probe = vi.fn(async () => ({ at: Date.now(), monotonicAt: performance.now(), server: 'a'.repeat(32), offsetMs: 100, uncertaintyMs: 30 }));
  const release = capture.setProbe(probe);
  return { capture, probe, release };
}
afterEach(() => vi.restoreAllMocks());

describe('opt-in bounded Celerity capture', () => {
  it('does nothing before start and exports run-salted fingerprints, not payloads or identities', async () => {
    const { capture, probe } = setup();
    capture.frame(packet, input);
    expect(capture.snapshot()).toBeNull();
    await capture.start({ ...metadata, secret: 'never-copy' } as typeof metadata);
    expect(probe).toHaveBeenCalledTimes(3);
    capture.frame(packet, input);
    capture.frame(packet, { ...input, stage: 'duplicate' });
    const result = (await capture.stop())!;
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].frame).toMatch(/^[a-f0-9]{64}$/);
    expect(result.frames[0].frame).toBe(result.frames[1].frame);
    expect(result.frames[0].clock).toBe(0);
    expect(result.pending).toBe(0);
    for (const privateValue of ['ciphertext-not-chat', input.stream, 'never-copy']) expect(JSON.stringify(result)).not.toContain(privateValue);
    await capture.start({ ...metadata, run: 'another-run' });
    capture.frame(packet, input);
    expect((await capture.stop())!.frames[0].frame).not.toBe(result.frames[0].frame);
  });

  it('correlates two captures within a run and makes stale or changed clocks explicit', async () => {
    const { capture, release } = setup();
    await capture.start(metadata);
    capture.frame(packet, input);
    const first = (await capture.stop())!;
    await capture.start({ ...metadata, client: 'B' });
    vi.mocked(Date.now).mockReturnValue(now + 1000); // Wall clock jumped; monotonic did not.
    capture.frame(packet, input);
    await capture.calibrate();
    capture.frame(packet, { ...input, seq: 2 });
    release();
    capture.frame(packet, { ...input, seq: 3 });
    const second = (await capture.stop())!;
    expect(second.frames[0].frame).toBe(first.frames[0].frame);
    expect(Object.fromEntries(second.frames.map(frame => [frame.seq, frame.clock]))).toEqual({ 1: null, 2: 1, 3: null });
    expect(second.clocks).toHaveLength(2);
  });

  it('bounds asynchronous hashing and duration; unknown observations are counted, not hidden', async () => {
    const { capture } = setup();
    await capture.start(metadata);
    for (let i = 0; i < 20; i++) capture.frame(packet, input);
    capture.frame(new Uint8Array(513), input);
    vi.mocked(Date.now).mockReturnValue(now + 300_001);
    capture.frame(packet, input);
    const result = (await capture.stop())!;
    expect(result.frames).toHaveLength(16);
    expect(result.dropped).toBe(6);
    capture.frame(packet, input);
    expect(capture.snapshot()!.frames).toHaveLength(16);
    capture.clear();
    expect(capture.snapshot()).toBeNull();
  });

  it('cancels in-flight calibration, rejects invalid metadata and requires a stable admitted room', async () => {
    const { capture, probe, release } = setup();
    await expect(capture.start({ ...metadata, run: 'bad' })).rejects.toThrow('Invalid');
    const pending = capture.start(metadata);
    capture.clear();
    await expect(pending).rejects.toThrow('cancelled');
    probe.mockResolvedValueOnce({ at: now, monotonicAt: 100, server: 'b'.repeat(32), offsetMs: 100, uncertaintyMs: 30 });
    await expect(capture.start(metadata)).rejects.toThrow('server changed');
    release();
    await expect(capture.start(metadata)).rejects.toThrow('connected Product room');
    expect(capture.snapshot()).toBeNull();
  });

  it('invalidates latency samples after two minutes and bounds environment markers', async () => {
    const { capture } = setup();
    await capture.start(metadata);
    vi.mocked(Date.now).mockReturnValue(now + 120_001);
    vi.mocked(performance.now).mockReturnValue(120_101);
    capture.frame(packet, input);
    for (let i = 0; i < 105; i++) capture.phase('background');
    const result = (await capture.stop())!;
    expect(result.frames[0].clock).toBeNull();
    expect(result.markers).toHaveLength(100);
    expect(result.dropped).toBe(6);
  });
});
