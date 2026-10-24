import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChainAccessService, type ReleaseKeyIdentity } from './chainAccess.js';
import { RELEASE_BOUND_CONTENT_KEY_VERSION } from './keyVault.js';
import type { CatalogMetadata, CatalogRelease, CatalogSnapshot } from './catalog/index.js';

function makeStreamingRef(cid: string) {
  return `dotify:enc:v3:key-v2:ipfs://${cid}`;
}

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
  return makeStreamingRef(`cid-${runtime.slice(2, 6)}`);
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
    keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION
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
  blockNumber = 102n;
  blockHash = `0x${'66'.repeat(32)}`;
  async getBlock() {
    return { number: this.blockNumber, hash: this.blockHash };
  }
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
    assert.equal(
      client.calls.some(call => call.address === RUNTIME_B),
      false
    );
    assert.equal(
      client.calls.some(call => call.functionName === 'artistCount'),
      false
    );
  });

  it('rejects hash-only access when two releases share a content hash', async () => {
    const releaseA = release({ runtimeAddress: RUNTIME_A, artistAddress: ARTIST_A });
    const releaseB = release({ runtimeAddress: RUNTIME_B, artistAddress: ARTIST_B });
    const { access } = service([releaseA, releaseB]);

    const result = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual' });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
  });

  it('rejects unsupported audio formats even with a full release identity', async () => {
    const releaseA = release({ audioRef: 'dotify:enc:v2:key-v2:ipfs://legacy' });
    const { access } = service([releaseA]);
    const result = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual', release: identity(releaseA) });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_NOT_ENCRYPTED');
  });
  it('requires full identity even for one matching current streaming release', async () => {
    const { access } = service([release()]);
    const result = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual' });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
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
      release: { ...identity(releaseA), audioRef: makeStreamingRef('other-cid') }
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
  });

  it('rejects a release when ArtistDirectory remaps the artist runtime', async () => {
    const releaseA = release();
    const { access, client } = service([releaseA]);
    client.runtimeOf.set(ARTIST_A, RUNTIME_B);

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: identity(releaseA)
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
    assert.equal(
      client.calls.some(call => call.functionName === 'musicAccCanAccess'),
      true
    );
  });

  it('rejects a release when the target runtime audioRef drifts from the catalog', async () => {
    const releaseA = release();
    const { access, client } = service([releaseA]);
    client.releases.set(`${RUNTIME_A}:${HASH}`.toLowerCase(), {
      artist: ARTIST_A,
      audioRef: makeStreamingRef('replaced-cid'),
      active: true
    });

    const result = await access.checkTrackAccess({
      contentHash: HASH,
      requester: REQUESTER,
      purpose: 'individual',
      release: identity(releaseA)
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_IDENTITY_MISMATCH');
    assert.equal(
      client.calls.some(call => call.functionName === 'musicAccCanAccess'),
      true
    );
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

describe('v3 publication access stays canonical', () => {
  it('keeps Classic listener/host denials and Free zero-address authority on the existing key scope', async () => {
    const candidate = release({ audioRef: 'dotify:enc:v3:key-v2:ipfs://Qm4GXs5NdGtLB4UYL2UMo2k9snMQ7g4Brj18qqYZ2aigCG' });
    const { access, client } = service([candidate]);
    const canonical = { ...identity(candidate), keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION };
    const allowed = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual', release: canonical });
    assert.equal(allowed.allowed, true);
    client.access.set(`${RUNTIME_A}:${HASH}:${REQUESTER}`.toLowerCase(), false);
    client.blockNumber++;
    const denied = await access.checkTrackAccess({ contentHash: HASH, requester: REQUESTER, purpose: 'individual', release: canonical });
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal('contentKey' in denied, false);
    const free = release({ audioRef: candidate.audioRef, accessMode: 'free', priceWei: '0', priceDot: '0' });
    const publicService = service([free]);
    publicService.client.access.set(`${RUNTIME_A}:${HASH}:${ZERO_ADDRESS}`.toLowerCase(), true);
    assert.equal(
      (await publicService.access.checkPublicAccess({ contentHash: HASH, release: { ...identity(free), keyVersion: RELEASE_BOUND_CONTENT_KEY_VERSION } }))
        .allowed,
      true
    );
  });
});

describe('W34 block-bound verdicts', () => {
  function fixture() {
    const candidate = release();
    const client = new FakeClient([candidate]);
    let clock = 1000;
    const snap = snapshot([candidate]);
    const meta = metadata();
    const access = createChainAccessService({
      getClient: () => client as never,
      getDirectoryAddress: () => DIRECTORY,
      getChainId: () => CHAIN_ID,
      catalog: new FakeCatalog(snap, meta),
      now: () => clock
    });
    const input = { contentHash: HASH, requester: REQUESTER, purpose: 'individual' as const, release: identity(candidate) };
    return {
      client,
      access,
      input,
      meta,
      advance: (ms: number) => {
        clock += ms;
      }
    };
  }
  it('reuses allow and deny only within 30 seconds at the same observed block', async () => {
    const f = fixture();
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, true);
    assert.equal(f.client.calls.length, 3);
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, true);
    assert.equal(f.client.calls.length, 3);
    f.client.access.clear();
    f.advance(30_000);
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, false);
    assert.equal(f.client.calls.length, 6);
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, false);
    assert.equal(f.client.calls.length, 6);
    f.client.blockNumber++;
    f.client.access.set(`${RUNTIME_A}:${HASH}:${REQUESTER}`.toLowerCase(), true);
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, true);
    assert.equal(f.client.calls.length, 9);
  });
  it('rechecks on same-height reorg and fails closed on a failed head despite a warm allow', async () => {
    const f = fixture();
    await f.access.checkTrackAccess(f.input);
    f.client.blockHash = `0x${'77'.repeat(32)}`;
    f.client.access.clear();
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, false);
    f.client.getBlock = async () => {
      throw new Error('offline');
    };
    const denied = await f.access.checkTrackAccess(f.input);
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.code, 'RPC_UNAVAILABLE');
  });
  it('cannot reuse a verdict across requester, purpose or stale canonical evidence', async () => {
    const f = fixture();
    await f.access.checkTrackAccess(f.input);
    assert.equal((await f.access.checkTrackAccess({ ...f.input, requester: ARTIST_B })).allowed, false);
    const denied = await f.access.checkTrackAccess({ ...f.input, purpose: 'room_host', requester: ARTIST_B });
    if (!denied.allowed) assert.equal(denied.code, 'HOST_ACCESS_REQUIRED');
    f.meta.state = 'stale-cache';
    const stale = await f.access.checkTrackAccess(f.input);
    if (!stale.allowed) assert.equal(stale.code, 'CATALOG_UNAVAILABLE');
    else assert.fail('stale snapshot granted access');
  });
  it('runs all reads concurrently at one block and does not cache RPC failure', async () => {
    const f = fixture();
    const original = f.client.readContract.bind(f.client);
    let releaseReads!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseReads = resolve;
    });
    const started: string[] = [];
    f.client.readContract = async input => {
      const pinned = input as typeof input & { blockHash: string; requireCanonical: boolean };
      assert.equal(pinned.requireCanonical, true);
      started.push(pinned.blockHash);
      await gate;
      return original(input);
    };
    const pending = f.access.checkTrackAccess(f.input);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, [f.client.blockHash, f.client.blockHash, f.client.blockHash]);
    releaseReads();
    assert.equal((await pending).allowed, true);
    f.client.blockNumber++;
    f.client.readContract = async () => {
      throw new Error('RPC');
    };
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, false);
    f.client.readContract = original;
    assert.equal((await f.access.checkTrackAccess(f.input)).allowed, true);
  });
  it('free verdict expires and observes a policy change rather than granting from the catalog', async () => {
    const f = fixture();
    f.client.access.set(`${RUNTIME_A}:${HASH}:${ZERO_ADDRESS}`.toLowerCase(), true);
    const input = { contentHash: HASH, release: f.input.release };
    assert.equal((await f.access.checkPublicAccess(input)).allowed, true);
    f.client.access.clear();
    f.advance(30_000);
    const denied = await f.access.checkPublicAccess(input);
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.code, 'NOT_FREE');
  });
  it('coalesced callers keep the same expiry and both deny if verification outlasts the window', async () => {
    const f = fixture();
    const results = await Promise.all([f.access.checkTrackAccess(f.input), f.access.checkTrackAccess(f.input)]);
    assert.equal(f.client.calls.length, 3);
    for (const result of results) {
      assert.equal(result.allowed, true);
      if (result.allowed) assert.equal(result.validUntil, 31_000);
    }
    const slow = fixture();
    const original = slow.client.readContract.bind(slow.client);
    let settle!: () => void;
    const gate = new Promise<void>(resolve => {
      settle = resolve;
    });
    slow.client.readContract = async input => {
      await gate;
      return original(input);
    };
    const first = slow.access.checkTrackAccess(slow.input);
    const second = slow.access.checkTrackAccess(slow.input);
    await new Promise(resolve => setImmediate(resolve));
    slow.advance(30_000);
    settle();
    for (const result of await Promise.all([first, second])) {
      assert.equal(result.allowed, false);
      if (!result.allowed) assert.equal(result.code, 'RPC_UNAVAILABLE');
    }
  });
  it('inactive runtime and wrong catalog chain cannot receive keys', async () => {
    const f = fixture();
    f.client.releases.get(`${RUNTIME_A}:${HASH}`)!.active = false;
    const result = await f.access.checkTrackAccess(f.input);
    if (!result.allowed) assert.equal(result.code, 'RELEASE_INACTIVE');
    else assert.fail('inactive release allowed');
    const other = createChainAccessService({
      getClient: () => f.client as never,
      getDirectoryAddress: () => DIRECTORY,
      getChainId: () => 1,
      catalog: new FakeCatalog(snapshot([release()]))
    });
    const wrong = await other.checkTrackAccess(f.input);
    if (!wrong.allowed) assert.equal(wrong.code, 'CATALOG_UNAVAILABLE');
    else assert.fail('wrong chain allowed');
  });
});
