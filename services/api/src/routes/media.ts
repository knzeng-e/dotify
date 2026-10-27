import type { FastifyInstance } from 'fastify';
import type { CatalogReadModel } from '../services/catalog/readModel.js';
import { createEncryptedMediaReader, encryptedMediaCid, MediaError } from '../services/encryptedMedia.js';
import { config } from '../config.js';

export function createMediaRoutes({
  catalog,
  reader = createEncryptedMediaReader(fetch, config.MEDIA_IPFS_GATEWAY)
}: {
  catalog: Pick<CatalogReadModel, 'getSnapshot'> & Partial<Pick<CatalogReadModel, 'refresh'>>;
  reader?: ReturnType<typeof createEncryptedMediaReader>;
}) {
  return async function mediaRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async () => catalog.refresh?.());
    let sendingBytes = 0;
    app.addHook('onClose', async () => reader.clear());
    app.get<{ Params: { cid: string; '*': string } }>(
      '/api/media/:cid/stream/*',
      { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
      async (request, reply) => {
        reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff');
        const { cid } = request.params;
        const object = request.params['*'];
        const valid = /^(?:manifest\.json|(?:96|160|320)\/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\.bin)$/.test(object);
        const known =
          valid &&
          !Object.keys(request.query as object).length &&
          catalog
            .getSnapshot()
            ?.releases.some(
              release => release.active && release.encrypted && release.audioRef.startsWith('dotify:enc:v3:') && encryptedMediaCid(release.audioRef) === cid
            );
        if (!known || request.headers.range) return reply.code(404).send({ code: 'MEDIA_NOT_FOUND', error: 'Audio is not available here.' });
        const controller = new AbortController();
        const abort = () => {
          if (!reply.raw.writableFinished) controller.abort();
        };
        request.raw.once('aborted', abort);
        reply.raw.once('close', abort);
        try {
          const media = await reader.read(`${cid}/${object}`, controller.signal);
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
