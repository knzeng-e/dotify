import { describe, expect, it } from 'vitest';
import type { CatalogTrack, TrackInfo } from '../../shared/types';
import { resolvePlaybackContributionTrack, resolveRoomContributionTrack } from './roomContributionTrack';

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
    expect(resolveRoomContributionTrack([track()], roomTrack({ runtimeAddress: undefined }), true)).toMatchObject({
      state: 'recoverable',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('does not repair attribution from a provisional catalog', () => {
    expect(resolveRoomContributionTrack([track()], roomTrack({ runtimeAddress: undefined }), false)).toEqual({
      state: 'unavailable',
      reason: 'catalog-unverified'
    });
  });

  it('fails closed when a hash maps to more than one runtime', () => {
    const otherRuntime = '0xB210b0EE476C3FA4A23B3fA88DAb38C593c02b85';
    const result = resolveRoomContributionTrack([track(), track({ id: `${otherRuntime}:${hash}` })], roomTrack({ runtimeAddress: undefined }), true);

    expect(result).toEqual({ state: 'unavailable', reason: 'ambiguous-release' });
  });

  it('does not substitute a catalog runtime for a conflicting room runtime', () => {
    expect(resolveRoomContributionTrack([track()], roomTrack({ runtimeAddress: '0x0000000000000000000000000000000000000001' }))).toEqual({
      state: 'unavailable',
      reason: 'runtime-mismatch'
    });
  });
});

describe('resolvePlaybackContributionTrack', () => {
  it('keeps the exact selected release as the contribution target', () => {
    expect(resolvePlaybackContributionTrack([track()], `${runtime}:${hash}`, null)).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}` }
    });

    expect(resolvePlaybackContributionTrack([track()], `${runtime}:${hash}`, roomTrack())).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('recovers a Product playback snapshot when its selected id is stale', () => {
    expect(resolvePlaybackContributionTrack([track()], 'stale-product-selection', roomTrack(), false)).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('uses a unique authoritative hash when legacy playback metadata has no runtime', () => {
    expect(resolvePlaybackContributionTrack([track()], '', roomTrack({ runtimeAddress: undefined }), true)).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('keeps a uniquely selected hash when the playback snapshot has no runtime', () => {
    expect(resolvePlaybackContributionTrack([track()], `${runtime}:${hash}`, roomTrack({ runtimeAddress: undefined }), false)).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}` }
    });
  });

  it('does not let a refreshed fallback selection replace the playing work', () => {
    const fallbackRuntime = '0xB210b0EE476C3FA4A23B3fA88DAb38C593c02b85';
    const fallbackHash = `0x${'92'.repeat(32)}` as const;
    const fallback = track({ id: `${fallbackRuntime}:${fallbackHash}`, hash: fallbackHash, title: 'Catalog fallback' });

    expect(resolvePlaybackContributionTrack([fallback, track()], fallback.id, roomTrack(), true)).toMatchObject({
      state: 'ready',
      track: { id: `${runtime}:${hash}`, title: 'CALL' }
    });
    expect(resolvePlaybackContributionTrack([fallback], fallback.id, roomTrack(), true)).toEqual({
      state: 'unavailable',
      reason: 'runtime-mismatch'
    });
  });

  it('does not guess from provisional or ambiguous playback metadata', () => {
    expect(resolvePlaybackContributionTrack([track()], '', roomTrack({ runtimeAddress: undefined }), false)).toEqual({
      state: 'unavailable',
      reason: 'catalog-unverified'
    });

    const otherRuntime = '0xB210b0EE476C3FA4A23B3fA88DAb38C593c02b85';
    expect(resolvePlaybackContributionTrack([track(), track({ id: `${otherRuntime}:${hash}` })], '', roomTrack({ runtimeAddress: undefined }), true)).toEqual({
      state: 'unavailable',
      reason: 'ambiguous-release'
    });
    expect(
      resolvePlaybackContributionTrack(
        [track(), track({ id: `${otherRuntime}:${hash}` })],
        `${runtime}:${hash}`,
        roomTrack({ runtimeAddress: undefined }),
        true
      )
    ).toEqual({ state: 'unavailable', reason: 'ambiguous-release' });
  });
});
