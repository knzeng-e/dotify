import { describe, expect, it, vi } from 'vitest';
import { resolvePreparedAudioUploadForRuntime } from './preparedAudioUpload';
import type { PreparedUploadRef } from './preparedUpload';
import type { ProtectedAudioUpload } from '../../services/pinata';

const OLD_RUNTIME = '0x1111111111111111111111111111111111111111' as const;
const CURRENT_RUNTIME = '0x2222222222222222222222222222222222222222' as const;

function mismatchMessage(uploadRuntime: `0x${string}`, publicationRuntime: `0x${string}`) {
  return `${uploadRuntime} != ${publicationRuntime}`;
}

describe('resolvePreparedAudioUploadForRuntime', () => {
  it('uses a prepared upload when its backend runtime matches publication', async () => {
    const prepared = { ref: 'dotify:enc:v2:key-v2:ipfs://QmAudio', runtimeAddress: CURRENT_RUNTIME };
    const ref: PreparedUploadRef<ProtectedAudioUpload> = { current: Promise.resolve(prepared) };
    const retry = vi.fn(async () => ({ ref: 'retry', runtimeAddress: CURRENT_RUNTIME }));

    await expect(
      resolvePreparedAudioUploadForRuntime({
        ref,
        upload: retry,
        publicationRuntimeAddress: CURRENT_RUNTIME,
        canRetry: true,
        mismatchMessage
      })
    ).resolves.toBe(prepared);
    expect(retry).not.toHaveBeenCalled();
  });

  it('clears and retries an eager upload prepared for a different runtime', async () => {
    const ref: PreparedUploadRef<ProtectedAudioUpload> = {
      current: Promise.resolve({ ref: 'dotify:enc:v2:key-v2:ipfs://old', runtimeAddress: OLD_RUNTIME })
    };
    const retry = vi.fn(async () => ({ ref: 'dotify:enc:v2:key-v2:ipfs://current', runtimeAddress: CURRENT_RUNTIME }));
    const onBeforeRetry = vi.fn();

    await expect(
      resolvePreparedAudioUploadForRuntime({
        ref,
        upload: retry,
        publicationRuntimeAddress: CURRENT_RUNTIME,
        canRetry: true,
        onBeforeRetry,
        mismatchMessage
      })
    ).resolves.toEqual({ ref: 'dotify:enc:v2:key-v2:ipfs://current', runtimeAddress: CURRENT_RUNTIME });
    expect(onBeforeRetry).toHaveBeenCalledWith(OLD_RUNTIME, CURRENT_RUNTIME);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('rejects a different-runtime upload when the raw audio is unavailable for retry', async () => {
    const ref: PreparedUploadRef<ProtectedAudioUpload> = {
      current: Promise.resolve({ ref: 'dotify:enc:v2:key-v2:ipfs://old', runtimeAddress: OLD_RUNTIME })
    };

    await expect(
      resolvePreparedAudioUploadForRuntime({
        ref,
        upload: vi.fn(),
        publicationRuntimeAddress: CURRENT_RUNTIME,
        canRetry: false,
        mismatchMessage
      })
    ).rejects.toThrow(`${OLD_RUNTIME} != ${CURRENT_RUNTIME}`);
    expect(ref.current).toBeNull();
  });

  it('rejects when the retry still returns audio for another runtime', async () => {
    const ref: PreparedUploadRef<ProtectedAudioUpload> = {
      current: Promise.resolve({ ref: 'dotify:enc:v2:key-v2:ipfs://old', runtimeAddress: OLD_RUNTIME })
    };

    await expect(
      resolvePreparedAudioUploadForRuntime({
        ref,
        upload: async () => ({ ref: 'dotify:enc:v2:key-v2:ipfs://wrong', runtimeAddress: OLD_RUNTIME }),
        publicationRuntimeAddress: CURRENT_RUNTIME,
        canRetry: true,
        mismatchMessage
      })
    ).rejects.toThrow(`${OLD_RUNTIME} != ${CURRENT_RUNTIME}`);
    expect(ref.current).toBeNull();
  });
});
