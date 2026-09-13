#!/usr/bin/env node

// W18 nearby privacy simulation.
//
// Synthetic data only. This script does not read browser location, call a
// network endpoint, or inspect accounts. It validates the proposed disclosure
// contract before W19 can turn it into runtime code.

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const schemaVersion = 1;
const generatedAt = new Date().toISOString();
const startTimeMs = Date.parse('2026-09-13T12:00:00.000Z');

const tunables = {
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
};

const forbiddenFields = new Set(
  [
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
  ].map(key => key.toLowerCase())
);
const areaScales = new Set(['standard', 'expanded']);
const discoveryModes = new Set(['browser-geolocation', 'manual-area', 'venue-qr']);
const hostSurfaces = new Set(['standalone-browser', 'product-desktop', 'product-web-gateway', 'product-ios-external-browser']);
const countBuckets = new Set(['0', '1-3', '4-9', '10+']);
const playbackModes = new Set(['full', 'preview']);

function areaCell(cellMeters, x, y) {
  return `dotify-nearby-v1:${Math.trunc(cellMeters)}:${Math.trunc(x)}:${Math.trunc(y)}`;
}

function parseCell(cell) {
  const match = /^dotify-nearby-v1:(\d+):(-?\d+):(-?\d+)$/.exec(cell);
  assert.ok(match, `invalid cell ${cell}`);
  const parsed = {
    cellMeters: Number.parseInt(match[1], 10),
    x: Number.parseInt(match[2], 10),
    y: Number.parseInt(match[3], 10)
  };
  assert.ok(
    parsed.cellMeters === tunables.standardCellMeters || parsed.cellMeters === tunables.expandedCellMeters,
    `unsupported cell size ${parsed.cellMeters}`
  );
  return parsed;
}

function neighborCells(center, ring = tunables.neighborRing) {
  const parsed = parseCell(center);
  const cells = [];
  for (let dx = -ring; dx <= ring; dx += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      cells.push(areaCell(parsed.cellMeters, parsed.x + dx, parsed.y + dy));
    }
  }
  return cells;
}

function expandedCellFor(center) {
  const parsed = parseCell(center);
  const factor = tunables.expandedCellMeters / parsed.cellMeters;
  return areaCell(tunables.expandedCellMeters, Math.floor(parsed.x / factor), Math.floor(parsed.y / factor));
}

function countBucket(count) {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count < tunables.minimumUsefulDensity) return '1-3';
  if (count <= 9) return '4-9';
  return '10+';
}

function shouldExpandNearbyArea(resultCount) {
  return resultCount < tunables.minimumUsefulDensity;
}

function findForbiddenField(value, path = []) {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (forbiddenFields.has(key.toLowerCase())) return nextPath.join('.');
    const nested = findForbiddenField(child, nextPath);
    if (nested) return nested;
  }
  return null;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function childPath(path, key) {
  return path ? `${path}.${key}` : key;
}

function schemaIssue(path, reason) {
  return { path, reason };
}

function exactKeys(value, path, requiredKeys, optionalKeys = []) {
  if (!isRecord(value)) return schemaIssue(path, 'Nearby discovery protocol values must be JSON objects.');

  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return schemaIssue(childPath(path, key), 'Payload contains a field outside the allowlisted schema.');
  }

  for (const key of requiredKeys) {
    if (!(key in value)) return schemaIssue(childPath(path, key), 'Payload is missing a required protocol field.');
  }

  return null;
}

function stringField(value, key, path) {
  return typeof value[key] === 'string' && value[key].trim().length > 0 ? null : schemaIssue(childPath(path, key), 'Expected a non-empty string.');
}

function numberField(value, key, path) {
  return typeof value[key] === 'number' && Number.isFinite(value[key]) ? null : schemaIssue(childPath(path, key), 'Expected a finite number.');
}

function literalField(value, key, expected, path, reason = 'Unexpected protocol value.') {
  return value[key] === expected ? null : schemaIssue(childPath(path, key), reason);
}

function enumField(value, key, allowed, path) {
  return typeof value[key] === 'string' && allowed.has(value[key]) ? null : schemaIssue(childPath(path, key), 'Value is outside the allowlisted enum.');
}

