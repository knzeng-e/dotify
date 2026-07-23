import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createCatalogRoutes } from './catalog.js';
import type { CatalogReadModel } from '../services/catalog/readModel.js';
import type { CatalogMetadata, CatalogRelease, CatalogSnapshot } from '../services/catalog/types.js';

const ARTIST = '0x1111111111111111111111111111111111111111';
const RUNTIME = '0x2222222222222222222222222222222222222222';
const HASH_A = `0x${'33'.repeat(32)}`;
const HASH_B = `0x${'44'.repeat(32)}`;

function release(hash: string, overrides: Partial<CatalogRelease> = {}): CatalogRelease {
  return {
    id: `${RUNTIME}:${hash}`,
    hash,
    runtimeAddress: RUNTIME,
    artistAddress: ARTIST,
    tokenId: '1',
    title: 'Catalog release',
    artist: 'Dotify Artist',
    description: 'Description',
    imageRef: 'ipfs://cover',
    coverVariants: ['ipfs://cover'],
    audioRef: 'ipfs://audio',
    metadataRef: 'ipfs://metadata',
    bulletinRef: '',
    artistContractRef: 'ipfs://contract',
    accessMode: 'free',
    priceWei: '0',
    priceDot: '0',
    personhoodLevel: 'DIM1',
    active: true,
    encrypted: false,
    royaltyBps: 10_000,
    royaltySplits: [{ label: 'Primary recipient', recipient: ARTIST, bps: 10_000 }],
    registeredAtBlock: 9,
    sourceBlock: 9,
    ...overrides
  } as CatalogRelease;
}

function snapshot(): CatalogSnapshot {
  return {
    schemaVersion: 1,
    chainId: 420420417,
    directoryAddress: ARTIST,
    lastIndexedBlock: 100,
    lastIndexedBlockHash: `0x${'55'.repeat(32)}`,
    chainHeadBlock: 102,
    indexedAt: '2026-07-23T12:00:00.000Z',
    reconciledAt: '2026-07-23T12:00:00.000Z',
    artists: [
      {
        artistAddress: ARTIST,
        runtimeAddress: RUNTIME,
        name: 'Dotify Artist',
        releaseCount: 2,
        activeReleaseCount: 1,
        latestReleaseBlock: 9
      }
    ],
    releases: [release(HASH_A), release(HASH_B, { id: `${RUNTIME}:${HASH_B}`, active: false, registeredAtBlock: 8 })]
  } as CatalogSnapshot;
}

function metadata(overrides: Partial<CatalogMetadata> = {}): CatalogMetadata {
  return {
    state: 'fresh',
    cacheAvailable: true,
    indexedAt: '2026-07-23T12:00:00.000Z',
    lastIndexedBlock: 100,
    chainHeadBlock: 102,
    blockLag: 2,
    staleAfterMs: 60_000,
    lastErrorCode: null,
    ...overrides
  };
}

let app: FastifyInstance | null = null;

async function build(options: { snapshot: CatalogSnapshot | null; meta?: CatalogMetadata }): Promise<FastifyInstance> {
  const catalog = {
    getSnapshot: () => options.snapshot,
    getMetadata: () => options.meta ?? metadata(),
    getRevision: () => 'revision-1'
  } as CatalogReadModel;
  app = Fastify();
  await app.register(createCatalogRoutes({ catalog }));
  return app;
}

afterEach(async () => {
  if (app) await app.close();
  app = null;
});

describe('GET /api/catalog', () => {
  it('returns a cacheable active-release page with lag metadata', async () => {
    const server = await build({ snapshot: snapshot() });
    const response = await server.inject({ method: 'GET', url: '/api/catalog?limit=1' });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'public, max-age=30, stale-while-revalidate=120');
    assert.equal(response.headers['x-catalog-block-lag'], '2');
    assert.equal(response.headers.etag, 'W/"revision-1"');
    const body = response.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].hash, HASH_A);
    assert.equal(body.pagination.nextCursor, null);
    assert.equal(body.pagination.total, 1);
    assert.equal(body.meta.state, 'fresh');
  });

  it('paginates inactive-inclusive catalog results with a revision-bound cursor', async () => {
    const server = await build({ snapshot: snapshot() });
    const first = await server.inject({
      method: 'GET',
      url: '/api/catalog?includeInactive=true&limit=1'
    });
    const firstBody = first.json();
    assert.equal(typeof firstBody.pagination.nextCursor, 'string');

    const second = await server.inject({
      method: 'GET',
      url: `/api/catalog?includeInactive=true&limit=1&cursor=${encodeURIComponent(firstBody.pagination.nextCursor)}`
    });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().items[0].hash, HASH_B);
  });

  it('answers 304 when the caller already has the current catalog revision', async () => {
    const server = await build({ snapshot: snapshot() });
    const response = await server.inject({
      method: 'GET',
      url: '/api/catalog',
      headers: { 'if-none-match': 'W/"revision-1"' }
    });
    assert.equal(response.statusCode, 304);
    assert.equal(response.body, '');
  });

  it('distinguishes an RPC outage when no cache is available', async () => {
    const server = await build({
      snapshot: null,
      meta: metadata({
        state: 'rpc-outage',
        cacheAvailable: false,
        indexedAt: null,
        lastIndexedBlock: null,
        chainHeadBlock: null,
        blockLag: null,
        lastErrorCode: 'CHAIN_RPC_UNAVAILABLE'
      })
    });
    const response = await server.inject({ method: 'GET', url: '/api/catalog' });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().meta.state, 'rpc-outage');
    assert.deepEqual(response.json().items, []);
  });
});

describe('catalog detail endpoints', () => {
  it('returns artist releases and release details', async () => {
    const server = await build({ snapshot: snapshot() });

    const artist = await server.inject({
      method: 'GET',
      url: `/api/catalog/artists/${ARTIST}`
    });
    assert.equal(artist.statusCode, 200);
    assert.equal(artist.json().releases.length, 2);

    const releaseResponse = await server.inject({
      method: 'GET',
      url: `/api/catalog/releases/${HASH_A}`
    });
    assert.equal(releaseResponse.statusCode, 200);
    assert.equal(releaseResponse.json().release.runtimeAddress, RUNTIME);
  });
});
