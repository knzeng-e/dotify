// A narrow public artwork/metadata relay, never a general IPFS gateway or key API.
import type { FastifyInstance } from 'fastify';
import { CID } from 'multiformats/cid';
import { config } from '../config.js';
import { createBulletinHttpBlockReader } from '../services/bulletinHttpReader.js';
import { publicAssetPath, readPublicAsset } from '../services/bulletinPublicAssets.js';
export function createPublicAssetRoutes(injected?: { read(cid: string, signal: AbortSignal): Promise<Uint8Array>; clear(): void }) {
  const http = !injected && config.BULLETIN_MEDIA_RPC_URL ? createBulletinHttpBlockReader(config.BULLETIN_MEDIA_RPC_URL) : undefined;
  const reader = injected ?? (http ? { read: http, clear: http.clear } : undefined);
  return async (app: FastifyInstance) => {
    let active = 0;
    app.addHook('onClose', async () => reader?.clear());
    app.get<{ Params: { cid: string; '*': string } }>(
      '/api/assets/ipfs/:cid/*',
      { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
      async (request, reply) => {
        reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff');
        const { cid, '*': path } = request.params;
        let valid = false;
        try {
          const root = CID.parse(cid);
          valid = root.version === 1 && root.code === 0x70 && root.multihash.code === 0xb220 && root.multihash.digest.length === 32 && root.toString() === cid;
        } catch {
          /* Invalid identifier. */
        }
        if (!valid || !publicAssetPath(path) || Object.keys(request.query as object).length || request.headers.range)
          return reply.code(404).send({ code: 'ASSET_NOT_FOUND', error: 'This asset is not available here.' });
        if (!reader || active >= 2)
          return reply
            .code(503)
            .header('retry-after', '2')
            .send({ code: 'ASSET_UNAVAILABLE', error: 'Artwork and release details are temporarily unavailable.' });
        active++;
        const controller = new AbortController();
        const abort = () => {
          if (!reply.raw.writableFinished) controller.abort();
        };
        request.raw.once('aborted', abort);
        reply.raw.once('close', abort);
        let released = false;
        const release = () => {
          if (!released) {
            released = true;
            active--;
          }
          reply.raw.off('finish', release);
          reply.raw.off('close', release);
        };
        try {
          const asset = await readPublicAsset(reader.read, cid, path, AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]));
          if (controller.signal.aborted || reply.raw.destroyed) {
            release();
            return reply;
          }
          reply.raw.once('finish', release);
          reply.raw.once('close', release);
          return reply.header('cache-control', 'public, max-age=86400, immutable').type(asset.mime).send(asset.bytes);
        } catch {
          release();
          if (controller.signal.aborted || reply.raw.destroyed) return reply;
          return reply.code(502).send({ code: 'ASSET_UNAVAILABLE', error: 'Artwork or release details could not be read.' });
        } finally {
          request.raw.off('aborted', abort);
          reply.raw.off('close', abort);
        }
      }
    );
  };
}
