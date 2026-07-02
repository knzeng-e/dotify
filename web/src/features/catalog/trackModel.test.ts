import { describe, expect, it } from 'vitest';
import type { CatalogTrack } from '../../types';
import { catalogTrackToTrackInfo, isTrackManagedByArtist, localAudioRef, priceDotForAccessMode, runtimeAddressFromTrackId } from './trackModel';

const baseTrack: CatalogTrack = {
  id: '0xRuntime:0xHash',
  zone: 'Registry',
  title: 'Signal',
  artist: 'Nova',
  artistAddress: '0x00000000000000000000000000000000000000aa',
  audioRef: 'dotify:enc:ipfs://cid',
  imageRef: 'data:image/svg+xml,cover',
  priceDot: '0.5',
  duration: 42,
  hash: '0xHash',
  description: 'A track',
  bulletinRef: '',
  metadataRef: 'ipfs://meta',
  royaltyBps: 7000,
  durationLabel: '0:42',
  accessMode: 'classic',
  source: 'artist',
  royaltySplits: [],
  personhoodLevel: 'DIM1',
  encrypted: true,
  registeredAtBlock: 1
};

describe('catalogTrackToTrackInfo', () => {
  it('carries the shared fields across and defaults a missing duration to 0', () => {
    const info = catalogTrackToTrackInfo({ ...baseTrack, duration: undefined as unknown as number });
    expect(info).toMatchObject({
      title: 'Signal',
      artist: 'Nova',
      hash: '0xHash',
      bulletinRef: '',
      duration: 0,
      imageRef: 'data:image/svg+xml,cover',
      audioRef: 'dotify:enc:ipfs://cid',
      metadataRef: 'ipfs://meta',
      description: 'A track',
      accessMode: 'classic',
      priceDot: '0.5',
      personhoodLevel: 'DIM1'
    });
    expect(typeof info.updatedAt).toBe('number');
  });
});

describe('isTrackManagedByArtist', () => {
  it('matches on the on-chain artist address case-insensitively', () => {
    expect(isTrackManagedByArtist(baseTrack, '0x00000000000000000000000000000000000000AA', 'someone else')).toBe(true);
    expect(isTrackManagedByArtist(baseTrack, '0x00000000000000000000000000000000000000bb', 'Nova')).toBe(false);
  });

  it('falls back to the display name when no artist address is present', () => {
    const noAddress = { ...baseTrack, artistAddress: undefined };
    expect(isTrackManagedByArtist(noAddress, '0x00000000000000000000000000000000000000bb', 'Nova')).toBe(true);
    expect(isTrackManagedByArtist(noAddress, '0x00000000000000000000000000000000000000bb', 'Other')).toBe(false);
  });

  it('is false for non-artist sources', () => {
    expect(isTrackManagedByArtist({ ...baseTrack, source: 'seed' }, '0x00000000000000000000000000000000000000aa', 'Nova')).toBe(false);
  });
});

describe('priceDotForAccessMode', () => {
  it('keeps the price for classic and zeroes it otherwise', () => {
    expect(priceDotForAccessMode('classic', '0.5')).toBe('0.5');
    expect(priceDotForAccessMode('human-free', '0.5')).toBe('0');
  });
});

describe('localAudioRef', () => {
  it('builds the local audio ref for a hash', () => {
    expect(localAudioRef('0xabc')).toBe('dotify:local:0xabc');
  });
});

describe('runtimeAddressFromTrackId', () => {
  it('returns the runtime address for a policy-managed id', () => {
    expect(runtimeAddressFromTrackId(baseTrack)).toBe('0xRuntime');
  });

  it('returns null for free/local tracks without a runtime id', () => {
    expect(runtimeAddressFromTrackId({ source: 'artist', id: 'draft-upload' })).toBeNull();
    expect(runtimeAddressFromTrackId({ source: 'seed', id: '0xRuntime:0xHash' })).toBeNull();
  });
});
