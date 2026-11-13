import { afterEach, expect, it, vi } from 'vitest';
import {
  beginSystemArtworkObservation,
  clearSystemArtworkObservations,
  serializeSystemArtworkObservations,
  systemArtworkObservations,
  type SystemArtworkObservation
} from './systemArtworkObservation';
afterEach(() => {
  clearSystemArtworkObservations();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('records monotonic phase timing and visibility without using storage or network', () => {
  const fetch = vi.fn(() => {
    throw new Error('No network');
  });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('document', { visibilityState: 'visible' });
  const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
  const observe = beginSystemArtworkObservation();
  clock.mockReturnValue(350);
  vi.stubGlobal('document', { visibilityState: 'hidden' });
  observe('metadata-published', 'png');
  expect(systemArtworkObservations().map(({ phase, elapsedMs, visibility, kind }) => ({ phase, elapsedMs, visibility, kind }))).toEqual([
    { phase: 'requested', elapsedMs: 0, visibility: 'visible', kind: undefined },
    { phase: 'metadata-published', elapsedMs: 250, visibility: 'hidden', kind: 'png' }
  ]);
  expect(fetch).not.toHaveBeenCalled();
});

it('bounds retained events and returns detached snapshots', () => {
  const observe = beginSystemArtworkObservation();
  for (let index = 0; index < 100; index++) observe('metadata-published', 'png');
  const snapshot = systemArtworkObservations();
  expect(snapshot).toHaveLength(64);
  snapshot[0].phase = 'failed';
  expect(systemArtworkObservations()[0].phase).toBe('metadata-published');
});

it('clearing discards pending owners as well as retained history', () => {
  const old = beginSystemArtworkObservation();
  clearSystemArtworkObservations();
  old('composed', 'png');
  expect(systemArtworkObservations()).toEqual([]);
  beginSystemArtworkObservation();
  expect(systemArtworkObservations()).toHaveLength(1);
});

it('exports only approved fields and export-local attempt numbers', () => {
  const event = {
    attempt: 892,
    phase: 'composed',
    elapsedMs: 12,
    timestamp: 123,
    visibility: 'hidden',
    kind: 'png',
    title: 'Private title',
    imageRef: 'https://private.example/cover?token=secret',
    contentKey: 'secret',
    account: '0x123'
  };
  const result = serializeSystemArtworkObservations([
    event as SystemArtworkObservation,
    { ...event, attempt: 1246, phase: 'metadata-published' } as SystemArtworkObservation
  ]);
  expect(result).toEqual([
    { attempt: 1, phase: 'composed', elapsedMs: 12, timestamp: 123, visibility: 'hidden', kind: 'png' },
    { attempt: 2, phase: 'metadata-published', elapsedMs: 12, timestamp: 123, visibility: 'hidden', kind: 'png' }
  ]);
});

it('refuses invalid timing/phase values rather than exporting arbitrary detail', () => {
  const good = { attempt: 1, phase: 'requested', elapsedMs: 0, timestamp: 100, visibility: 'visible' } as SystemArtworkObservation;
  const injected = [
    { ...good, elapsedMs: NaN },
    { ...good, timestamp: Infinity },
    { ...good, elapsedMs: -1 },
    { ...good, phase: 'https://private.example' },
    { ...good, attempt: 0 }
  ];
  expect(serializeSystemArtworkObservations(injected as SystemArtworkObservation[])).toEqual([]);
  const safe = serializeSystemArtworkObservations([{ ...good, visibility: 'private', kind: 'secret' } as unknown as SystemArtworkObservation]);
  expect(safe).toEqual([{ ...good, visibility: 'unknown' }]);
});
