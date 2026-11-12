import type { FastifyInstance } from 'fastify';
import type { CatalogReadModel } from '../services/catalog/readModel.js';
import { createEncryptedMediaReader, streamingMediaReference, MediaError } from '../services/encryptedMedia.js';
import { createMediaDeliveryReader } from '../services/mediaDelivery.js';
import { config } from '../config.js';

export function createMediaRoutes({
  catalog,
  reader = createMediaDeliveryReader({ bulletinRpcUrl: config.BULLETIN_MEDIA_RPC_URL, dedicatedGateway: config.MEDIA_IPFS_GATEWAY })
}: {
  catalog: Pick<CatalogReadModel, 'getSnapshot'> & Partial<Pick<CatalogReadModel, 'refresh'>>;
  reader?: ReturnType<typeof createEncryptedMediaReader> & Partial<Pick<ReturnType<typeof createMediaDeliveryReader>, 'readCompact'>>;
}) {
  return async function mediaRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async () => catalog.refresh?.());
    let sendingBytes = 0;
    app.addHook('onClose', async () => reader.clear());
    // One route/store keeps the existing rate limit shared across formats.
    app.get<{ Params: { cid: string; format: string; '*': string } }>(
      '/api/media/:cid/:format/*',
      { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
      async (request, reply) => {
        reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff');
        const { cid, format } = request.params;
        const layout = format === 'stream' ? 'unixfs-files-v1' : format === 'compact-v1' ? 'rendition-pack-v1' : null;
        if (!layout) return reply.code(404).send({ code: 'MEDIA_NOT_FOUND', error: 'Audio is not available here.' });
        const object = request.params['*'];
        const valid = /^(?:manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/.test(object);
        const snapshot = catalog.getSnapshot();
        const candidates =
          valid && !Object.keys(request.query as object).length
            ? (snapshot?.releases.filter(release => {
                const ref = streamingMediaReference(release.audioRef);
                return release.active && release.encrypted && ref?.root === cid && ref.layout === layout;
              }) ?? [])
            : [];
        if (!candidates.length || request.headers.range) return reply.code(404).send({ code: 'MEDIA_NOT_FOUND', error: 'Audio is not available here.' });
        const selectedRelease = candidates[0];
        // Do not choose a key/scope arbitrarily when a root has conflicting
        // registered identities. The ordinary legacy ciphertext path is intact.
        if (
          layout === 'rendition-pack-v1' &&
          candidates.some(
            candidate =>
              candidate.runtimeAddress !== selectedRelease.runtimeAddress ||
              candidate.hash !== selectedRelease.hash ||
              candidate.audioRef !== selectedRelease.audioRef
          )
        )
          return reply.code(404).send({ code: 'MEDIA_NOT_FOUND', error: 'Audio is not available here.' });
        const controller = new AbortController();
        const abort = () => {
          if (!reply.raw.writableFinished) controller.abort();
        };
        request.raw.once('aborted', abort);
        reply.raw.once('close', abort);
        try {
          const media =
            layout === 'unixfs-files-v1'
              ? await reader.read(`${cid}/${object}`, controller.signal)
              : reader.readCompact
                ? await reader.readCompact(
                    `${cid}/${object}`,
                    {
                      chainId: snapshot!.chainId,
                      runtimeAddress: selectedRelease.runtimeAddress.toLowerCase(),
                      contentHash: selectedRelease.hash.toLowerCase(),
                      keyVersion: streamingMediaReference(selectedRelease.audioRef)!.keyVersion
                    },
                    controller.signal
                  )
                : (() => {
                    throw new MediaError(502, 'MEDIA_UNAVAILABLE');
                  })();
          if (reply.raw.destroyed) return reply;
          if (sendingBytes + media.bytes.length > 64 * 1024 * 1024) throw new MediaError(503, 'MEDIA_BUSY');
          sendingBytes += media.bytes.length;
          let released = false;
          const release = () => {
            if (released) return;
            released = true;
            sendingBytes -= media.bytes.length;
            reply.raw.off('finish', release);
            reply.raw.off('close', release);
          };
          reply.raw.once('finish', release);
          reply.raw.once('close', release);
          return reply.type('application/octet-stream').send(media.bytes);
        } catch (error) {
          if (controller.signal.aborted || reply.raw.destroyed) return reply;
          const failure = error instanceof MediaError ? error : new MediaError(502, 'MEDIA_UNAVAILABLE');
          if (failure.statusCode === 503) reply.header('retry-after', '2');
          return reply.code(failure.statusCode).send({ code: failure.code, error: failure.message });
        } finally {
          request.raw.off('aborted', abort);
          reply.raw.off('close', abort);
        }
      }
    );
  };
}
