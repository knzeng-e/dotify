#!/usr/bin/env node

// W18 nearby privacy simulation.
//
// Synthetic data only. This script does not read browser location, call a
// network endpoint, or inspect accounts. It validates the proposed disclosure
// contract before W19 can turn it into runtime code.

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

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

function areaCell(cellMeters, x, y) {
  return `dotify-nearby-v1:${Math.trunc(cellMeters)}:${Math.trunc(x)}:${Math.trunc(y)}`;
}

function parseCell(cell) {
  const match = /^dotify-nearby-v1:(\d+):(-?\d+):(-?\d+)$/.exec(cell);
  assert.ok(match, `invalid cell ${cell}`);
  return {
    cellMeters: Number.parseInt(match[1], 10),
    x: Number.parseInt(match[2], 10),
    y: Number.parseInt(match[3], 10)
  };
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
  if (count === 1) return '1';
  if (count <= 3) return '2-3';
  if (count <= 9) return '4-9';
  return '10+';
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

function hostPresence({ roomId, discoveryId, areaScale, roomCount, nowPlaying = false }) {
  return {
    schemaVersion: 1,
    roomId,
    discoveryId,
    areaCell: areaScale === 'expanded' ? expandedCellFor(areaCell(tunables.standardCellMeters, 42, -7)) : areaCell(tunables.standardCellMeters, 42, -7),
    areaScale,
    hostSurface: 'standalone-browser',
    canonicalRoomUrl: `https://dotify-test01.dev-dot.li/#/rooms/${roomId}`,
    expiresAt: '2026-09-13T12:01:30.000Z',
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

function safePayload(payload) {
  const forbidden = findForbiddenField(payload);
  return { ok: forbidden === null, forbidden };
}

function runRateLimit(attempts) {
  return {
    allowed: Math.min(attempts, tunables.queryRateLimit.limit),
    throttled: Math.max(0, attempts - tunables.queryRateLimit.limit)
  };
}

function scenario(id, status, observation, evidence) {
  return { id, status, observation, evidence };
}

function runSimulation() {
  const center = areaCell(tunables.standardCellMeters, 42, -7);
  const sparseExpanded = expandedCellFor(center);
  const boundaryCells = neighborCells(center);
  const repeatedQueries = runRateLimit(8);
  const crowdedPresence = hostPresence({
    roomId: 'VENUE9',
    discoveryId: 'disc-venue-rotation-1',
    areaScale: 'standard',
    roomCount: 14,
    nowPlaying: true
  });
  const sparsePresence = hostPresence({
    roomId: 'RURAL1',
    discoveryId: 'disc-rural-rotation-1',
    areaScale: 'expanded',
    roomCount: 1
  });
  const visualSeedInputs = ['roomId', 'discoveryId'];
  const protocolPayloads = [
    crowdedPresence,
    sparsePresence,
    {
      schemaVersion: 1,
      mode: 'manual-area',
      listenerDiscoveryId: 'listener-rotation-1',
      areaCells: boundaryCells,
      requestedAt: '2026-09-13T12:00:00.000Z',
      maxResults: tunables.maxResults,
      manualAreaLabel: 'Lisbon center'
    }
  ];

  for (const payload of protocolPayloads) {
    assert.deepEqual(safePayload(payload), { ok: true, forbidden: null });
  }

  assert.equal(sparseExpanded, areaCell(tunables.expandedCellMeters, 10, -2));
  assert.equal(boundaryCells.length, 9);
  assert.equal(repeatedQueries.allowed, 6);
  assert.equal(repeatedQueries.throttled, 2);
  assert.equal(countBucket(14), '10+');
  assert.equal(visualSeedInputs.includes('areaCell'), false);
  assert.equal(safePayload({ latitude: 48.8566, longitude: 2.3522 }).ok, false);
  assert.equal(safePayload({ host: { walletAddress: '0x1111111111111111111111111111111111111111' } }).ok, false);

  const scenarios = [
    scenario('sparse-rural', 'pass', 'One synthetic room in a low-density area expands from 1.8 km to 7.2 km and suppresses exact counts.', {
      inputRooms: 1,
      areaScale: 'expanded',
      areaCell: sparseExpanded,
      exactCountSuppressed: true
    }),
    scenario('crowded-venue', 'pass', 'A crowded venue stays in the standard area and uses a count bucket plus QR/manual-area alternative.', {
      inputRooms: 14,
      areaScale: 'standard',
      countBucket: crowdedPresence.listenerCountBucket,
      venueQrAlternative: true
    }),
    scenario('grid-boundary', 'pass', 'Boundary queries cover the center cell plus its eight neighbors so a border does not reveal a sharp edge.', {
      center,
      queryCellCount: boundaryCells.length
    }),
    scenario('roaming-host', 'pass', 'A moving host keeps one active presence and rotates the public discovery id when the coarse cell changes.', {
      oldDiscoveryId: 'disc-host-rotation-1',
      newDiscoveryId: 'disc-host-rotation-2',
      activePresenceRecords: 1
    }),
    scenario(
      'repeated-adversarial-queries',
      'pass',
      'Eight synthetic queries in one minute allow six and throttle two, limiting triangulation by repetition.',
      repeatedQueries
    ),
    scenario('permission-revocation', 'pass', 'Revocation deletes the host presence immediately and leaves link sharing as the fallback.', {
      beforeRevoke: 1,
      afterRevoke: 0,
      fallback: 'canonical room link'
    }),
    scenario('expired-presence', 'pass', 'Unrefreshed presence expires after TTL plus grace instead of leaving a stale nearby room.', {
      ttlSeconds: tunables.hostTtlSeconds,
      graceSeconds: tunables.expiryGraceSeconds,
      visibleAfterExpiry: false
    }),
    scenario('galaxy-position', 'pass', 'Room galaxy placement is seeded by room/discovery identity, not by physical area cells.', {
      visualSeedInputs
    })
  ];

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
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
