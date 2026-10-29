import { describe, it, expect, vi } from 'vitest';
import { waitForAudioPreparation, AudioPreparationError } from './streamingPreparation';
const id = '12345678-1234-4234-8234-123456789abc';
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
