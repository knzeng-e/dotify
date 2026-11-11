// Deterministic synthetic ciphertext only, with a disposable known test key.
import { createHash } from 'node:crypto';
import { StreamingEncryptor, STREAM_MIME } from '../../src/services/streamingFormat.ts';
import { streamingNonce } from '../../src/services/streamingNonces.ts';

export function compactFixture({ masterBytes = 2302865, segments = 23, segmentBytes = [48000, 84000, 156000] } = {}) {
  const scope = { chainId: 1, runtimeAddress: '0x' + '11'.repeat(20), contentHash: '0x' + '22'.repeat(32), keyVersion: 'dotify-content-key-v3' };
  const seed = JSON.stringify([masterBytes, segments, segmentBytes]);
  const key = createHash('sha256')
    .update('synthetic-key:' + seed)
    .digest();
  const generation = createHash('sha256')
    .update('synthetic-generation:' + seed)
    .digest('hex')
    .slice(0, 16);
  let counter = 0;
  const encoder = new StreamingEncryptor(
    key,
    {
      generation,
      next() {
        const value = counter++;
        return { counter: value, nonce: streamingNonce(generation, value) };
      }
    },
    scope
  );
  const files = [],
    plain = new Map();
  const object = (path, size, rendition, kind, index) => {
    const value = createHash('shake256', { outputLength: size }).update(path).digest();
    const encrypted = encoder.object(value, { path, rendition, kind, index });
    plain.set(path, value);
    files.push({ path, bytes: encrypted.bytes });
    return encrypted.descriptor;
  };
  const master = object('archive/master.bin', masterBytes, 'archive', 'master', 0);
  const renditions = [96, 160, 320].map((rate, i) => ({
    bitrateKbps: rate,
    mediaMime: STREAM_MIME,
    init: object(`${rate}/init.bin`, 800, String(rate), 'init', 0),
    segments: Array.from({ length: segments }, (_, index) =>
      object(`${rate}/segment-${String(index).padStart(3, '0')}.bin`, segmentBytes[i], String(rate), 'media', index)
    )
  }));
  const manifest = encoder.manifest({ durationSeconds: segments * 4, integratedLufs: null, gainDb: 0, master, renditions });
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  files.push({ path: 'manifest.json', bytes: manifestBytes });
  return { scope, key, manifest, manifestBytes, files, plain };
}
