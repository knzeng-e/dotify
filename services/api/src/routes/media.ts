import type { FastifyInstance } from 'fastify';
import type { CatalogReadModel } from '../services/catalog/readModel.js';
import { createEncryptedMediaReader, encryptedMediaCid, MediaError, parseMediaRange } from '../services/encryptedMedia.js';

export function createMediaRoutes({
  catalog,
  reader = createEncryptedMediaReader()
}: {
  catalog: Pick<CatalogReadModel, 'getSnapshot'>;
  reader?: ReturnType<typeof createEncryptedMediaReader>;
}) {
  return async function mediaRoutes(app: FastifyInstance) {
    let sendingBytes = 0;
    app.addHook('onClose', async () => reader.clear());
    app.get<{ Params: { cid: string } }>('/api/media/:cid', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const cid = request.params.cid;
      // Check the current canonical catalog even on cache hits. Never make an
      // open proxy, reveal unknown refs or accept an unencrypted source file.
      const known =
        !Object.keys(request.query as object).length &&
        catalog.getSnapshot()?.releases.find(release => release.active && release.encrypted && encryptedMediaCid(release.audioRef) === cid);
      if (!known) return reply.code(404).send({ code: 'MEDIA_NOT_FOUND', error: 'Audio is not available here.', requestId: request.id });
      const controller = new AbortController();
      const abort = () => controller.abort();
      const close = () => {
        if (!reply.raw.writableFinished) abort();
      };
      request.raw.once('aborted', abort);
      reply.raw.once('close', close);
      if (request.raw.aborted || reply.raw.destroyed) abort();
      try {
        const range = parseMediaRange(request.headers.range);
        const media = await reader.read(cid, range, known.audioRef.startsWith('dotify:enc:v2:'), controller.signal);
        if (reply.raw.destroyed || reply.raw.writableEnded) return reply;
        // Slow HTTP receivers must not retain unbounded evicted buffers outside
        // the cache budget. Rejection leaves independent IPFS readers usable.
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
        reply.header('content-type', 'application/octet-stream');
        reply.header('accept-ranges', 'bytes');
        reply.header('x-content-type-options', 'nosniff');
        if (media.partial) reply.code(206).header('content-range', `bytes ${media.start}-${media.start + media.bytes.length - 1}/${media.total}`);
        return reply.send(media.bytes);
      } catch (error) {
        if (controller.signal.aborted || reply.raw.destroyed || reply.raw.writableEnded) return reply;
        const failure = error instanceof MediaError ? error : new MediaError(502, 'MEDIA_UNAVAILABLE');
        if (failure.statusCode === 503) reply.header('retry-after', '2');
        return reply.code(failure.statusCode).send({ code: failure.code, error: failure.message, requestId: request.id });
      } finally {
        request.raw.off('aborted', abort);
        reply.raw.off('close', close);
      }
    });
  };
}