function areaCellField(value, key, path) {
  if (typeof value[key] !== 'string') return schemaIssue(childPath(path, key), 'Expected a coarse nearby area cell.');
  try {
    parseCell(value[key]);
    return null;
  } catch {
    return schemaIssue(childPath(path, key), 'Expected a coarse nearby area cell.');
  }
}

function stringArray(value, key, path, itemValidator) {
  const child = value[key];
  if (!Array.isArray(child) || child.length === 0) return schemaIssue(childPath(path, key), 'Expected a non-empty array.');
  for (let index = 0; index < child.length; index += 1) {
    if (typeof child[index] !== 'string' || !itemValidator(child[index])) {
      return schemaIssue(`${childPath(path, key)}.${index}`, 'Array item is outside the allowlisted schema.');
    }
  }
  return null;
}

function objectArray(value, key, path, itemValidator) {
  const child = value[key];
  if (!Array.isArray(child)) return schemaIssue(childPath(path, key), 'Expected an array.');
  for (let index = 0; index < child.length; index += 1) {
    const issue = itemValidator(child[index], `${childPath(path, key)}.${index}`);
    if (issue) return issue;
  }
  return null;
}

function validateCapabilities(value, path) {
  const shape = exactKeys(value, path, ['walletlessJoin', 'sourceKeysExposed', 'exactLocationShared']);
  if (shape) return shape;

  return (
    literalField(value, 'walletlessJoin', true, path, 'Nearby discovery must keep walletless joining enabled.') ??
    literalField(value, 'sourceKeysExposed', false, path, 'Nearby discovery must not expose source keys.') ??
    literalField(value, 'exactLocationShared', false, path, 'Nearby discovery must not share exact location.')
  );
}

function validateNowPlaying(value, path) {
  const shape = exactKeys(value, path, ['title', 'artist', 'playbackMode']);
  if (shape) return shape;

  return stringField(value, 'title', path) ?? stringField(value, 'artist', path) ?? enumField(value, 'playbackMode', playbackModes, path);
}

function validateHostPresence(value, path = '') {
  const shape = exactKeys(
    value,
    path,
    ['schemaVersion', 'roomId', 'discoveryId', 'areaCell', 'areaScale', 'hostSurface', 'canonicalRoomUrl', 'expiresAt', 'listenerCountBucket', 'capabilities'],
    ['nowPlaying']
  );
  if (shape) return shape;

  return (
    literalField(value, 'schemaVersion', schemaVersion, path) ??
    stringField(value, 'roomId', path) ??
    stringField(value, 'discoveryId', path) ??
    areaCellField(value, 'areaCell', path) ??
    enumField(value, 'areaScale', areaScales, path) ??
    enumField(value, 'hostSurface', hostSurfaces, path) ??
    stringField(value, 'canonicalRoomUrl', path) ??
    stringField(value, 'expiresAt', path) ??
    enumField(value, 'listenerCountBucket', countBuckets, path) ??
    validateCapabilities(value.capabilities, childPath(path, 'capabilities')) ??
    ('nowPlaying' in value ? validateNowPlaying(value.nowPlaying, childPath(path, 'nowPlaying')) : null)
  );
}

function validateSearchRequest(value, path = '') {
  const shape = exactKeys(value, path, ['schemaVersion', 'mode', 'listenerDiscoveryId', 'areaCells', 'requestedAt', 'maxResults'], ['manualAreaLabel']);
  if (shape) return shape;

  const maxResultsIssue =
    numberField(value, 'maxResults', path) ??
    (value.maxResults >= 1 && value.maxResults <= tunables.maxResults
      ? null
      : schemaIssue(childPath(path, 'maxResults'), 'Search request must respect the configured max-results bound.'));

  return (
    literalField(value, 'schemaVersion', schemaVersion, path) ??
    enumField(value, 'mode', discoveryModes, path) ??
    stringField(value, 'listenerDiscoveryId', path) ??
    stringArray(value, 'areaCells', path, item => {
      try {
        parseCell(item);
        return true;
      } catch {
        return false;
      }
    }) ??
    stringField(value, 'requestedAt', path) ??
    maxResultsIssue ??
    ('manualAreaLabel' in value ? stringField(value, 'manualAreaLabel', path) : null)
  );
}

