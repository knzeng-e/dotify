import { describe, expect, it } from 'vitest';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { resolveRoomContributionTrack } from './roomContributionTrack';

const runtime = '0xB60e91CcAcD08B6cb0Ddb2E678F90791901e9338';
const hash = `0x${'71'.repeat(32)}` as const;

function track(overrides: Partial<CatalogTrack> = {}): CatalogTrack {
  return {
    id: `${runtime}:${hash}`,
    zone: 'Registry',
    title: 'CALL',
    artist: 'Lord Ekomy',
    audioRef: 'dotify:enc:v2:ipfs://audio',
    imageRef: 'ipfs://cover',
    priceDot: '0',
    hash,
    description: '',
    bulletinRef: '',
    metadataRef: 'ipfs://metadata',
    royaltyBps: 10000,
    durationLabel: '3:57',
    accessMode: 'free',
    source: 'artist',
    royaltySplits: [],
    personhoodLevel: 'DIM1',
    encrypted: false,
    active: true,
    ...overrides
  };
}

function roomTrack(overrides: Partial<TrackInfo> = {}): TrackInfo {
  return {
    title: 'CALL',
    artist: 'Lord Ekomy',
    duration: 237,
    updatedAt: 1,
    bulletinRef: '',
    hash,
    runtimeAddress: runtime,
    ...overrides
  };
}

describe('resolveRoomContributionTrack', () => {
  it('resolves a verified runtime and hash case-insensitively', () => {
    const result = resolveRoomContributionTrack(
      [track()],
      roomTrack({ hash: hash.toUpperCase() as `0x${string}`, runtimeAddress: runtime.toUpperCase() as `0x${string}` })
    );

    expect(result).toMatchObject({ state: 'ready', track: { title: 'CALL' } });
  });

  it('offers host recovery when a legacy room hash has one catalog match', () => {
    expect(resolveRoomContributionTrack([track()], roomTrack({ runtimeAddress: undefined }))).toMatchObject({
      state: 'recoverable',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('fails closed when a hash maps to more than one runtime', () => {
    const otherRuntime = '0xB210b0EE476C3FA4A23B3fA88DAb38C593c02b85';
    const result = resolveRoomContributionTrack(
      [track(), track({ id: `${otherRuntime}:${hash}` })],
      roomTrack({ runtimeAddress: undefined })
    );

    expect(result).toEqual({ state: 'unavailable', reason: 'ambiguous-release' });
  });

  it('does not substitute a catalog runtime for a conflicting room runtime', () => {
    expect(
      resolveRoomContributionTrack([track()], roomTrack({ runtimeAddress: '0x0000000000000000000000000000000000000001' }))
    ).toEqual({ state: 'unavailable', reason: 'runtime-mismatch' });
  });
});

