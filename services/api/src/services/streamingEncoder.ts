import { performance } from 'node:perf_hooks';
import { blake2b } from '@noble/hashes/blake2';
import { StreamingEncryptor, STREAM_MIME, validateStreamingScope, type StreamingManifest, type StreamingScope } from './streamingFormat.js';
import type { StreamingNonceLedger } from './streamingNonces.js';
import { transcodeStreamingAudio, type EncodedStreamingAudio } from './streamingTranscoder.js';
export { streamingLoudness } from './streamingTranscoder.js';
export type StreamingEncodingResult = { manifest: StreamingManifest; files: Array<{ name: string; bytes: Buffer }>; elapsedMs: number };

/** Local codec tests use the parser directly; production supplies the isolated service. */
export async function encodeStreamingRelease(input: {
  master: Buffer;
  key: Buffer;
  scope: StreamingScope;
  ledger: StreamingNonceLedger;
  ffmpegPath?: string;
  temporaryRoot?: string;
  signal?: AbortSignal;
  onProgress?: (phase: 'measuring' | 'encoding' | 'encrypting', bitrate?: number) => void;
  transcode?: (master: Buffer, signal?: AbortSignal) => Promise<EncodedStreamingAudio>;
}): Promise<StreamingEncodingResult> {
  const started = performance.now();
  const master = Buffer.from(input.master);
  const key = Buffer.from(input.key);
  const scope = { ...input.scope };
  try {
    validateStreamingScope(scope);
    if (key.length !== 32 || !master.length || master.length > 50 * 1024 * 1024) throw new Error('Invalid streaming upload budget or key');
    if (scope.contentHash !== `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`) throw new Error('Streaming master hash mismatch');
    const reservation = await input.ledger.reserve(key);
    const encryptor = new StreamingEncryptor(key, reservation, scope);
    const encoded = input.transcode ? await input.transcode(master, input.signal) : await transcodeStreamingAudio({ ...input, master });
    input.signal?.throwIfAborted();
    input.onProgress?.('encrypting');
    const archive = encryptor.object(master, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
    const files: StreamingEncodingResult['files'] = [{ name: archive.descriptor.path, bytes: archive.bytes }];
    const renditions: StreamingManifest['renditions'] = [];
    for (const rendition of encoded.renditions) {
      const id = String(rendition.bitrateKbps);
      const init = encryptor.object(rendition.init, { rendition: id, kind: 'init', index: 0, path: `${id}/init.bin` });
      files.push({ name: init.descriptor.path, bytes: init.bytes });
      const segments = rendition.segments.map((bytes, index) => {
        const encrypted = encryptor.object(bytes, { rendition: id, kind: 'media', index, path: `${id}/segment-${String(index).padStart(3, '0')}.bin` });
        files.push({ name: encrypted.descriptor.path, bytes: encrypted.bytes });
        return encrypted.descriptor;
      });
      renditions.push({ bitrateKbps: rendition.bitrateKbps, mediaMime: STREAM_MIME, init: init.descriptor, segments });
    }
    const manifest = encryptor.manifest({
      durationSeconds: encoded.durationSeconds,
      integratedLufs: encoded.integratedLufs,
      gainDb: encoded.gainDb,
      master: archive.descriptor,
      renditions
    });
    files.push({ name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
    return { manifest, files, elapsedMs: Math.round(performance.now() - started) };
  } finally {
    master.fill(0);
    key.fill(0);
  }
}
