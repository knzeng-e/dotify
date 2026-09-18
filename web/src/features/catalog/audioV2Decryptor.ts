import { decryptAudioV2Chunk, importAudioV2ContentKey, type AudioV2Header } from '../../shared/utils/audioV2';
import type { AudioV2DecryptWorkerRequest, AudioV2DecryptWorkerResponse } from './audioV2DecryptorProtocol';

export type AudioV2DecryptExecution = 'worker' | 'main-thread';

export type AudioV2ChunkDecryptor = {
  execution: AudioV2DecryptExecution;
  decrypt: (chunkIndex: number, encrypted: Uint8Array, signal?: AbortSignal) => Promise<Uint8Array>;
  close: () => void;
};

type WorkerLike = {
  onmessage: ((event: MessageEvent<AudioV2DecryptWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: AudioV2DecryptWorkerRequest, transfer: Transferable[]) => void;
  terminate: () => void;
};

type PendingRequest = {
  resolve: (clear: Uint8Array) => void;
  reject: (error: Error) => void;
  cleanupAbort: () => void;
};

type AudioV2DecryptorOptions = {
  header: AudioV2Header;
  key: Uint8Array;
  signal?: AbortSignal;
  workerFactory?: () => WorkerLike;
  workerReadyTimeoutMs?: number;
};

const DEFAULT_WORKER_READY_TIMEOUT_MS = 1_500;

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('DAV2 decryption cancelled', 'AbortError');
  const error = new Error('DAV2 decryption cancelled');
  error.name = 'AbortError';
  return error;
}

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('./audioV2Decrypt.worker.ts', import.meta.url), { type: 'module', name: 'dotify-dav2-decrypt' });
}

function createMainThreadDecryptor(header: AudioV2Header, key: Uint8Array, parentSignal?: AbortSignal): AudioV2ChunkDecryptor {
  const cryptoKeyPromise = importAudioV2ContentKey(key);
  let closed = false;

  return {
    execution: 'main-thread',
    async decrypt(chunkIndex, encrypted, signal) {
      if (closed || parentSignal?.aborted || signal?.aborted) throw createAbortError();
      const cryptoKey = await cryptoKeyPromise;
      if (closed || parentSignal?.aborted || signal?.aborted) throw createAbortError();
      const clear = await decryptAudioV2Chunk(header, chunkIndex, encrypted, cryptoKey);
      if (closed || parentSignal?.aborted || signal?.aborted) throw createAbortError();
      return clear;
    },
    close() {
      closed = true;
    }
  };
}

async function createWorkerDecryptor(options: AudioV2DecryptorOptions, worker: WorkerLike): Promise<AudioV2ChunkDecryptor> {
  let closed = false;
  let nextRequestId = 1;
  const pending = new Map<number, PendingRequest>();

  const rejectPending = (error: Error) => {
    for (const request of pending.values()) {
      request.cleanupAbort();
      request.reject(error);
    }
    pending.clear();
  };

  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let readyTimeoutId: ReturnType<typeof setTimeout> | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const clearReadyTimeout = () => {
    if (readyTimeoutId !== undefined) clearTimeout(readyTimeoutId);
    readyTimeoutId = undefined;
  };

  const close = () => {
    if (closed) return;
    closed = true;
    clearReadyTimeout();
    worker.terminate();
    rejectReady(createAbortError());
    rejectPending(createAbortError());
    options.signal?.removeEventListener('abort', close);
  };

  const failWorker = (error: Error) => {
    if (closed) return;
    closed = true;
    clearReadyTimeout();
    worker.terminate();
    rejectReady(error);
    rejectPending(error);
    options.signal?.removeEventListener('abort', close);
  };

  worker.onmessage = event => {
    const response = event.data;
    if (response.type === 'ready') {
      clearReadyTimeout();
      resolveReady();
      return;
    }
    if (response.type === 'fatal') {
      failWorker(new Error(response.message));
      return;
    }

    const request = pending.get(response.requestId);
    if (!request) return;
    pending.delete(response.requestId);
    request.cleanupAbort();
    if (response.type === 'request-error') {
      request.reject(new Error(response.message));
      return;
    }
    request.resolve(new Uint8Array(response.clear));
  };
  worker.onerror = event => {
    failWorker(new Error(event.message || 'DAV2 decrypt worker failed'));
  };

  if (options.signal?.aborted) {
    close();
    throw createAbortError();
  }
  options.signal?.addEventListener('abort', close, { once: true });

  const workerReadyTimeoutMs = options.workerReadyTimeoutMs ?? DEFAULT_WORKER_READY_TIMEOUT_MS;
  readyTimeoutId = setTimeout(() => failWorker(new Error('DAV2 decrypt worker did not become ready')), workerReadyTimeoutMs);

  const keyCopy = options.key.slice();
  const keyBuffer = keyCopy.buffer as ArrayBuffer;
  try {
    worker.postMessage({ type: 'init', header: options.header, key: keyBuffer }, [keyBuffer]);
  } catch (error) {
    failWorker(error instanceof Error ? error : new Error('Unable to initialize DAV2 decrypt worker'));
  }
  await ready;

  return {
    execution: 'worker',
    decrypt(chunkIndex, encrypted, signal) {
      if (closed || options.signal?.aborted || signal?.aborted) return Promise.reject(createAbortError());
      const requestId = nextRequestId++;
      const encryptedCopy = encrypted.slice();
      const encryptedBuffer = encryptedCopy.buffer as ArrayBuffer;
      return new Promise<Uint8Array>((resolve, reject) => {
        const handleAbort = () => {
          const request = pending.get(requestId);
          if (!request) return;
          pending.delete(requestId);
          request.cleanupAbort();
          request.reject(createAbortError());
        };
        const cleanupAbort = () => signal?.removeEventListener('abort', handleAbort);
        pending.set(requestId, { resolve, reject, cleanupAbort });
        signal?.addEventListener('abort', handleAbort, { once: true });
        try {
          worker.postMessage({ type: 'decrypt', requestId, chunkIndex, encrypted: encryptedBuffer }, [encryptedBuffer]);
        } catch (error) {
          pending.delete(requestId);
          cleanupAbort();
          reject(error instanceof Error ? error : new Error('Unable to send DAV2 chunk to decrypt worker'));
        }
      });
    },
    close
  };
}

/**
 * Keeps AES-GCM chunk work away from rendering when Workers are available.
 * Hosts without Worker support retain the same fail-closed Web Crypto path.
 */
export async function createAudioV2ChunkDecryptor(options: AudioV2DecryptorOptions): Promise<AudioV2ChunkDecryptor> {
  if (options.signal?.aborted) throw createAbortError();
  const workerFactory = options.workerFactory ?? (typeof Worker === 'undefined' ? undefined : defaultWorkerFactory);
  if (!workerFactory) return createMainThreadDecryptor(options.header, options.key, options.signal);

  let worker: WorkerLike | undefined;
  try {
    worker = workerFactory();
    return await createWorkerDecryptor(options, worker);
  } catch (error) {
    worker?.terminate();
    if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    return createMainThreadDecryptor(options.header, options.key, options.signal);
  }
}
