import type { AudioV2Header } from '../../shared/utils/audioV2';

export type AudioV2DecryptWorkerRequest =
  | {
      type: 'init';
      header: AudioV2Header;
      key: ArrayBuffer;
    }
  | {
      type: 'decrypt';
      requestId: number;
      chunkIndex: number;
      encrypted: ArrayBuffer;
    };

export type AudioV2DecryptWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; requestId: number; clear: ArrayBuffer }
  | { type: 'request-error'; requestId: number; message: string }
  | { type: 'fatal'; message: string };
