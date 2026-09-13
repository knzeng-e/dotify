import { describe, expect, it } from 'vitest';
import {
  NEARBY_DISCOVERY_SCHEMA_VERSION,
  NEARBY_DISCOVERY_TUNABLES,
  assertNearbyProtocolSafe,
  expandedAreaCellForSparseStandardCell,
  nearbyAreaCell,
  nearbyCountBucket,
  nearbyNeighborCells,
  nearbyVisualSeed,
  parseNearbyAreaCell,
  shouldExpandNearbyArea,
  type NearbyHostPresence
} from './nearbyDiscoveryProtocol';

const center = nearbyAreaCell(NEARBY_DISCOVERY_TUNABLES.standardCellMeters, 42, -7);

function hostPresence(patch: Partial<NearbyHostPresence> = {}): NearbyHostPresence {
  return {
    schemaVersion: NEARBY_DISCOVERY_SCHEMA_VERSION,
    roomId: 'AB12CD',
    discoveryId: 'dsc_2026_09_13_01',
    areaCell: center,
    areaScale: 'standard',
    hostSurface: 'standalone-browser',
    canonicalRoomUrl: 'https://dotify-test01.dev-dot.li/#/rooms/AB12CD',
    expiresAt: '2026-09-13T12:01:30.000Z',
    listenerCountBucket: '4-9',
    capabilities: {
      walletlessJoin: true,
      sourceKeysExposed: false,
      exactLocationShared: false
    },
    ...patch
  };
}

describe('nearby discovery protocol proposal', () => {
  it('represents coarse cells without exact coordinates', () => {
    expect(parseNearbyAreaCell(center)).toEqual({
      cellMeters: NEARBY_DISCOVERY_TUNABLES.standardCellMeters,
      x: 42,
      y: -7
    });
    expect(parseNearbyAreaCell('dotify-nearby-v1:50:1:2')).toBeNull();
    expect(assertNearbyProtocolSafe(hostPresence())).toEqual({ ok: true });
  });

  it('accepts only allowlisted nearby protocol schemas', () => {
    const request = {
      schemaVersion: NEARBY_DISCOVERY_SCHEMA_VERSION,
      mode: 'manual-area',
      listenerDiscoveryId: 'listener-rotation-1',
      areaCells: [center],
      requestedAt: '2026-09-13T12:00:00.000Z',
      maxResults: NEARBY_DISCOVERY_TUNABLES.maxResults,
      manualAreaLabel: 'Lisbon center'
    };
    const response = {
      schemaVersion: NEARBY_DISCOVERY_SCHEMA_VERSION,
      areaScale: 'standard',
      expiresAt: '2026-09-13T12:01:30.000Z',
      density: {
        resultBucket: '1-3',
        exactCountSuppressed: true
      },
      results: [hostPresence({ listenerCountBucket: '1-3' })]
    };

    expect(assertNearbyProtocolSafe(request)).toEqual({ ok: true });
    expect(assertNearbyProtocolSafe(response)).toEqual({ ok: true });
    expect(assertNearbyProtocolSafe({ ...hostPresence(), position: [48.8566, 2.3522] })).toMatchObject({
      ok: false,
      path: 'position'
    });
    expect(assertNearbyProtocolSafe({ ...request, resultLimit: 200 })).toMatchObject({
      ok: false,
      path: 'resultLimit'
    });
    expect(assertNearbyProtocolSafe({ ...request, maxResults: NEARBY_DISCOVERY_TUNABLES.maxResults + 1 })).toMatchObject({
      ok: false,
      path: 'maxResults'
    });
    expect(assertNearbyProtocolSafe({ ...hostPresence(), capabilities: { ...hostPresence().capabilities, locationPrecision: 'exact' } })).toMatchObject({
      ok: false,
      path: 'capabilities.locationPrecision'
    });
  });

  it('rejects exact location and wallet binding fields anywhere in a payload', () => {
    expect(assertNearbyProtocolSafe({ roomId: 'AB12CD', latitude: 48.8566 }).ok).toBe(false);
    expect(assertNearbyProtocolSafe({ schemaVersion: NEARBY_DISCOVERY_SCHEMA_VERSION, position: [48.8566, 2.3522] }).ok).toBe(false);
    expect(assertNearbyProtocolSafe({ host: { evmAddress: '0x1111111111111111111111111111111111111111' } }).ok).toBe(false);
    expect(assertNearbyProtocolSafe({ result: { exactDistanceMeters: 120 } }).ok).toBe(false);
  });

  it('queries neighboring cells so grid boundaries do not become hard disclosure edges', () => {
    const cells = nearbyNeighborCells(center);

    expect(cells).toHaveLength(9);
    expect(cells).toContain(center);
    expect(cells).toContain(nearbyAreaCell(NEARBY_DISCOVERY_TUNABLES.standardCellMeters, 41, -8));
    expect(cells).toContain(nearbyAreaCell(NEARBY_DISCOVERY_TUNABLES.standardCellMeters, 43, -6));
  });

  it('expands sparse areas before presenting nearby results', () => {
    expect(shouldExpandNearbyArea(0)).toBe(true);
    expect(shouldExpandNearbyArea(3)).toBe(true);
    expect(shouldExpandNearbyArea(4)).toBe(false);
    expect(expandedAreaCellForSparseStandardCell(center)).toBe(nearbyAreaCell(NEARBY_DISCOVERY_TUNABLES.expandedCellMeters, 10, -2));
  });

  it('publishes count buckets rather than exact density', () => {
    expect([nearbyCountBucket(0), nearbyCountBucket(1), nearbyCountBucket(3), nearbyCountBucket(9), nearbyCountBucket(10)]).toEqual([
      '0',
      '1-3',
      '1-3',
      '4-9',
      '10+'
    ]);
  });

  it('keeps galaxy positioning independent from physical area cells', () => {
    const seed = nearbyVisualSeed('ab12cd', 'rotating-public-id');

    expect(seed).toBe('dotify-nearby-visual-v1:AB12CD:rotating-public-id');
    expect(seed).not.toContain(String(NEARBY_DISCOVERY_TUNABLES.standardCellMeters));
    expect(seed).not.toContain(':42:-7');
  });
});
