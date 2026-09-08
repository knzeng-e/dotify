import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChainAccessService, type ReleaseKeyIdentity } from './chainAccess.js';
import {
  LEGACY_CONTENT_KEY_VERSION,
  RELEASE_BOUND_CONTENT_KEY_VERSION,
  makeReleaseBoundEncryptedAudioV2Ref
} from './keyVault.js';
import type { CatalogMetadata, CatalogRelease, CatalogSnapshot } from './catalog/index.js';

const CHAIN_ID = 420420417;
const DIRECTORY = '0x9999999999999999999999999999999999999999' as const;
const ARTIST_A = '0x1111111111111111111111111111111111111111' as const;
const RUNTIME_A = '0x2222222222222222222222222222222222222222' as const;
const ARTIST_B = '0x3333333333333333333333333333333333333333' as const;
const RUNTIME_B = '0x4444444444444444444444444444444444444444' as const;
const REQUESTER = '0x5555555555555555555555555555555555555555' as const;
const HASH = `0x${'ab'.repeat(32)}` as const;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function audioRef(runtime: string): string {
  return makeReleaseBoundEncryptedAudioV2Ref(`cid-${runtime.slice(2, 6)}`);
}

function release(overrides: Partial<CatalogRelease> = {}): CatalogRelease {
  const runtimeAddress = overrides.runtimeAddress ?? RUNTIME_A;
  const artistAddress = overrides.artistAddress ?? ARTIST_A;
  const hash = overrides.hash ?? HASH;
  return {
    id: `${runtimeAddress}:${hash}`,
    hash,
    runtimeAddress,
    artistAddress,
    tokenId: '1',
    title: 'Canonical track',
    artist: 'Dotify Artist',
    description: 'Description',
    imageRef: 'ipfs://cover',
    coverVariants: ['ipfs://cover'],
    audioRef: audioRef(runtimeAddress),
    metadataRef: 'ipfs://metadata',
    bulletinRef: '',
    artistContractRef: 'ipfs://contract',
    accessMode: 'classic',
    priceWei: '1',
    priceDot: '0.000000000000000001',
    personhoodLevel: 'DIM1',
    active: true,
    encrypted: true,
    royaltyBps: 10_000,
    royaltySplits: [{ label: 'Primary recipient', recipient: artistAddress, bps: 10_000 }],
    registeredAtBlock: 10,
    sourceBlock: 10,
    ...overrides
  } as CatalogRelease;
}

function metadata(overrides: Partial<CatalogMetadata> = {}): CatalogMetadata {
  return {
    state: 'fresh',
    cacheAvailable: true,
    indexedAt: '2026-09-08T00:00:00.000Z',
    lastIndexedBlock: 100,
    chainHeadBlock: 102,
    blockLag: 2,
    staleAfterMs: 60_000,
    lastErrorCode: null,
    ...overrides
  };
}

function snapshot(releases: CatalogRelease[]): CatalogSnapshot {
  return {
    schemaVersion: 1,
    chainId: CHAIN_ID,
    directoryAddress: DIRECTORY,
    lastIndexedBlock: 100,
    lastIndexedBlockHash: `0x${'55'.repeat(32)}`,
    chainHeadBlock: 102,
    indexedAt: '2026-09-08T00:00:00.000Z',
    reconciledAt: '2026-09-08T00:00:00.000Z',
    artists: [
      {
        artistAddress: ARTIST_A,
        runtimeAddress: RUNTIME_A,
        name: 'Artist A',
        releaseCount: 1,
        activeReleaseCount: 1,
        latestReleaseBlock: 10
      },
      {
        artistAddress: ARTIST_B,
        runtimeAddress: RUNTIME_B,
        name: 'Artist B',
        releaseCount: 1,
        activeReleaseCount: 1,
        latestReleaseBlock: 11
      }
    ],
    releases
  };
}

function identity(candidate: CatalogRelease): ReleaseKeyIdentity {
  return {
    releaseId: candidate.id,
    runtimeAddress: candidate.runtimeAddress,
    artistAddress: candidate.artistAddress,
    audioRef: candidate.audioRef,
    keyVersion: candidate.audioRef.startsWith('dotify:enc:v2:key-v2:')
      ? RELEASE_BOUND_CONTENT_KEY_VERSION
      : LEGACY_CONTENT_KEY_VERSION
  };
}

class FakeCatalog {
  constructor(
    private readonly currentSnapshot: CatalogSnapshot | null,
    private readonly currentMetadata: CatalogMetadata = metadata()
  ) {}

  getSnapshot(): CatalogSnapshot | null {
    return this.currentSnapshot;
  }

  getMetadata(): CatalogMetadata {
    return this.currentMetadata;
  }
}

class FakeClient {
  readonly calls: Array<{ address: string; functionName: string; args: readonly unknown[] }> = [];
  runtimeOf = new Map<string, string>([
    [ARTIST_A, RUNTIME_A],
    [ARTIST_B, RUNTIME_B]
  ]);
  access = new Map<string, boolean>([[`${RUNTIME_A}:${HASH}:${REQUESTER}`.toLowerCase(), true]]);
  releases = new Map<string, { artist: string; audioRef: string; active: boolean }>();

  constructor(candidates: CatalogRelease[]) {
    for (const candidate of candidates) {
      this.releases.set(`${candidate.runtimeAddress}:${candidate.hash}`.toLowerCase(), {
        artist: candidate.artistAddress,
        audioRef: candidate.audioRef,
        active: candidate.active
      });
    }
  }