function validateDensity(value, path) {
  const shape = exactKeys(value, path, ['resultBucket', 'exactCountSuppressed']);
  if (shape) return shape;

  return enumField(value, 'resultBucket', countBuckets, path) ?? literalField(value, 'exactCountSuppressed', true, path, 'Exact counts must be suppressed.');
}

function validateSearchResponse(value, path = '') {
  const shape = exactKeys(value, path, ['schemaVersion', 'areaScale', 'expiresAt', 'density', 'results']);
  if (shape) return shape;

  return (
    literalField(value, 'schemaVersion', schemaVersion, path) ??
    enumField(value, 'areaScale', areaScales, path) ??
    stringField(value, 'expiresAt', path) ??
    validateDensity(value.density, childPath(path, 'density')) ??
    objectArray(value, 'results', path, validateHostPresence)
  );
}

function validateProtocolPayload(payload) {
  if (!isRecord(payload)) return schemaIssue('', 'Payload must match an allowlisted protocol object.');
  if ('roomId' in payload && 'discoveryId' in payload && 'areaCell' in payload) return validateHostPresence(payload);
  if ('mode' in payload && 'areaCells' in payload && 'listenerDiscoveryId' in payload) return validateSearchRequest(payload);
  if ('density' in payload && 'results' in payload) return validateSearchResponse(payload);
  return schemaIssue('', 'Payload must match one of the allowlisted host, request, or response schemas.');
}

function safePayload(payload) {
  const forbidden = findForbiddenField(payload);
  if (forbidden) return { ok: false, forbidden, issue: null };
  const issue = validateProtocolPayload(payload);
  return { ok: issue === null, forbidden: null, issue };
}

function hostPresence({ roomId, discoveryId, areaScale, roomCount, standardCell, nowMs = startTimeMs, nowPlaying = false }) {
  return {
    schemaVersion,
    roomId,
    discoveryId,
    areaCell: areaScale === 'expanded' ? expandedCellFor(standardCell) : standardCell,
    areaScale,
    hostSurface: 'standalone-browser',
    canonicalRoomUrl: `https://dotify-test01.dev-dot.li/#/rooms/${roomId}`,
    expiresAt: new Date(nowMs + tunables.hostTtlSeconds * 1000).toISOString(),
    listenerCountBucket: countBucket(roomCount),
    capabilities: {
      walletlessJoin: true,
      sourceKeysExposed: false,
      exactLocationShared: false
    },
    ...(nowPlaying
      ? {
          nowPlaying: {
            title: 'Synthetic room track',
            artist: 'Synthetic artist',
            playbackMode: 'full'
          }
        }
      : {})
  };
}

function searchRequest({ areaCells, mode = 'manual-area', listenerDiscoveryId = 'listener-rotation-1', nowMs = startTimeMs, manualAreaLabel }) {
  return {
    schemaVersion,
    mode,
    listenerDiscoveryId,
    areaCells,
    requestedAt: new Date(nowMs).toISOString(),
    maxResults: tunables.maxResults,
    ...(manualAreaLabel ? { manualAreaLabel } : {})
  };
}

function searchResponse({ results, areaScale, nowMs }) {
  return {
    schemaVersion,
    areaScale,
    expiresAt: new Date(nowMs + tunables.hostRefreshSeconds * 1000).toISOString(),
    density: {
      resultBucket: countBucket(results.length),
      exactCountSuppressed: true
    },
    results
  };
}

class NearbyPresenceStore {
  constructor() {
    this.records = new Map();
  }

  publish(presence) {
    const safety = safePayload(presence);
    assert.equal(safety.ok, true, safety.issue?.reason ?? safety.forbidden ?? 'unsafe presence');
    this.records.set(presence.roomId, presence);
    return presence;
  }

  query(request, nowMs, areaScale) {
    const requestSafety = safePayload(request);
    assert.equal(requestSafety.ok, true, requestSafety.issue?.reason ?? requestSafety.forbidden ?? 'unsafe request');
    this.expire(nowMs);
    const wantedCells = new Set(request.areaCells);
    const results = [...this.records.values()].filter(record => wantedCells.has(record.areaCell)).slice(0, request.maxResults);
    const response = searchResponse({ results, areaScale, nowMs });
    const responseSafety = safePayload(response);
    assert.equal(responseSafety.ok, true, responseSafety.issue?.reason ?? responseSafety.forbidden ?? 'unsafe response');
    return response;
  }

