import { describe, it, expect, vi } from 'vitest';
import { waitForAudioPreparation, AudioPreparationError, AudioPreparationPending, audioPreparationLabel } from './streamingPreparation';
const id = '12345678-1234-4234-8234-123456789abc';
it('does not retry or discard a persisted publication admission refusal', async () => {
  const request = vi.fn(),
    discard = vi.fn();
  await expect(
    waitForAudioPreparation({
      job: { id, state: 'failed', attempts: 1, reason: 'PUBLICATION_NOT_ADMITTED' },
      storageKey: 'synthetic',
      request,
      discard,
      retryFailed: true
    })
  ).rejects.toMatchObject({ canRetry: false, discard: undefined, message: expect.stringContaining('not enabled') });
  expect(request).not.toHaveBeenCalled();
  expect(discard).not.toHaveBeenCalled();
});

it('explains an older saved job whose retry now needs publication admission', async () => {
  const request = vi.fn().mockRejectedValue(Object.assign(new Error('Publication needs operator admission.'), { code: 'STREAMING_PUBLICATION_NOT_ADMITTED' }));
  await expect(
    waitForAudioPreparation({ job: { id, state: 'failed' }, storageKey: 'synthetic', request, discard: vi.fn(), retryFailed: true })
  ).rejects.toMatchObject({
    canRetry: false,
    discard: undefined,
    message: 'Publication needs operator admission.'
  });
  expect(request).toHaveBeenCalledTimes(1);
});
const ready = {
  id,
  state: 'ready',
  result: {
    ref: 'dotify:enc:v3:key-v2:ipfs://Qm4SqYb857winFMDRhCDJobJKar9BDtsE8q1oZhDVSrZhC',
    runtimeAddress: `0x${'12'.repeat(20)}`,
    contentHash: `0x${'34'.repeat(32)}`,
    keyVersion: 'dotify-content-key-v2'
  }
};
describe('artist streaming preparation', () => {
  it('reports real phases and finishes without re-uploading the master', async () => {
    const states: string[] = [];
    const request = vi.fn().mockResolvedValueOnce({ id, state: 'encoding' }).mockResolvedValueOnce({ id, state: 'publishing' }).mockResolvedValue(ready);
    expect(
      await waitForAudioPreparation({
        job: { id, state: 'queued' },
        storageKey: 'synthetic',
        request,
        sleep: async () => {},
        onProgress: phase => states.push(phase)
      })
    ).toEqual(ready.result);
    expect(states).toEqual(['queued', 'encoding', 'publishing', 'ready']);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('allows one explicit resume of a failed job and never loops encoder retries', async () => {
    const request = vi.fn().mockResolvedValueOnce({ id, state: 'queued' }).mockResolvedValue({ id, state: 'failed' });
    await expect(
      waitForAudioPreparation({ job: { id, state: 'failed' }, storageKey: 'synthetic', request, retryFailed: true, sleep: async () => {} })
    ).rejects.toThrow('Your upload is saved');
    expect(request.mock.calls[0]).toEqual([id, true]);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('rejects job substitution and bounds stalled polling without starting another upload', async () => {
    await expect(
      waitForAudioPreparation({
        job: { id, state: 'queued' },
        storageKey: 'synthetic',
        request: async () => ({ ...ready, id: '99999999-1234-4234-8234-123456789abc' }),
        sleep: async () => {}
      })
    ).rejects.toThrow('Invalid audio preparation');
    let clock = 1;
    await expect(
      waitForAudioPreparation({
        job: { id, state: 'queued' },
        storageKey: 'synthetic',
        request: async () => ({ id, state: 'queued' }),
        now: () => clock,
        sleep: async () => {
          clock += 16 * 60_000;
        }
      })
    ).rejects.toThrow('still being prepared');
  });
});

it('exposes discard only after a known failed state and waits for explicit action', async () => {
  const discard = vi.fn().mockResolvedValue(undefined);
  let failure: unknown;
  try {
    await waitForAudioPreparation({ job: { id, state: 'failed' }, storageKey: 'synthetic', request: vi.fn(), discard });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AudioPreparationError);
  expect(discard).not.toHaveBeenCalled();
  await (failure as AudioPreparationError).discard!();
  expect(discard).toHaveBeenCalledWith(id);
});

it('distinguishes storage refusal and exhausted attempts without losing the saved job', async () => {
  const request = vi.fn();
  const discard = vi.fn();
  await expect(
    waitForAudioPreparation({
      job: { id, state: 'failed', attempts: 2, failure: { stage: 'storage', storageStatus: 403 } },
      storageKey: 'synthetic',
      request,
      discard
    })
  ).rejects.toMatchObject({ canRetry: true, message: expect.stringContaining('refusing new uploads') });
  await expect(
    waitForAudioPreparation({
      job: { id, state: 'failed', attempts: 3, failure: { stage: 'storage', storageStatus: 403 } },
      storageKey: 'synthetic',
      request,
      discard,
      retryFailed: true
    })
  ).rejects.toMatchObject({ canRetry: false, message: expect.stringContaining('retry limit') });
  expect(request).not.toHaveBeenCalled();
  expect(discard).not.toHaveBeenCalled();
});

it('keeps following confirmed progress past fifteen minutes and verifies completion separately', async () => {
  let clock = 1;
  let stored = 0;
  const updates: string[] = [];
  const result = await waitForAudioPreparation({
    job: { id, state: 'publishing', progress: { storedBlocks: 0, totalBlocks: 3 } },
    storageKey: 'slow-preparation',
    now: () => clock,
    sleep: async () => {
      clock += 8 * 60_000;
    },
    request: async () => (++stored > 3 ? ready : { id, state: 'publishing', progress: { storedBlocks: stored, totalBlocks: 3 } }),
    onProgress: (phase, progress) => updates.push(audioPreparationLabel(phase, progress))
  });
  expect(result).toEqual(ready.result);
  expect(updates).toContain('Saving your music: 66% confirmed');
  expect(updates).toContain('Checking your saved music');
  expect(clock).toBeGreaterThan(15 * 60_000);
});

it('hands a stalled saved job back as pending, without retry or discard', async () => {
  let clock = 1;
  const request = vi.fn(async () => ({ id, state: 'publishing' }));
  const discard = vi.fn();
  await expect(
    waitForAudioPreparation({
      job: { id, state: 'publishing' },
      storageKey: 'pending-preparation',
      request,
      discard,
      now: () => clock,
      sleep: async () => {
        clock += 16 * 60_000;
      }
    })
  ).rejects.toBeInstanceOf(AudioPreparationPending);
  expect(request).toHaveBeenCalledExactlyOnceWith(id);
  expect(discard).not.toHaveBeenCalled();
});

it('bounds the overall wait even when receipts keep progressing', async () => {
  let clock = 1,
    stored = 0;
  await expect(
    waitForAudioPreparation({
      job: { id, state: 'publishing' },
      storageKey: 'bounded-preparation',
      request: async () => ({ id, state: 'publishing', progress: { storedBlocks: ++stored, totalBlocks: 100 } }),
      now: () => clock,
      sleep: async () => {
        clock += 10 * 60_000;
      }
    })
  ).rejects.toBeInstanceOf(AudioPreparationPending);
  expect(stored).toBeLessThan(15);
});

it.each([
  { storedBlocks: 2, totalBlocks: 1 },
  { storedBlocks: -1, totalBlocks: 2 },
  { storedBlocks: 1, totalBlocks: 10000 }
])('rejects invented progress: %j', async progress => {
  await expect(waitForAudioPreparation({ job: { id, state: 'publishing', progress }, storageKey: 'invalid', request: vi.fn() })).rejects.toThrow(
    'Invalid audio preparation progress'
  );
});

it('preserves an accepted job when status reads lose their connection', async () => {
  const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  const discard = vi.fn();
  await expect(
    waitForAudioPreparation({ job: { id, state: 'publishing' }, storageKey: 'offline', request, discard, sleep: async () => {} })
  ).rejects.toBeInstanceOf(AudioPreparationPending);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls.every(([requested, retry]) => requested === id && !retry)).toBe(true);
  expect(discard).not.toHaveBeenCalled();
});
