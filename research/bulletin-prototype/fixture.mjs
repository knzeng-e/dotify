import { randomBytes, createHash } from 'node:crypto';
import { join } from 'node:path';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from '../../services/api/src/services/streamingNonces.ts';
import { StreamingEncryptor, STREAM_BITRATES, STREAM_MIME } from '../../services/api/src/services/streamingFormat.ts';

/** Public synthetic byte patterns, not valid AAC or an artist master. */
export async function encryptedFixture(directory) {
  const key = randomBytes(32);
  const ledgerPath = join(directory, 'nonces');
  await initializeStreamingNonceLedger(ledgerPath);
  const reservation = await new StreamingNonceLedger(ledgerPath).reserve(key);
  const masterBytes = Buffer.alloc(700 * 1024, 0x41);
  const scope = {
    chainId: 420420417,
    runtimeAddress: `0x${'11'.repeat(20)}`,
    contentHash: `0x${createHash('sha256').update(masterBytes).digest('hex')}`,
    keyVersion: 'dotify-content-key-v2'
  };
  const encrypt = new StreamingEncryptor(key, reservation, scope);
  const files = [];
  const originals = new Map();
  const object = (plain, context) => {
    const result = encrypt.object(plain, context);
    files.push({ path: context.path, bytes: result.bytes });
    originals.set(context.path, Buffer.from(plain));
    return result.descriptor;
  };
  const master = object(masterBytes, { rendition: 'archive', kind: 'master', index: 0, path: 'archive/master.bin' });
  const renditions = STREAM_BITRATES.map(bitrateKbps => ({
    bitrateKbps,
    mediaMime: STREAM_MIME,
    init: object(Buffer.alloc(1024, bitrateKbps), { rendition: String(bitrateKbps), kind: 'init', index: 0, path: `${bitrateKbps}/init.bin` }),
    segments: [0, 1].map(index =>
      object(Buffer.alloc(24 * 1024, (bitrateKbps + index) % 256), {
        rendition: String(bitrateKbps),
        kind: 'media',
        index,
        path: `${bitrateKbps}/segment-${String(index).padStart(3, '0')}.bin`
      })
    )
  }));
  const manifest = encrypt.manifest({ master, renditions, durationSeconds: 8, integratedLufs: null, gainDb: 0 });
  files.push({ path: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) });
  return { key, manifest, files, originals, scope };
}
