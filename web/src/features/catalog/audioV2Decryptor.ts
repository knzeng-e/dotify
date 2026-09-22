import { decryptAudioV2Chunk, importAudioV2ContentKey, type AudioV2Header } from '../../shared/utils/audioV2';
import type { AudioV2DecryptWorkerRequest, AudioV2DecryptWorkerResponse } from './audioV2DecryptorProtocol';
import InlineAudioV2DecryptWorker from './audioV2Decrypt.worker?worker&inline';

export type AudioV2DecryptExecution = 'worker' | 'main-thread';

export type AudioV2ChunkDecryptor = {
  execution: AudioV2DecryptExecution;
  decrypt: (chunkIndex: number, encrypted: Uint8Array, signal?: AbortSignal) => Promise<Uint8Array>;
  close: () => void;
};

export class AudioV2DecryptAuthenticationError extends Error {
  constructor(readonly cause: unknown) {
    super('DAV2 chunk authentication failed');
    this.name = 'AudioV2DecryptAuthenticationError';
  }
}

export class AudioV2WorkerTransportError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AudioV2WorkerTransportError';
  }
}

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
  if (import.meta.env.VITE_DOTIFY_INLINE_AUDIO_WORKER === 'true') {
    return new InlineAudioV2DecryptWorker({ name: 'dotify-dav2-decrypt' });
  }
  return new Worker(new URL('./audioV2Decrypt.worker.ts', import.meta.url), { type: 'module', name: 'dotify-dav2-decrypt' });
}

function createMainThreadDecryptor(header: AudioV2Header, key: Uint8Array, parentSignal?: AbortSignal): AudioV2ChunkDecryptor {
  const cryptoKeyPromise = importAudioV2ContentKey(key);
  let closed = false;

  return {
    execution: 'main-thread',
    async decrypt(chunkIndex, encrypted, signal) {
      if (closed || parentSignal?.aborted || signal?.aborted) throw createAbortError();
      let cryptoKey: CryptoKey;
      try {
        cryptoKey = await cryptoKeyPromise;
      } catch (error) {
        throw new AudioV2DecryptAuthenticationError(error);
      }
      if (closed || parentSignal?.aborted || signal?.aborted) throw createAbortError();
      let clear: Uint8Array;
      try {
        clear = await decryptAudioV2Chunk(header, chunkIndex, encrypted, cryptoKey);
      } catch (error) {
        throw new AudioV2DecryptAuthenticationError(error);
      }
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
  let terminalError: Error | null = null;
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
    terminalError = error;
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
      failWorker(new AudioV2WorkerTransportError(response.message));
      return;
    }

    const request = pending.get(response.requestId);
    if (!request) return;
    pending.delete(response.requestId);
    request.cleanupAbort();
    if (response.type === 'authentication-error') {
      request.reject(new AudioV2DecryptAuthenticationError(new Error(response.message)));
      return;
    }
    request.resolve(new Uint8Array(response.clear));
  };
  worker.onerror = event => {
    failWorker(new AudioV2WorkerTransportError(event.message || 'DAV2 decrypt worker failed'));
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
    failWorker(new AudioV2WorkerTransportError('Unable to initialize DAV2 decrypt worker', error));
  }
  await ready;

  return {
    execution: 'worker',
    decrypt(chunkIndex, encrypted, signal) {
      if (options.signal?.aborted || signal?.aborted) return Promise.reject(createAbortError());
      if (closed) return Promise.reject(terminalError ?? createAbortError());
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
          reject(new AudioV2WorkerTransportError('Unable to send DAV2 chunk to decrypt worker', error));
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
    const workerDecryptor = await createWorkerDecryptor(options, worker);
    let activeDecryptor = workerDecryptor;
    return {
      get execution() {
        return activeDecryptor.execution;
      },
      async decrypt(chunkIndex, encrypted, signal) {
        try {
          return await activeDecryptor.decrypt(chunkIndex, encrypted, signal);
        } catch (error) {
          if (!(error instanceof AudioV2WorkerTransportError)) throw error;
          if (activeDecryptor === workerDecryptor) {
            workerDecryptor.close();
            activeDecryptor = createMainThreadDecryptor(options.header, options.key, options.signal);
          }
          return activeDecryptor.decrypt(chunkIndex, encrypted, signal);
        }
      },
      close() {
        activeDecryptor.close();
        if (activeDecryptor !== workerDecryptor) workerDecryptor.close();
      }
    };
  } catch (error) {
    worker?.terminate();
    if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    return createMainThreadDecryptor(options.header, options.key, options.signal);
  }
}