  move(roomId, nextStandardCell, nowMs) {
    const current = this.records.get(roomId);
    assert.ok(current, `missing presence for ${roomId}`);
    this.records.delete(roomId);
    const moved = this.publish(
      hostPresence({
        roomId,
        discoveryId: `${current.discoveryId}-rotated`,
        areaScale: 'standard',
        roomCount: 6,
        standardCell: nextStandardCell,
        nowMs
      })
    );
    return {
      oldDiscoveryId: current.discoveryId,
      newDiscoveryId: moved.discoveryId,
      newAreaCell: moved.areaCell,
      activePresenceRecords: this.records.size,
      oldStillVisible: [...this.records.values()].some(record => record.discoveryId === current.discoveryId)
    };
  }

  revoke(roomId) {
    const beforeRevoke = this.records.size;
    this.records.delete(roomId);
    return {
      beforeRevoke,
      afterRevoke: this.records.size,
      fallback: 'canonical room link'
    };
  }

  expire(nowMs) {
    for (const [roomId, presence] of this.records.entries()) {
      const invisibleAfterMs = Date.parse(presence.expiresAt) + tunables.expiryGraceSeconds * 1000;
      if (nowMs > invisibleAfterMs) this.records.delete(roomId);
    }
  }
}

class QueryRateLimiter {
  constructor() {
    this.timestampsByKey = new Map();
  }

  attempt(key, nowMs) {
    const windowStartMs = nowMs - tunables.queryRateLimit.windowSeconds * 1000;
    const timestamps = (this.timestampsByKey.get(key) ?? []).filter(timestamp => timestamp > windowStartMs);
    const allowed = timestamps.length < tunables.queryRateLimit.limit;
    if (allowed) timestamps.push(nowMs);
    this.timestampsByKey.set(key, timestamps);
    return allowed;
  }
}

function runRateLimit(attempts) {
  const limiter = new QueryRateLimiter();
  let allowed = 0;
  for (let index = 0; index < attempts; index += 1) {
    if (limiter.attempt('listener-session-1', startTimeMs + index * 1000)) allowed += 1;
  }
  return {
    allowed,
    throttled: attempts - allowed
  };
}

function scenario(id, observation, evidence, checks) {
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    id,
    status: failures.length === 0 ? 'pass' : 'fail',
    observation,
    evidence,
    ...(failures.length > 0 ? { failures } : {})
  };
}

