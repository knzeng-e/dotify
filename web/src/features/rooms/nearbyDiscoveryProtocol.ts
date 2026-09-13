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
export type NearbyCountBucket = '0' | '1-3' | '4-9' | '10+';
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
const AREA_SCALES = new Set<NearbyAreaScale>(['standard', 'expanded']);
const DISCOVERY_MODES = new Set<NearbyDiscoveryMode>(['browser-geolocation', 'manual-area', 'venue-qr']);
const HOST_SURFACES = new Set<NearbyHostSurface>(['standalone-browser', 'product-desktop', 'product-web-gateway', 'product-ios-external-browser']);
const COUNT_BUCKETS = new Set<NearbyCountBucket>(['0', '1-3', '4-9', '10+']);
const PLAYBACK_MODES = new Set<NonNullable<NearbyHostPresence['nowPlaying']>['playbackMode']>(['full', 'preview']);

type ObjectShape = Record<string, unknown>;
type ProtocolIssue = Extract<NearbyProtocolSafety, { ok: false }>;
type ExactKeysResult = { ok: true; value: ObjectShape } | { ok: false; issue: ProtocolIssue };

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
  if (count < NEARBY_DISCOVERY_TUNABLES.minimumUsefulDensity) return '1-3';
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

function isObjectShape(value: unknown): value is ObjectShape {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function protocolIssue(path: string, reason: string): ProtocolIssue {
  return { ok: false, path, reason };
}

function childPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function assertExactKeys(value: unknown, path: string, requiredKeys: readonly string[], optionalKeys: readonly string[] = []): ExactKeysResult {
  if (!isObjectShape(value)) {
    return { ok: false, issue: protocolIssue(path, 'Nearby discovery protocol values must be JSON objects.') };
  }

  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        issue: protocolIssue(childPath(path, key), 'Nearby discovery payloads reject fields outside the allowlisted protocol schema.')
      };
    }
  }

  for (const key of requiredKeys) {
    if (!(key in value)) {
      return { ok: false, issue: protocolIssue(childPath(path, key), 'Nearby discovery payload is missing a required protocol field.') };
    }
  }

  return { ok: true, value };
}

function assertStringField(value: ObjectShape, key: string, path: string): NearbyProtocolSafety | null {
  return typeof value[key] === 'string' && value[key].trim().length > 0
    ? null
    : protocolIssue(childPath(path, key), 'Nearby discovery protocol field must be a non-empty string.');
}

function assertNumberField(value: ObjectShape, key: string, path: string): NearbyProtocolSafety | null {
  return typeof value[key] === 'number' && Number.isFinite(value[key])
    ? null
    : protocolIssue(childPath(path, key), 'Nearby discovery protocol field must be a finite number.');
}

function assertMaxResultsField(value: ObjectShape, path: string): NearbyProtocolSafety | null {
  const numberIssue = assertNumberField(value, 'maxResults', path);
  if (numberIssue) return numberIssue;

  const maxResults = value.maxResults;
  return typeof maxResults === 'number' && maxResults >= 1 && maxResults <= NEARBY_DISCOVERY_TUNABLES.maxResults
    ? null
    : protocolIssue(childPath(path, 'maxResults'), 'Nearby discovery search requests must respect the configured max-results bound.');
}

function assertLiteralField<T extends string | number | boolean>(
  value: ObjectShape,
  key: string,
  expected: T,
  path: string,
  reason = 'Nearby discovery protocol field has an unexpected value.'
): NearbyProtocolSafety | null {
  return value[key] === expected ? null : protocolIssue(childPath(path, key), reason);
}

function assertEnumField<T extends string>(
  value: ObjectShape,
  key: string,
  allowed: ReadonlySet<T>,
  path: string,
  reason = 'Nearby discovery protocol field is outside the allowlisted values.'
): NearbyProtocolSafety | null {
  return typeof value[key] === 'string' && allowed.has(value[key] as T) ? null : protocolIssue(childPath(path, key), reason);
}

function assertAreaCellField(value: ObjectShape, key: string, path: string): NearbyProtocolSafety | null {
  return typeof value[key] === 'string' && parseNearbyAreaCell(value[key]) !== null
    ? null
    : protocolIssue(childPath(path, key), 'Nearby discovery area cells must use the coarse dotify-nearby-v1 cell format.');
}

function assertStringArray(value: ObjectShape, key: string, path: string, itemValidator: (item: string) => boolean): NearbyProtocolSafety | null {
  const child = value[key];
  if (!Array.isArray(child) || child.length === 0) {
    return protocolIssue(childPath(path, key), 'Nearby discovery protocol field must be a non-empty array.');
  }

  for (let index = 0; index < child.length; index += 1) {
    const item = child[index];
    if (typeof item !== 'string' || !itemValidator(item)) {
      return protocolIssue(`${childPath(path, key)}.${index}`, 'Nearby discovery protocol array item is outside the allowlisted schema.');
    }
  }
  return null;
}

function assertObjectArray(
  value: ObjectShape,
  key: string,
  path: string,
  itemValidator: (item: unknown, itemPath: string) => NearbyProtocolSafety | null
): NearbyProtocolSafety | null {
  const child = value[key];
  if (!Array.isArray(child)) {
    return protocolIssue(childPath(path, key), 'Nearby discovery protocol field must be an array.');
  }

  for (let index = 0; index < child.length; index += 1) {
    const issue = itemValidator(child[index], `${childPath(path, key)}.${index}`);
    if (issue) return issue;
  }
  return null;
}

