import { describe, expect, it, vi } from 'vitest';
import { resolvePreparedUpload, type PreparedUploadRef } from './preparedUpload';

describe('resolvePreparedUpload', () => {
  it('uses a completed eager upload without retrying', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('dotify:enc:v2:ipfs://QmAudio') };
    const retry = vi.fn(async () => 'retry');

    await expect(resolvePreparedUpload(ref, retry)).resolves.toBe('dotify:enc:v2:ipfs://QmAudio');
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries when an eager upload settled to an empty ref', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('') };
    const retry = vi.fn(async () => 'dotify:enc:v2:ipfs://QmAudioRetry');

    await expect(resolvePreparedUpload(ref, retry)).resolves.toBe('dotify:enc:v2:ipfs://QmAudioRetry');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('clears a rejected retry so the next registration can try again', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('') };
    const retryError = new Error('Upload service is not configured');

    await expect(resolvePreparedUpload(ref, async () => Promise.reject(retryError))).rejects.toThrow('Upload service is not configured');
    expect(ref.current).toBeNull();
  });
});
