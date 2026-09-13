// W18 nearby discovery protocol proposal.
//
// This module is deliberately inert: nothing imports it from runtime UI yet.
// It records the protocol shape and privacy checks W19 must satisfy before any
// real location collection or endpoint exists.

export const NEARBY_DISCOVERY_SCHEMA_VERSION = 1;

export const NEARBY_DISCOVERY_TUNABLES = {
  standardCellMeters: 1_800,
  expandedCellMeters: 7_200,
  neighborRing: 1,
  hostTtlSeconds: 90,
  hostRefreshSeconds: 30,
  expiryGraceSeconds: 30,
  discoveryIdRotationSeconds: 15 * 60,
  queryRateLimit: { limit: 6, windowSeconds: 60 },
  minimumUsefulDensity: 4,
  maxResults: 20
} as const;

export type NearbyAreaScale = 'standard' | 'expanded';
export type NearbyDiscoveryMode = 'browser-geolocation' | 'manual-area' | 'venue-qr';
export type NearbyHostSurface = 'standalone-browser' | 'product-desktop' | 'product-web-gateway' | 'product-ios-external-browser';
export type NearbyCountBucket = '0' | '1' | '2-3' | '4-9' | '10+';
export type NearbyAreaCell = `dotify-nearby-v1:${number}:${number}:${number}`;

export type NearbyHostPresence = {
  schemaVersion: typeof NEARBY_DISCOVERY_SCHEMA_VERSION;
  roomId: string;
  discoveryId: string;
  areaCell: NearbyAreaCell;
  areaScale: NearbyAreaScale;
  hostSurface: NearbyHostSurface;
  canonicalRoomUrl: string;
  expiresAt: string;
  listenerCountBucket: NearbyCountBucket;
  capabilities: {
    walletlessJoin: true;
    sourceKeysExposed: false;
    exactLocationShared: false;
  };
  nowPlaying?: {
    title: string;
    artist: string;
    playbackMode: 'full' | 'preview';
  };
};

export type NearbySearchRequest = {
  schemaVersion: typeof NEARBY_DISCOVERY_SCHEMA_VERSION;
  mode: NearbyDiscoveryMode;
  listenerDiscoveryId: string;
  areaCells: NearbyAreaCell[];
  requestedAt: string;
  maxResults: number;
  manualAreaLabel?: string;
};

export type NearbySearchResponse = {
  schemaVersion: typeof NEARBY_DISCOVERY_SCHEMA_VERSION;
  areaScale: NearbyAreaScale;
  expiresAt: string;
  density: {
    resultBucket: NearbyCountBucket;
    exactCountSuppressed: true;
  };
  results: NearbyHostPresence[];
};

export type NearbyCellParts = {
  cellMeters: number;
  x: number;
  y: number;
};

export type NearbyProtocolSafety = { ok: true } | { ok: false; path: string; reason: string };

export const FORBIDDEN_NEARBY_DISCOVERY_FIELDS = [
  'lat',
  'latitude',
  'latitudeDegrees',
  'lon',
  'lng',
  'longitude',
  'longitudeDegrees',
  'coordinates',
  'coordinate',
  'geohash',
  'distanceMeters',
  'exactDistanceMeters',
  'walletAddress',
  'evmAddress',
  'ss58Address',
  'ipAddress'
] as const;

const FORBIDDEN_KEYS = new Set(FORBIDDEN_NEARBY_DISCOVERY_FIELDS.map(key => key.toLowerCase()));

export function nearbyAreaCell(cellMeters: number, x: number, y: number): NearbyAreaCell {
  return `dotify-nearby-v1:${Math.trunc(cellMeters)}:${Math.trunc(x)}:${Math.trunc(y)}` as NearbyAreaCell;
}

export function parseNearbyAreaCell(value: string): NearbyCellParts | null {
  const match = /^dotify-nearby-v1:(\d+):(-?\d+):(-?\d+)$/.exec(value);
  if (!match) return null;

  const [, cellMetersText, xText, yText] = match;
  const cellMeters = Number.parseInt(cellMetersText, 10);
  const x = Number.parseInt(xText, 10);
  const y = Number.parseInt(yText, 10);
  if (![cellMeters, x, y].every(Number.isFinite)) return null;
  if (cellMeters !== NEARBY_DISCOVERY_TUNABLES.standardCellMeters && cellMeters !== NEARBY_DISCOVERY_TUNABLES.expandedCellMeters) return null;

  return { cellMeters, x, y };
}

export function nearbyCountBucket(count: number): NearbyCountBucket {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 3) return '2-3';
  if (count <= 9) return '4-9';
  return '10+';
}

export function shouldExpandNearbyArea(resultCount: number): boolean {
  return resultCount < NEARBY_DISCOVERY_TUNABLES.minimumUsefulDensity;
}

export function nearbyNeighborCells(center: NearbyAreaCell, ring = NEARBY_DISCOVERY_TUNABLES.neighborRing): NearbyAreaCell[] {
  const parsed = parseNearbyAreaCell(center);
  if (!parsed) return [];

  const boundedRing = Math.max(0, Math.min(2, Math.trunc(ring)));
  const cells: NearbyAreaCell[] = [];
  for (let dx = -boundedRing; dx <= boundedRing; dx += 1) {
    for (let dy = -boundedRing; dy <= boundedRing; dy += 1) {
      cells.push(nearbyAreaCell(parsed.cellMeters, parsed.x + dx, parsed.y + dy));
    }
  }
  return cells;
}

export function expandedAreaCellForSparseStandardCell(center: NearbyAreaCell): NearbyAreaCell | null {
  const parsed = parseNearbyAreaCell(center);
  if (!parsed) return null;
  const factor = NEARBY_DISCOVERY_TUNABLES.expandedCellMeters / parsed.cellMeters;
  return nearbyAreaCell(NEARBY_DISCOVERY_TUNABLES.expandedCellMeters, Math.floor(parsed.x / factor), Math.floor(parsed.y / factor));
}

export function nearbyVisualSeed(roomId: string, discoveryId: string): string {
  return `dotify-nearby-visual-v1:${roomId.trim().toUpperCase()}:${discoveryId.trim()}`;
}

export function findForbiddenNearbyField(value: unknown, path: string[] = []): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return nextPath.join('.');
    const nested = findForbiddenNearbyField(child, nextPath);
    if (nested) return nested;
  }
  return null;
}

export function assertNearbyProtocolSafe(value: unknown): NearbyProtocolSafety {
  const path = findForbiddenNearbyField(value);
  if (path) {
    return {
      ok: false,
      path,
      reason: 'Nearby discovery payloads must not contain exact coordinates, distances, IP addresses, or wallet identifiers.'
    };
  }
  return { ok: true };
}