function validateCapabilities(value: unknown, path: string): NearbyProtocolSafety | null {
  const shape = assertExactKeys(value, path, ['walletlessJoin', 'sourceKeysExposed', 'exactLocationShared']);
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return (
    assertLiteralField(object, 'walletlessJoin', true, path, 'Nearby discovery must keep walletless joining enabled.') ??
    assertLiteralField(object, 'sourceKeysExposed', false, path, 'Nearby discovery must not expose source keys.') ??
    assertLiteralField(object, 'exactLocationShared', false, path, 'Nearby discovery must not share exact location.')
  );
}

function validateNowPlaying(value: unknown, path: string): NearbyProtocolSafety | null {
  const shape = assertExactKeys(value, path, ['title', 'artist', 'playbackMode']);
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return assertStringField(object, 'title', path) ?? assertStringField(object, 'artist', path) ?? assertEnumField(object, 'playbackMode', PLAYBACK_MODES, path);
}

function validateHostPresence(value: unknown, path = ''): NearbyProtocolSafety | null {
  const shape = assertExactKeys(
    value,
    path,
    ['schemaVersion', 'roomId', 'discoveryId', 'areaCell', 'areaScale', 'hostSurface', 'canonicalRoomUrl', 'expiresAt', 'listenerCountBucket', 'capabilities'],
    ['nowPlaying']
  );
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return (
    assertLiteralField(object, 'schemaVersion', NEARBY_DISCOVERY_SCHEMA_VERSION, path) ??
    assertStringField(object, 'roomId', path) ??
    assertStringField(object, 'discoveryId', path) ??
    assertAreaCellField(object, 'areaCell', path) ??
    assertEnumField(object, 'areaScale', AREA_SCALES, path) ??
    assertEnumField(object, 'hostSurface', HOST_SURFACES, path) ??
    assertStringField(object, 'canonicalRoomUrl', path) ??
    assertStringField(object, 'expiresAt', path) ??
    assertEnumField(object, 'listenerCountBucket', COUNT_BUCKETS, path) ??
    validateCapabilities(object.capabilities, childPath(path, 'capabilities')) ??
    ('nowPlaying' in object ? validateNowPlaying(object.nowPlaying, childPath(path, 'nowPlaying')) : null)
  );
}

function validateSearchRequest(value: unknown, path = ''): NearbyProtocolSafety | null {
  const shape = assertExactKeys(value, path, ['schemaVersion', 'mode', 'listenerDiscoveryId', 'areaCells', 'requestedAt', 'maxResults'], ['manualAreaLabel']);
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return (
    assertLiteralField(object, 'schemaVersion', NEARBY_DISCOVERY_SCHEMA_VERSION, path) ??
    assertEnumField(object, 'mode', DISCOVERY_MODES, path) ??
    assertStringField(object, 'listenerDiscoveryId', path) ??
    assertStringArray(object, 'areaCells', path, item => parseNearbyAreaCell(item) !== null) ??
    assertStringField(object, 'requestedAt', path) ??
    assertMaxResultsField(object, path) ??
    ('manualAreaLabel' in object ? assertStringField(object, 'manualAreaLabel', path) : null)
  );
}

function validateDensity(value: unknown, path: string): NearbyProtocolSafety | null {
  const shape = assertExactKeys(value, path, ['resultBucket', 'exactCountSuppressed']);
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return (
    assertEnumField(object, 'resultBucket', COUNT_BUCKETS, path) ??
    assertLiteralField(object, 'exactCountSuppressed', true, path, 'Nearby discovery must suppress exact counts.')
  );
}

function validateSearchResponse(value: unknown, path = ''): NearbyProtocolSafety | null {
  const shape = assertExactKeys(value, path, ['schemaVersion', 'areaScale', 'expiresAt', 'density', 'results']);
  if (!shape.ok) return shape.issue;
  const object = shape.value;

  return (
    assertLiteralField(object, 'schemaVersion', NEARBY_DISCOVERY_SCHEMA_VERSION, path) ??
    assertEnumField(object, 'areaScale', AREA_SCALES, path) ??
    assertStringField(object, 'expiresAt', path) ??
    validateDensity(object.density, childPath(path, 'density')) ??
    assertObjectArray(object, 'results', path, validateHostPresence)
  );
}

function validateNearbyProtocolSchema(value: unknown): NearbyProtocolSafety | null {
  if (!isObjectShape(value)) {
    return protocolIssue('', 'Nearby discovery payloads must match an allowlisted protocol object.');
  }

  if ('roomId' in value && 'discoveryId' in value && 'areaCell' in value) {
    return validateHostPresence(value);
  }
  if ('mode' in value && 'areaCells' in value && 'listenerDiscoveryId' in value) {
    return validateSearchRequest(value);
  }
  if ('density' in value && 'results' in value) {
    return validateSearchResponse(value);
  }

  return protocolIssue('', 'Nearby discovery payloads must match one of the allowlisted host, request, or response schemas.');
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
  return validateNearbyProtocolSchema(value) ?? { ok: true };
}
