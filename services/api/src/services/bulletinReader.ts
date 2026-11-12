// Catalog-gated Web/API ciphertext path. Injecting this reader into existing
// createMediaRoutes does not grant keys or create a general IPFS gateway.
import { readBulletinMediaPath } from './bulletinGraph.js';
import { readAuthenticatedCompactObject } from './bulletinCompactReader.js';
import { parseStreamingManifest, verifyStreamingManifest, type StreamingScope } from './streamingFormat.js';
import { MediaError, type EncryptedMedia } from './encryptedMedia.js';

export function createBulletinMediaReader(readBlock: (cid: string, signal: AbortSignal) => Promise<Uint8Array>) {
  let active = 0;
  let generation = new AbortController();
  return {
    async read(object: string, owner?: AbortSignal, compact?: { scope: StreamingScope; key: Buffer }): Promise<EncryptedMedia> {
      owner?.throwIfAborted();
      const match = /^(b[a-z2-7]{20,110})\/(manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/.exec(object);
      if (!match) throw new MediaError(404, 'MEDIA_NOT_FOUND');
      if (active >= 2) throw new MediaError(503, 'MEDIA_BUSY');
      active++;
      const signal = AbortSignal.any([...(owner ? [owner] : []), generation.signal, AbortSignal.timeout(12_000)]);
      let abort: () => void = () => undefined;
      try {
        const max = match[2] === 'manifest.json' ? 256 * 1024 : 1024 * 1024 + 16;
        const bytes = await Promise.race([
          (async () => {
            if (!compact) return readBulletinMediaPath(readBlock, match[1], match[2], max, signal);
            const manifestBytes = await readBulletinMediaPath(readBlock, match[1], 'manifest.json', 256 * 1024, signal);
            signal.throwIfAborted();
            if (match[2] === 'manifest.json') {
              verifyStreamingManifest(parseStreamingManifest(manifestBytes), compact.key, compact.scope);
              return manifestBytes;
            }
            return Buffer.from(
              await readAuthenticatedCompactObject({
                readBlock,
                root: match[1],
                manifestBytes,
                key: compact.key,
                scope: compact.scope,
                objectPath: match[2],
                maxBytes: max,
                signal
              })
            );
          })(),
          new Promise<never>((_, reject) => {
            abort = () => reject(signal.reason);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
          })
        ]);
        signal.throwIfAborted();
        return { bytes };
      } catch {
        owner?.throwIfAborted();
        throw new MediaError(502, 'MEDIA_UNAVAILABLE');
      } finally {
        signal.removeEventListener('abort', abort);
        active--;
      }
    },
    clear() {
      generation.abort();
      generation = new AbortController();
    }
  };
}