  async readContract(input: { address: string; functionName: string; args?: readonly unknown[] }): Promise<unknown> {
    this.calls.push({ address: input.address, functionName: input.functionName, args: input.args ?? [] });
    if (input.functionName === 'artistCount' || input.functionName === 'artistsPage' || input.functionName === 'musicRegIsRegistered') {
      throw new Error('global scan should not run for canonical release access');
    }
    if (input.functionName === 'runtimeOf') {
      return this.runtimeOf.get(String(input.args?.[0])) ?? ZERO_ADDRESS;
    }
    if (input.functionName === 'musicRegGetTrack') {
      const record = this.releases.get(`${input.address}:${String(input.args?.[0])}`.toLowerCase());
      if (!record) throw new Error('track not found');
      return [
        {
          artist: record.artist,
          tokenId: 1n,
          title: 'Canonical track',
          artistName: 'Dotify Artist',
          description: 'Description',
          imageRef: 'ipfs://cover',
          audioRef: record.audioRef,
          metadataRef: 'ipfs://metadata',
          artistContractRef: 'ipfs://contract',
          royaltyBps: 10_000,
          accessMode: 1,
          pricePlanck: 1n,
          requiredPersonhood: 0,
          registeredAtBlock: 10n,
          active: record.active
        },
        record.artist
      ];
    }
    if (input.functionName === 'musicAccCanAccess') {
      const key = `${input.address}:${String(input.args?.[0])}:${String(input.args?.[1])}`.toLowerCase();
      return this.access.get(key) ?? false;
    }
    throw new Error(`unexpected read ${input.functionName}`);
  }
}

function service(candidates: CatalogRelease[], meta: CatalogMetadata = metadata()) {
  const client = new FakeClient(candidates);
  const access = createChainAccessService({
    getClient: () => client as never,
    getDirectoryAddress: () => DIRECTORY,
    getChainId: () => CHAIN_ID,
    catalog: new FakeCatalog(snapshot(candidates), meta)
  });
  return { access, client };
}

describe('canonical release access', () => {
  it('targets the requested release without scanning unrelated runtimes', async () => {
    const releaseA = release({ runtimeAddress: RUNTIME_A, artistAddress: ARTIST_A, registeredAtBlock: 10 });
    const releaseB = release({ runtimeAddress: RUNTIME_B, artistAddress: ARTIST_B, registeredAtBlock: 11 });
    const { access, client } = service([releaseA, releaseB]);
    client.access.set(`${RUNTIME_A}:${HASH}:${REQUESTER}`.toLowerCase(), true);

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: identity(releaseA)
    });

    assert.equal(result.allowed, true);
    if (!result.allowed) return;
    assert.equal(result.runtime, RUNTIME_A);
    assert.equal(result.keyScope.keyVersion, RELEASE_BOUND_CONTENT_KEY_VERSION);
    assert.equal(result.keyScope.runtimeAddress, RUNTIME_A);
    assert.equal(client.calls.some(call => call.address === RUNTIME_B), false);
    assert.equal(client.calls.some(call => call.functionName === 'artistCount'), false);
  });

  it('rejects hash-only access when two releases share a content hash', async () => {
    const releaseA = release({ runtimeAddress: RUNTIME_A, artistAddress: ARTIST_A });
    const releaseB = release({ runtimeAddress: RUNTIME_B, artistAddress: ARTIST_B });
    const { access } = service([releaseA, releaseB]);

    const result = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual' });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'AMBIGUOUS_RUNTIME');
  });

  it('rejects legacy v1 duplicate hashes even with an explicit release identity', async () => {
    const releaseA = release({ runtimeAddress: RUNTIME_A, artistAddress: ARTIST_A, audioRef: 'dotify:enc:v2:ipfs://cid-a' });
    const releaseB = release({ runtimeAddress: RUNTIME_B, artistAddress: ARTIST_B, audioRef: 'dotify:enc:v2:ipfs://cid-b' });
    const { access } = service([releaseA, releaseB]);

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: identity(releaseA)
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'AMBIGUOUS_RUNTIME');
  });

  it('keeps the legacy hash-only migration path for one fresh catalog match', async () => {
    const releaseA = release({ audioRef: 'dotify:enc:v2:ipfs://legacy-cid' });
    const { access } = service([releaseA]);

    const result = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual' });

    assert.equal(result.allowed, true);
    if (!result.allowed) return;
    assert.equal(result.keyScope.keyVersion, LEGACY_CONTENT_KEY_VERSION);
    assert.equal(result.keyScope.runtimeAddress, RUNTIME_A);
  });

  it('fails closed when the catalog snapshot is stale', async () => {
    const releaseA = release();
    const { access } = service([releaseA], metadata({ state: 'stale-cache' }));

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: identity(releaseA)
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'CATALOG_UNAVAILABLE');
  });

  it('rejects a tampered encrypted object identity before deriving a key', async () => {
    const releaseA = release();
    const { access } = service([releaseA]);

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: { ...identity(releaseA), audioRef: makeReleaseBoundEncryptedAudioV2Ref('other-cid') }
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
  });

  it('checks Free access with the zero address and never with a guest wallet', async () => {
    const releaseA = release({ accessMode: 'free', priceWei: '0', priceDot: '0' });
    const { access, client } = service([releaseA]);
    client.access.set(`${RUNTIME_A}:${HASH}:${ZERO_ADDRESS}`.toLowerCase(), true);

    const result = await access.checkPublicAccess({ contentHash: HASH, release: identity(releaseA) });

    assert.equal(result.allowed, true);
    assert.equal(
      client.calls.some(call => call.functionName === 'musicAccCanAccess' && String(call.args[1]).toLowerCase() === ZERO_ADDRESS),
      true
    );
  });

});
