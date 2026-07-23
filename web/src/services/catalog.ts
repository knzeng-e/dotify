const DEFAULT_API_URL = (import.meta.env.VITE_DOTIFY_API_URL as string | undefined)?.replace(/\/$/, '');
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CatalogApiState = 'fresh' | 'stale-cache' | 'indexer-outage' | 'rpc-outage' | 'empty';

export type CatalogApiMetadata = {
  state: CatalogApiState;
  cacheAvailable: boolean;
  indexedAt: string | null;
  lastIndexedBlock: number | null;
  chainHeadBlock: number | null;
  blockLag: number | null;
  staleAfterMs: number;
  lastErrorCode: 'CATALOG_INDEXER_UNAVAILABLE' | 'CHAIN_RPC_UNAVAILABLE' | null;
};

export type CatalogApiRelease = {
  id: string;
  hash: `0x${string}`;
  runtimeAddress: `0x${string}`;
  artistAddress: `0x${string}`;
  tokenId: string;
  title: string;
  artist: string;
  description: string;
  imageRef: string;
  coverVariants: string[];
  audioRef: string;
  metadataRef: string;
  bulletinRef: string;
  artistContractRef: string;
  accessMode: 'human-free' | 'classic' | 'free';
  priceWei: string;
  priceDot: string;
  personhoodLevel: 'DIM1' | 'DIM2';
  active: boolean;
  encrypted: boolean;
  royaltyBps: number;
  royaltySplits: Array<{
    label: string;
    recipient: `0x${string}`;
    bps: number;
  }>;
  registeredAtBlock: number;
  sourceBlock: number;
};

export type CatalogApiResponse = {
  items: CatalogApiRelease[];
  artists: Array<{
    artistAddress: `0x${string}`;
    runtimeAddress: `0x${string}`;
    name: string;
    releaseCount: number;
    activeReleaseCount: number;
    latestReleaseBlock: number;
  }>;
  pagination: {
    limit: number;
    nextCursor: string | null;
    total: number;
  };
  meta: CatalogApiMetadata;
};

type CachedCatalog = {
  version: typeof CACHE_VERSION;
  apiUrl: string;
  storedAt: number;
  etag: string | null;
  response: CatalogApiResponse;
};

export class CatalogApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CatalogApiError';
    this.code = code;
  }
}

export function isCatalogApiConfigured(): boolean {
  return Boolean(DEFAULT_API_URL);
}

export function readCachedCatalog(options: { apiUrl?: string; storage?: Storage | null } = {}): CatalogApiResponse | null {
  return readCache(options.apiUrl ?? DEFAULT_API_URL, true, 100, resolveStorage(options.storage))?.response ?? null;
}

export async function fetchCatalog(
  options: {
    includeInactive?: boolean;
    limit?: number;
    apiUrl?: string;
    storage?: Storage | null;
  } = {}
): Promise<CatalogApiResponse> {
  const apiUrl = (options.apiUrl ?? DEFAULT_API_URL)?.replace(/\/$/, '');
  if (!apiUrl) throw new CatalogApiError('Catalog API is not configured', 'CATALOG_API_NOT_CONFIGURED');

  const includeInactive = options.includeInactive === true;
  const limit = options.limit ?? 100;
  const storage = resolveStorage(options.storage);
  const cached = readCache(apiUrl, includeInactive, limit, storage);
  const query = new URLSearchParams({
    limit: String(limit),
    includeInactive: String(includeInactive)
  });
  const headers = new Headers();
  if (cached?.etag) headers.set('If-None-Match', cached.etag);

  const response = await fetch(`${apiUrl}/api/catalog?${query}`, { headers });
  if (response.status === 304 && cached) return cached.response;

  const body = await parseResponseBody(response);
  if (!isCatalogResponse(body)) {
    throw new CatalogApiError(`Catalog request failed (${response.status})`, 'INVALID_CATALOG_RESPONSE');
  }
  if (!response.ok && response.status !== 503) {
    throw new CatalogApiError(`Catalog request failed (${response.status})`, 'CATALOG_REQUEST_FAILED');
  }

  if (response.ok && body.meta.cacheAvailable) {
    writeCache(apiUrl, includeInactive, limit, response.headers.get('etag'), body, storage);
  }
  return body;
}

function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cacheKey(apiUrl: string, includeInactive: boolean, limit: number): string {
  return `dotify:catalog:v${CACHE_VERSION}:${apiUrl}:${includeInactive ? 'all' : 'active'}:${limit}`;
}

function readCache(apiUrl: string | undefined, includeInactive: boolean, limit: number, storage: Storage | null): CachedCatalog | null {
  if (!apiUrl || !storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(cacheKey(apiUrl, includeInactive, limit)) ?? 'null') as CachedCatalog | null;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      parsed.apiUrl !== apiUrl ||
      Date.now() - parsed.storedAt > CACHE_MAX_AGE_MS ||
      !isCatalogResponse(parsed.response)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(apiUrl: string, includeInactive: boolean, limit: number, etag: string | null, response: CatalogApiResponse, storage: Storage | null): void {
  if (!storage) return;
  try {
    const cached: CachedCatalog = {
      version: CACHE_VERSION,
      apiUrl,
      storedAt: Date.now(),
      etag,
      response
    };
    storage.setItem(cacheKey(apiUrl, includeInactive, limit), JSON.stringify(cached));
  } catch {
    // The network response still succeeds when browser storage is unavailable.
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isCatalogResponse(value: unknown): value is CatalogApiResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CatalogApiResponse>;
  const states: CatalogApiState[] = ['fresh', 'stale-cache', 'indexer-outage', 'rpc-outage', 'empty'];
  return (
    Array.isArray(candidate.items) &&
    Array.isArray(candidate.artists) &&
    Boolean(candidate.pagination && typeof candidate.pagination.total === 'number') &&
    Boolean(candidate.meta && states.includes(candidate.meta.state as CatalogApiState))
  );
}
