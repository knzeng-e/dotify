import { describe, expect, it, vi } from 'vitest';
import { resolvePreparedUpload, type PreparedUploadRef } from './preparedUpload';

describe('resolvePreparedUpload', () => {
  it('uses a completed eager upload without retrying', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('dotify:enc:v3:key-v2:ipfs://Qm9xbPnX2h2VnxfRwzFjHa13DQXGJM66ikuLncRHkKydcZ') };
    const retry = vi.fn(async () => 'retry');

    await expect(resolvePreparedUpload(ref, retry)).resolves.toBe('dotify:enc:v3:key-v2:ipfs://Qm9xbPnX2h2VnxfRwzFjHa13DQXGJM66ikuLncRHkKydcZ');
    expect(retry).not.toHaveBeenCalled();
  });

  it('uses a completed structured eager upload without retrying', async () => {
    const prepared = {
      ref: 'dotify:enc:v3:key-v2:ipfs://Qm9xbPnX2h2VnxfRwzFjHa13DQXGJM66ikuLncRHkKydcZ',
      runtimeAddress: '0x2222222222222222222222222222222222222222'
    };
    const ref: PreparedUploadRef<typeof prepared> = { current: Promise.resolve(prepared) };
    const retry = vi.fn(async () => ({ ...prepared, ref: 'retry' }));

    await expect(resolvePreparedUpload(ref, retry)).resolves.toBe(prepared);
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries when an eager upload settled to an empty ref', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('') };
    const retry = vi.fn(async () => 'dotify:enc:v3:key-v2:ipfs://QmGdRc6MBxM3w5miqLdRRYz9kMQNrnQSbZ8fZsoTGyMXNp');

    await expect(resolvePreparedUpload(ref, retry)).resolves.toBe('dotify:enc:v3:key-v2:ipfs://QmGdRc6MBxM3w5miqLdRRYz9kMQNrnQSbZ8fZsoTGyMXNp');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('clears a rejected retry so the next registration can try again', async () => {
    const ref: PreparedUploadRef = { current: Promise.resolve('') };
    const retryError = new Error('Upload service is not configured');

    await expect(resolvePreparedUpload(ref, async () => Promise.reject(retryError))).rejects.toThrow('Upload service is not configured');
    expect(ref.current).toBeNull();
  });
});
