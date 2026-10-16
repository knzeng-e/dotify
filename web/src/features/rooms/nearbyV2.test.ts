import { describe, expect, it } from 'vitest';
import { coarseNearbyCell, nearbyAreasMatch, nearbyCellDistanceKm, parseNearbyCell, validNearbyArea } from '../../../shared/nearby-v2.mjs';
import { safeNearbyReply } from './nearbyTypes';

const area = (latitude: number, longitude: number, radiusKm = 5) => ({ schemaVersion: 2 as const, cell: coarseNearbyCell(latitude, longitude)!, radiusKm });

describe('Nearby v2 privacy geometry', () => {
  it('rejects response extensions and unbounded relative leases', () => {
    const response = { ok: true, schemaVersion: 2, expiresInMs: 30_000, results: [] };
    expect(safeNearbyReply(response, false)).toBe(true);
    expect(safeNearbyReply({ ...response, cell: area(0, 0).cell }, false)).toBe(false);
    expect(safeNearbyReply({ ...response, results: [null] }, false)).toBe(false);
    expect(safeNearbyReply({ ok: true, expiresInMs: 90001 }, true)).toBe(false);
    expect(safeNearbyReply({ ok: true, expiresInMs: NaN }, true)).toBe(false);
  });
  it('v3 accepts only coarse bands and rejects precise locations and disguised values', () => {
    const item = {
      roomId: 'ABC234',
      discoveryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      expiresInMs: 45000,
      hostName: 'Host',
      title: 'Track',
      artist: 'Artist',
      presence: '1–3',
      isFull: false,
      distanceBand: '0–5 km'
    };
    const response = { ok: true, schemaVersion: 3, expiresInMs: 45000, results: [item] };
    expect(safeNearbyReply(response, false)).toBe(true);
    for (const distanceBand of ['0.7 km', 5, ['0–5 km'], undefined, '45–50 km'])
      expect(safeNearbyReply({ ...response, results: [{ ...item, distanceBand }] }, false)).toBe(false);
    expect(safeNearbyReply({ ...response, results: [{ ...item, distanceBand: null }] }, false)).toBe(true);
    expect(safeNearbyReply({ ...response, results: [{ ...item, cell: area(0, 0).cell }] }, false)).toBe(false);
    expect(safeNearbyReply({ ...response, schemaVersion: '3' }, false)).toBe(false);
    expect(safeNearbyReply({ ...response, schemaVersion: 2 }, false)).toBe(false);
  });
  it('coarsens different fixes to one cell and rejects inaccurate/out-of-world inputs', () => {
    expect(area(0.001, 0.001).cell).toBe(area(0.009, 0.009).cell);
    for (const [lat, lon] of [
      [91, 0],
      [0, 181],
      [NaN, 0],
      [0, Infinity]
    ])
      expect(coarseNearbyCell(lat, lon)).toBeNull();
  });
  it('rejects unknown fields, lists, old/mixed scales and unsupported radius values', () => {
    const good = area(0, 0);
    expect(validNearbyArea(good)).toBe(true);
    for (const radiusKm of [2, 0, -5, 43, 5.5, Infinity, NaN, '5']) expect(validNearbyArea({ ...good, radiusKm })).toBe(false);
    expect(validNearbyArea({ ...good, position: [0, 0] })).toBe(false);
    expect(validNearbyArea({ ...good, areaCells: [good.cell] })).toBe(false);
    expect(validNearbyArea({ ...good, cell: 'dotify-nearby-v1:1800:1:2' })).toBe(false);
    for (const cell of ['n2:9000:0', 'n2:0:100', 'n2:4500:18000', 'n2:01:1', 'n2:-1:1']) expect(parseNearbyCell(cell)).toBeNull();
  });
  it('crosses cell boundaries without widening host consent', () => {
    expect(nearbyAreasMatch(area(0.0199, 0), area(0.0201, 0))).toBe(true);
    expect(nearbyAreasMatch(area(0, 0, 5), area(0.1, 0, 25))).toBe(false);
    expect(nearbyAreasMatch(area(0, 0, 25), area(0.1, 0, 5))).toBe(false);
    expect(nearbyAreasMatch(area(0, 0, 25), area(0.1, 0, 25))).toBe(true);
  });
  it('handles dateline, high latitude and poles without Mercator distortion', () => {
    expect(nearbyAreasMatch(area(0, 179.999), area(0, -179.999))).toBe(true);
    expect(nearbyAreasMatch(area(80, 20), area(80, 20.05))).toBe(true);
    expect(nearbyAreasMatch(area(80, 20), area(80, 21))).toBe(false);
    expect(nearbyAreasMatch(area(90, 180), area(90, -180))).toBe(true);
    expect(nearbyCellDistanceKm(area(-90, 0).cell, area(90, 0).cell)).toBeGreaterThan(19_000);
  });
});
