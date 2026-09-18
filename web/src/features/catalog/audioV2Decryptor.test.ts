import { describe, expect, it } from 'vitest';
import type { AudioV2Header } from '../../shared/utils/audioV2';
import { decryptAudioV2Chunk, importAudioV2ContentKey } from '../../shared/utils/audioV2';
import { createAudioV2ChunkDecryptor } from './audioV2Decryptor';
import type { AudioV2DecryptWorkerRequest, AudioV2DecryptWorkerResponse } from './audioV2DecryptorProtocol';

const KEY = new Uint8Array(32).fill(0x7a);
const PLAIN = new TextEncoder().encode('worker keeps playback responsive');
const HEADER: AudioV2Header = {
  schema: 'dotify.audio.v2',
  version: 1,
  algorithm: 'AES-256-GCM',
  chunkSize: PLAIN.length,
  chunkCount: 1,
  plaintextLength: PLAIN.length,
  mediaMime: 'audio/mpeg',
  contentHash: `0x${'ab'.repeat(32)}`,
  noncePrefix: '0102030405060708',
  chunks: [{ index: 0, plainLength: PLAIN.length, encryptedLength: PLAIN.length + 16 }]
};

async function encryptedChunk(): Promise<Uint8Array> {
  const nonce = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]);
  const aad = new TextEncoder().encode(
    [
      HEADER.schema,
      String(HEADER.version),
      HEADER.contentHash,
      String(HEADER.chunkSize),
      String(HEADER.chunkCount),
      String(HEADER.plaintextLength),
      HEADER.mediaMime,
      '0',
      String(PLAIN.length)
    ].join('|')
  );
  const key = await crypto.subtle.importKey('raw', KEY, 'AES-GCM', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, PLAIN));
}

class TestWorker {
  onmessage: ((event: MessageEvent<AudioV2DecryptWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  decryptRequests = 0;
  private header: AudioV2Header | null = null;
  private key: CryptoKey | null = null;

  constructor(private readonly behavior: 'decrypt' | 'fatal-init' | 'stall' | 'stall-init') {}

  postMessage(message: AudioV2DecryptWorkerRequest, _transfer: Transferable[]): void {
    if (message.type === 'init') {
      if (this.behavior === 'stall-init') return;
      if (this.behavior === 'fatal-init') {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'fatal', message: 'worker unavailable' } } as MessageEvent<AudioV2DecryptWorkerResponse>));
        return;
      }
      void importAudioV2ContentKey(new Uint8Array(message.key)).then(key => {
        this.header = message.header;
        this.key = key;
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent<AudioV2DecryptWorkerResponse>);
      });
      return;
    }

    this.decryptRequests += 1;
    if (this.behavior === 'stall') return;
    void decryptAudioV2Chunk(this.header!, message.chunkIndex, new Uint8Array(message.encrypted), this.key!).then(clear => {
      const clearBuffer = clear.buffer.slice(clear.byteOffset, clear.byteOffset + clear.byteLength) as ArrayBuffer;
      this.onmessage?.({ data: { type: 'result', requestId: message.requestId, clear: clearBuffer } } as MessageEvent<AudioV2DecryptWorkerResponse>);
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('DAV2 chunk decryptor', () => {
  it('decrypts through the worker path and terminates after playback', async () => {
    const worker = new TestWorker('decrypt');
    const decryptor = await createAudioV2ChunkDecryptor({ header: HEADER, key: KEY, workerFactory: () => worker });

    await expect(decryptor.decrypt(0, await encryptedChunk())).resolves.toEqual(PLAIN);
    expect(decryptor.execution).toBe('worker');
    expect(worker.decryptRequests).toBe(1);

    decryptor.close();
    expect(worker.terminated).toBe(true);
  });

  it('keeps playback available through Web Crypto when worker setup fails', async () => {
    const worker = new TestWorker('fatal-init');
    const decryptor = await createAudioV2ChunkDecryptor({ header: HEADER, key: KEY, workerFactory: () => worker });

    expect(decryptor.execution).toBe('main-thread');
    await expect(decryptor.decrypt(0, await encryptedChunk())).resolves.toEqual(PLAIN);
    expect(worker.terminated).toBe(true);
    decryptor.close();
  });

  it('bounds worker startup and falls back when a host never starts it', async () => {
    const worker = new TestWorker('stall-init');
    const decryptor = await createAudioV2ChunkDecryptor({ header: HEADER, key: KEY, workerFactory: () => worker, workerReadyTimeoutMs: 5 });

    expect(decryptor.execution).toBe('main-thread');
    await expect(decryptor.decrypt(0, await encryptedChunk())).resolves.toEqual(PLAIN);
    expect(worker.terminated).toBe(true);
    decryptor.close();
  });

  it('terminates pending worker work when playback is cancelled', async () => {
    const controller = new AbortController();
    const worker = new TestWorker('stall');
    const decryptor = await createAudioV2ChunkDecryptor({ header: HEADER, key: KEY, signal: controller.signal, workerFactory: () => worker });
    const pending = decryptor.decrypt(0, await encryptedChunk());

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
  });
});