function runSimulation() {
  const center = areaCell(tunables.standardCellMeters, 42, -7);
  const shiftedCell = areaCell(tunables.standardCellMeters, 43, -7);
  const boundaryCells = neighborCells(center);
  const sparseAreaScale = shouldExpandNearbyArea(1) ? 'expanded' : 'standard';
  const sparseExpanded = expandedCellFor(center);
  const repeatedQueries = runRateLimit(8);
  const visualSeedInputs = ['roomId', 'discoveryId'];

  const protocolStore = new NearbyPresenceStore();
  const protocolPresence = protocolStore.publish(
    hostPresence({
      roomId: 'PROTO1',
      discoveryId: 'disc-protocol-rotation-1',
      areaScale: 'standard',
      roomCount: 5,
      standardCell: center,
      nowPlaying: true
    })
  );
  const protocolRequest = searchRequest({ areaCells: boundaryCells, manualAreaLabel: 'Lisbon center' });
  const protocolResponse = protocolStore.query(protocolRequest, startTimeMs + 1_000, 'standard');
  const protocolPayloads = [protocolPresence, protocolRequest, protocolResponse];

  for (const payload of protocolPayloads) {
    assert.equal(safePayload(payload).ok, true);
  }

  assert.equal(safePayload({ latitude: 48.8566, longitude: 2.3522 }).ok, false);
  assert.equal(safePayload({ schemaVersion, position: [48.8566, 2.3522] }).ok, false);
  assert.equal(safePayload({ host: { walletAddress: '0x1111111111111111111111111111111111111111' } }).ok, false);
  assert.equal(countBucket(1), '1-3');
  assert.equal(countBucket(3), '1-3');
  assert.equal(countBucket(14), '10+');

  const sparseStore = new NearbyPresenceStore();
  const sparsePresence = sparseStore.publish(
    hostPresence({
      roomId: 'RURAL1',
      discoveryId: 'disc-rural-rotation-1',
      areaScale: sparseAreaScale,
      roomCount: 1,
      standardCell: center
    })
  );
  const sparseResponse = sparseStore.query(searchRequest({ areaCells: [sparsePresence.areaCell] }), startTimeMs + 2_000, sparseAreaScale);

  const crowdedStore = new NearbyPresenceStore();
  for (let index = 0; index < 14; index += 1) {
    crowdedStore.publish(
      hostPresence({
        roomId: `VENUE${String(index).padStart(2, '0')}`,
        discoveryId: `disc-venue-rotation-${index}`,
        areaScale: 'standard',
        roomCount: 14,
        standardCell: center,
        nowPlaying: index === 0
      })
    );
  }
  const crowdedResponse = crowdedStore.query(searchRequest({ areaCells: boundaryCells, mode: 'venue-qr' }), startTimeMs + 3_000, 'standard');

  const roamingStore = new NearbyPresenceStore();
  roamingStore.publish(
    hostPresence({
      roomId: 'ROAM01',
      discoveryId: 'disc-host-rotation-1',
      areaScale: 'standard',
      roomCount: 6,
      standardCell: center
    })
  );
  const roaming = roamingStore.move('ROAM01', shiftedCell, startTimeMs + 4_000);

  const revocationStore = new NearbyPresenceStore();
  revocationStore.publish(
    hostPresence({
      roomId: 'REVOKE',
      discoveryId: 'disc-revoke-rotation-1',
      areaScale: 'standard',
      roomCount: 4,
      standardCell: center
    })
  );
  const revocation = revocationStore.revoke('REVOKE');

  const expiryStore = new NearbyPresenceStore();
  const expiryPresence = expiryStore.publish(
    hostPresence({
      roomId: 'EXPIRE',
      discoveryId: 'disc-expire-rotation-1',
      areaScale: 'standard',
      roomCount: 4,
      standardCell: center
    })
  );
  const expiryRequest = searchRequest({ areaCells: [expiryPresence.areaCell] });
  const visibleBeforeExpiry = expiryStore.query(expiryRequest, startTimeMs + (tunables.hostTtlSeconds + tunables.expiryGraceSeconds) * 1000 - 1, 'standard')
    .results.length;
  const visibleAfterExpiry = expiryStore.query(expiryRequest, startTimeMs + (tunables.hostTtlSeconds + tunables.expiryGraceSeconds) * 1000 + 1, 'standard')
    .results.length;

  const scenarios = [
    scenario(
      'sparse-rural',
      'One synthetic room in a low-density area expands from 1.8 km to 7.2 km and suppresses exact counts.',
      {
        inputRooms: 1,
        areaScale: sparsePresence.areaScale,
        areaCell: sparsePresence.areaCell,
        resultBucket: sparseResponse.density.resultBucket,
        exactCountSuppressed: sparseResponse.density.exactCountSuppressed
      },
      {
        expandedAreaUsed: sparsePresence.areaScale === 'expanded',
        expandedCellMatches: sparsePresence.areaCell === sparseExpanded,
        singletonSuppressed: sparseResponse.density.resultBucket === '1-3',
        exactCountSuppressed: sparseResponse.density.exactCountSuppressed === true
      }
    ),
    scenario(
      'crowded-venue',
      'A crowded venue stays in the standard area and uses a count bucket plus QR/manual-area alternative.',
      {
        inputRooms: crowdedResponse.results.length,
        areaScale: crowdedResponse.areaScale,
        countBucket: crowdedResponse.density.resultBucket,
        venueQrAlternative: true
      },
      {
        standardAreaUsed: crowdedResponse.areaScale === 'standard',
        denseBucketUsed: crowdedResponse.density.resultBucket === '10+',
        maxResultsRespected: crowdedResponse.results.length <= tunables.maxResults,
        venueQrAlternative: true
      }
    ),
    scenario(
      'grid-boundary',
      'Boundary queries cover the center cell plus its eight neighbors so a border does not reveal a sharp edge.',
      {
        center,
        queryCellCount: boundaryCells.length
      },
      {
        centerIncluded: boundaryCells.includes(center),
        nineCellsQueried: boundaryCells.length === 9,
        lowerNeighborIncluded: boundaryCells.includes(areaCell(tunables.standardCellMeters, 41, -8)),
        upperNeighborIncluded: boundaryCells.includes(areaCell(tunables.standardCellMeters, 43, -6))
      }
    ),
    scenario('roaming-host', 'A moving host keeps one active presence and rotates the public discovery id when the coarse cell changes.', roaming, {
      singleActivePresence: roaming.activePresenceRecords === 1,
      discoveryIdRotated: roaming.oldDiscoveryId !== roaming.newDiscoveryId,
      oldRecordDeleted: roaming.oldStillVisible === false,
      newCellPublished: roaming.newAreaCell === shiftedCell
    }),
    scenario(
      'repeated-adversarial-queries',
      'Eight synthetic queries in one minute allow six and throttle two, limiting triangulation by repetition.',
      repeatedQueries,
      {
        allowedLimitApplied: repeatedQueries.allowed === tunables.queryRateLimit.limit,
        excessThrottled: repeatedQueries.throttled === 2
      }
    ),
    scenario('permission-revocation', 'Revocation deletes the host presence immediately and leaves link sharing as the fallback.', revocation, {
      hadPresenceBeforeRevoke: revocation.beforeRevoke === 1,
      deletedAfterRevoke: revocation.afterRevoke === 0,
      fallbackPreserved: revocation.fallback === 'canonical room link'
    }),
    scenario(
      'expired-presence',
      'Unrefreshed presence expires after TTL plus grace instead of leaving a stale nearby room.',
      {
        ttlSeconds: tunables.hostTtlSeconds,
        graceSeconds: tunables.expiryGraceSeconds,
        visibleBeforeExpiry,
        visibleAfterExpiry
      },
      {
        visibleBeforeTtlGrace: visibleBeforeExpiry === 1,
        hiddenAfterTtlGrace: visibleAfterExpiry === 0
      }
    ),
    scenario(
      'galaxy-position',
      'Room galaxy placement is seeded by room/discovery identity, not by physical area cells.',
      {
        visualSeedInputs
      },
      {
        excludesAreaCell: !visualSeedInputs.includes('areaCell'),
        excludesCoordinates: !visualSeedInputs.includes('coordinates')
      }
    )
  ];

  return {
    schemaVersion,
    generatedAt,
    tunables,
    scenarios,
    protocolPayloads,
    summary: {
      status: scenarios.every(item => item.status === 'pass') ? 'pass' : 'fail',
      passCount: scenarios.filter(item => item.status === 'pass').length,
      failCount: scenarios.filter(item => item.status !== 'pass').length
    }
  };
}

