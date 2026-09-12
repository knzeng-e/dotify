import { describe, expect, it } from 'vitest';
import { listKnownRoyaltyRuntimeCandidates } from './royaltyRuntimeClaims';
import type { CatalogTrack } from '../../shared/types';

const artistRuntime = '0x3000000000000000000000000000000000000000' as const;
const collaboratorRuntime = '0x4000000000000000000000000000000000000000' as const;
const artistAddress = '0x5000000000000000000000000000000000000000' as const;
const collaboratorAddress = '0x6000000000000000000000000000000000000000' as const;
const otherAddress = '0x7000000000000000000000000000000000000000' as const;

function track(patch: Partial<CatalogTrack> = {}): CatalogTrack {
  return {
    id: `${artistRuntime}:0x${'ab'.repeat(32)}`,
    zone: 'Studio',
    title: 'Shared song',
    artist: 'Runtime artist',
    artistAddress,
    audioRef: 'ipfs://audio',
    imageRef: 'ipfs://cover',
    priceDot: '1',
    hash: `0x${'ab'.repeat(32)}`,
    description: '',
    bulletinRef: '',
    metadataRef: 'ipfs://metadata',
    royaltyBps: 10_000,
    durationLabel: '03:00',
    accessMode: 'classic',
    active: true,
    source: 'artist',
    royaltySplits: [{ label: 'Collaborator', recipient: collaboratorAddress, bps: 2500 }],
    personhoodLevel: 'DIM1',
    encrypted: true,
    ...patch
  };
}

describe('listKnownRoyaltyRuntimeCandidates', () => {
  it('finds runtimes where the connected wallet is only a split recipient', () => {
    expect(listKnownRoyaltyRuntimeCandidates([track()], collaboratorAddress, null)).toEqual([
      {
        runtimeAddress: artistRuntime,
        artistAddress,
        artistName: 'Runtime artist',
        trackCount: 1,
        trackTitles: ['Shared song']
      }
    ]);
  });

  it('keeps an owner runtime visible even before indexed releases are present', () => {
    expect(listKnownRoyaltyRuntimeCandidates([], artistAddress, artistRuntime)).toEqual([
      {
        runtimeAddress: artistRuntime,
        artistName: 'Unknown artist',
        trackCount: 0,
        trackTitles: []
      }
    ]);
  });

  it('deduplicates runtime candidates across multiple split tracks', () => {
    const secondTrack = track({
      id: `${artistRuntime}:0x${'cd'.repeat(32)}`,
      hash: `0x${'cd'.repeat(32)}`,
      title: 'Second shared song'
    });
    const unrelatedTrack = track({
      id: `${collaboratorRuntime}:0x${'ef'.repeat(32)}`,
      hash: `0x${'ef'.repeat(32)}`,
      artistAddress: otherAddress,
      royaltySplits: [{ label: 'Other', recipient: otherAddress, bps: 10_000 }]
    });

    expect(listKnownRoyaltyRuntimeCandidates([track(), secondTrack, unrelatedTrack], collaboratorAddress, null)).toEqual([
      {
        runtimeAddress: artistRuntime,
        artistAddress,
        artistName: 'Runtime artist',
        trackCount: 2,
        trackTitles: ['Shared song', 'Second shared song']
      }
    ]);
  });
});
