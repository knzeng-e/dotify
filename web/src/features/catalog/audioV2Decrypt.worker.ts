import { decryptAudioV2Chunk, importAudioV2ContentKey, type AudioV2Header } from '../../shared/utils/audioV2';
import type { AudioV2DecryptWorkerRequest, AudioV2DecryptWorkerResponse } from './audioV2DecryptorProtocol';

type WorkerScope = {
  onmessage: ((event: MessageEvent<AudioV2DecryptWorkerRequest>) => void) | null;
  postMessage: (message: AudioV2DecryptWorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = globalThis as unknown as WorkerScope;
let header: AudioV2Header | null = null;
let cryptoKey: CryptoKey | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'DAV2 decryption failed';
}

workerScope.onmessage = event => {
  const request = event.data;
  if (request.type === 'init') {
    const rawKey = new Uint8Array(request.key);
    void importAudioV2ContentKey(rawKey)
      .then(importedKey => {
        rawKey.fill(0);
        header = request.header;
        cryptoKey = importedKey;
        workerScope.postMessage({ type: 'ready' });
      })
      .catch(error => {
        rawKey.fill(0);
        workerScope.postMessage({ type: 'fatal', message: errorMessage(error) });
      });
    return;
  }

  if (!header || !cryptoKey) {
    workerScope.postMessage({ type: 'request-error', requestId: request.requestId, message: 'DAV2 decrypt worker is not ready' });
    return;
  }

  void decryptAudioV2Chunk(header, request.chunkIndex, new Uint8Array(request.encrypted), cryptoKey)
    .then(clear => {
      const clearBuffer = clear.buffer.slice(clear.byteOffset, clear.byteOffset + clear.byteLength) as ArrayBuffer;
      workerScope.postMessage({ type: 'result', requestId: request.requestId, clear: clearBuffer }, [clearBuffer]);
    })
    .catch(error => {
      workerScope.postMessage({ type: 'request-error', requestId: request.requestId, message: errorMessage(error) });
    });
};