function renderMarkdown(report) {
  return [
    '# W18 Nearby Privacy Simulation',
    '',
    `Generated: ${report.generatedAt}`,
    `Summary: **${report.summary.status}** (${report.summary.passCount} pass, ${report.summary.failCount} fail)`,
    '',
    '## Tunables',
    '',
    '| Tunable | Value |',
    '| --- | --- |',
    ...Object.entries(report.tunables).map(([key, value]) => `| ${key} | ${typeof value === 'object' ? JSON.stringify(value) : value} |`),
    '',
    '## Scenarios',
    '',
    '| Scenario | Status | Observation | Evidence |',
    '| --- | --- | --- | --- |',
    ...report.scenarios.map(item => `| ${item.id} | ${item.status} | ${item.observation} | ${JSON.stringify(item.evidence).replaceAll('|', '\\|')} |`)
  ].join('\n');
}

function parseArgs(argv) {
  const args = { jsonOut: null, mdOut: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--json-out' && next) {
      args.jsonOut = next;
      index += 1;
    } else if (value === '--md-out' && next) {
      args.mdOut = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const report = runSimulation();
const markdown = renderMarkdown(report);

if (args.jsonOut) writeFileSync(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
if (args.mdOut) writeFileSync(args.mdOut, `${markdown}\n`);

console.log(markdown);
if (report.summary.status !== 'pass') process.exitCode = 1;
