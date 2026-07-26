import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CatalogReadModel } from '../services/catalog/readModel.js';
import type { ApiErrorBody } from '../app.js';

const CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true')
});
const artistParamsSchema = z.object({
  artistAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
});
const releaseParamsSchema = z.object({
  contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
});

type Cursor = { revision: string; offset: number };

export type CatalogRouteDeps = {
  catalog: CatalogReadModel;
};

export function createCatalogRoutes(deps: CatalogRouteDeps) {
  return async function catalogRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/catalog', async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendError(request, reply, 400, 'Invalid catalog query', 'INVALID_CATALOG_QUERY');
      }

      const snapshot = deps.catalog.getSnapshot();
      const meta = deps.catalog.getMetadata();
      const revision = deps.catalog.getRevision();
      const etag = catalogEtag(revision);
      setCatalogHeaders(reply, etag, meta.state, meta.blockLag);

      if (request.headers['if-none-match'] === etag && snapshot) {
        return reply.status(304).send();
      }

      if (!snapshot) {
        return reply.status(503).send({
          items: [],
          artists: [],
          pagination: { limit: parsed.data.limit, nextCursor: null, total: 0 },
          meta
        });
      }

      let offset = 0;
      if (parsed.data.cursor) {
        const cursor = decodeCursor(parsed.data.cursor);
        if (!cursor) {
          return sendError(request, reply, 400, 'Invalid catalog cursor', 'INVALID_CATALOG_CURSOR');
        }
        if (cursor.revision !== revision) {
          return sendError(request, reply, 409, 'Catalog changed; restart pagination', 'STALE_CATALOG_CURSOR');
        }
        offset = cursor.offset;
      }

      const releases = parsed.data.includeInactive ? snapshot.releases : snapshot.releases.filter(release => release.active);
      const items = releases.slice(offset, offset + parsed.data.limit);
      const nextOffset = offset + items.length;
      const nextCursor = nextOffset < releases.length ? encodeCursor({ revision, offset: nextOffset }) : null;

      return reply.send({
        items,
        artists: snapshot.artists,
        pagination: {
          limit: parsed.data.limit,
          nextCursor,
          total: releases.length
        },
        meta
      });
    });

    app.get('/api/catalog/artists/:artistAddress', async (request, reply) => {
      const parsed = artistParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendError(request, reply, 400, 'Invalid artist address', 'INVALID_ARTIST_ADDRESS');
      }

      const snapshot = deps.catalog.getSnapshot();
      const meta = deps.catalog.getMetadata();
      const etag = catalogEtag(deps.catalog.getRevision());
      setCatalogHeaders(reply, etag, meta.state, meta.blockLag);
      if (request.headers['if-none-match'] === etag && snapshot) return reply.status(304).send();
      if (!snapshot) {
        return sendError(request, reply, 503, 'Catalog is temporarily unavailable', meta.lastErrorCode ?? 'CATALOG_UNAVAILABLE');
      }

      const normalizedAddress = parsed.data.artistAddress.toLowerCase();
      const artist = snapshot.artists.find(candidate => candidate.artistAddress.toLowerCase() === normalizedAddress);
      if (!artist) return sendError(request, reply, 404, 'Artist not found', 'ARTIST_NOT_FOUND');

      const releases = snapshot.releases.filter(release => release.runtimeAddress.toLowerCase() === artist.runtimeAddress.toLowerCase());
      return reply.send({ artist, releases, meta });
    });

    app.get('/api/catalog/releases/:contentHash', async (request, reply) => {
      const parsed = releaseParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendError(request, reply, 400, 'Invalid release hash', 'INVALID_RELEASE_HASH');
      }

      const snapshot = deps.catalog.getSnapshot();
      const meta = deps.catalog.getMetadata();
      const etag = catalogEtag(deps.catalog.getRevision());
      setCatalogHeaders(reply, etag, meta.state, meta.blockLag);
      if (request.headers['if-none-match'] === etag && snapshot) return reply.status(304).send();
      if (!snapshot) {
        return sendError(request, reply, 503, 'Catalog is temporarily unavailable', meta.lastErrorCode ?? 'CATALOG_UNAVAILABLE');
      }

      const normalizedHash = parsed.data.contentHash.toLowerCase();
      const matches = snapshot.releases.filter(candidate => candidate.hash.toLowerCase() === normalizedHash);
      if (matches.length === 0) return sendError(request, reply, 404, 'Release not found', 'RELEASE_NOT_FOUND');
      if (matches.length > 1) {
        return sendError(request, reply, 409, 'Release hash is claimed by multiple runtimes', 'AMBIGUOUS_RELEASE');
      }
      return reply.send({ release: matches[0], meta });
    });
  };
}

function catalogEtag(revision: string): string {
  return `W/"${revision}"`;
}

function setCatalogHeaders(reply: FastifyReply, etag: string, state: string, blockLag: number | null): void {
  reply.header('cache-control', CACHE_CONTROL);
  reply.header('etag', etag);
  reply.header('x-catalog-state', state);
  if (blockLag !== null) reply.header('x-catalog-block-lag', String(blockLag));
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof parsed.revision !== 'string' || typeof parsed.offset !== 'number' || !Number.isInteger(parsed.offset) || parsed.offset < 0) {
      return null;
    }
    return { revision: parsed.revision, offset: parsed.offset };
  } catch {
    return null;
  }
}

function sendError(request: FastifyRequest, reply: FastifyReply, status: number, error: string, code: string) {
  const body: ApiErrorBody = { error, code, requestId: String(request.id) };
  return reply.status(status).send(body);
}
