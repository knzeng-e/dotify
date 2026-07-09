/**
 * Dotify — Artist Smart Runtime test suite (EVM / Hardhat Network)
 *
 * Tests cover:
 *   - Full system deployment (directory + factory + pallets)
 *   - Artist runtime creation via factory
 *   - Directory registration and queries
 *   - One-runtime-per-artist enforcement
 *   - DotifyRuntimeInitializer: personhood registrar bootstrapped to artist
 *   - MusicRegistryPallet: register / deactivate tracks
 *   - MusicRoyaltiesPallet: Classic payment + royalty distribution
 *   - MusicAccessPallet: canAccess, personhood gating
 *   - MusicNFTPallet: ownership, transfer
 *   - Artist isolation: two artists' runtimes share no state
 *   - Forkless upgrade: artist replaces their own music pallet
 */

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';
import { keccak256, toBytes, parseAbiItem, parseEther, type Abi, type AbiFunction } from 'viem';
import { toFunctionSelector } from 'viem';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 } as const;
const AccessMode = { HumanFree: 0, Classic: 1, Free: 2 } as const;
const PersonhoodLevel = { None: 0, DIM1: 1, DIM2: 2 } as const;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const;

function selectorsFromAbi(abi: Abi): `0x${string}`[] {
  return abi.filter((item): item is AbiFunction => item.type === 'function').map(fn => toFunctionSelector(fn));
}

const TRACK_HASH = keccak256(toBytes('dotify:track:001')) as `0x${string}`;
const TRACK_HASH2 = keccak256(toBytes('dotify:track:002')) as `0x${string}`;
const musicRoyRefundedEvent = parseAbiItem('event MusicRoyRefunded(bytes32 indexed contentHash, address indexed listener, uint256 amount)');

function sampleRegistration(
  overrides: Partial<{
    contentHash: `0x${string}`;
    accessMode: number;
    pricePlanck: bigint;
    requiredPersonhood: number;
  }> = {}
) {
  return {
    contentHash: overrides.contentHash ?? TRACK_HASH,
    title: 'Mbanza Signal',
    artistName: 'Kongo Pulse',
    description: 'Afrobeat loop registered on-chain.',
    imageRef: 'ipfs://QmCoverCID',
    audioRef: 'ipfs://QmAudioCID',
    metadataRef: 'paseo-bulletin:abc123',
    artistContractRef: 'dotify:self-certified:' + (overrides.contentHash ?? TRACK_HASH),
    accessMode: overrides.accessMode ?? AccessMode.Classic,
    pricePlanck: overrides.pricePlanck ?? parseEther('0.5'),
    requiredPersonhood: overrides.requiredPersonhood ?? PersonhoodLevel.None
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture — deploys the full Dotify system
// ─────────────────────────────────────────────────────────────────────────────

async function deployDotifySystemFixture() {
  const [deployer, artistA, artistB, listener, royaltyRecip, other] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy shared pallet implementations
  const cutPallet = await hre.viem.deployContract('DiamondCutPallet');
  const loupePallet = await hre.viem.deployContract('DiamondLoupePallet');
  const ownershipPallet = await hre.viem.deployContract('OwnershipPallet');
  const registryPallet = await hre.viem.deployContract('MusicRegistryPallet');
  const nftPallet = await hre.viem.deployContract('MusicNFTPallet');
  const royaltiesPallet = await hre.viem.deployContract('MusicRoyaltiesPallet');
  const accessPallet = await hre.viem.deployContract('MusicAccessPallet');
  const initializer = await hre.viem.deployContract('DotifyRuntimeInitializer');

  // Deploy directory and factory
  const directory = await hre.viem.deployContract('ArtistDirectory');
  const factory = await hre.viem.deployContract('ArtistRuntimeFactory', [
    directory.address,
    initializer.address,
    cutPallet.address,
    loupePallet.address,
    ownershipPallet.address,
    registryPallet.address,
    nftPallet.address,
    royaltiesPallet.address,
    accessPallet.address
  ]);

  // Wire factory
  await directory.write.setFactory([factory.address]);

  const accessArtifact = await hre.artifacts.readArtifact('MusicAccessPallet');
  const registryArtifact = await hre.artifacts.readArtifact('MusicRegistryPallet');

  return {
    directory,
    factory,
    initializer,
    cutPallet,
    loupePallet,
    ownershipPallet,
    registryPallet,
    nftPallet,
    royaltiesPallet,
    accessPallet,
    accessArtifact,
    registryArtifact,
    deployer,
    artistA,
    artistB,
    listener,
    royaltyRecip,
    other,
    publicClient
  };
}

// Helper: create a runtime for an artist and return typed pallet handles
async function createArtistRuntime(
  factory: Awaited<ReturnType<typeof hre.viem.deployContract>>,
  artist: Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number]
) {
  const factoryAsArtist = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artist } });
  const hash = await factoryAsArtist.write.createRuntime();
  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse the ArtistRuntimeCreated event to get the runtime address
  const factoryArtifact = await hre.artifacts.readArtifact('ArtistRuntimeFactory');
  const logs = receipt.logs;
  // ArtistRuntimeCreated(address indexed artist, address indexed runtime)
  // topic[0] = keccak256("ArtistRuntimeCreated(address,address)")
  const runtimeAddr = ('0x' + logs[logs.length - 1].topics[2]!.slice(26)) as `0x${string}`;

  return runtimeAddr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: System deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('Dotify System — Deployment', () => {
  it('directory has factory wired correctly', async () => {
    const { directory, factory } = await loadFixture(deployDotifySystemFixture);
    expect((await directory.read.factory()).toLowerCase()).to.equal(factory.address.toLowerCase());
  });

  it('factory holds correct pallet addresses', async () => {
    const { factory, cutPallet, registryPallet, accessPallet } = await loadFixture(deployDotifySystemFixture);
    expect((await factory.read.cutPallet()).toLowerCase()).to.equal(cutPallet.address.toLowerCase());
    expect((await factory.read.registryPallet()).toLowerCase()).to.equal(registryPallet.address.toLowerCase());
    expect((await factory.read.accessPallet()).toLowerCase()).to.equal(accessPallet.address.toLowerCase());
  });

  it('directory starts empty', async () => {
    const { directory } = await loadFixture(deployDotifySystemFixture);
    expect(await directory.read.artistCount()).to.equal(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Artist runtime creation
// ─────────────────────────────────────────────────────────────────────────────

describe('ArtistRuntimeFactory — createRuntime()', () => {
  it('deploys a SmartRuntime and registers it in the directory', async () => {
    const { factory, directory, artistA } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();

    expect(await directory.read.artistCount()).to.equal(1n);
    const runtime = await directory.read.runtimeOf([artistA.account.address]);
    expect(runtime).to.not.equal(ZERO_ADDR);
  });

  it('factory.runtimeOf returns the same address as directory', async () => {
    const { factory, directory, artistA } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();

    const fromFactory = await factory.read.runtimeOf([artistA.account.address]);
    const fromDirectory = await directory.read.runtimeOf([artistA.account.address]);
    expect(fromFactory.toLowerCase()).to.equal(fromDirectory.toLowerCase());
  });

  it('rejects a second createRuntime() from the same artist', async () => {
    const { factory, artistA } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();

    try {
      await factoryAsA.write.createRuntime();
      expect.fail('Should have reverted');
    } catch (e: unknown) {
      expect((e as Error).message).to.include('already has a runtime');
    }
  });

  it('two different artists each get their own runtime', async () => {
    const { factory, directory, artistA, artistB } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    const factoryAsB = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistB } });
    await factoryAsA.write.createRuntime();
    await factoryAsB.write.createRuntime();

    const runtimeA = await directory.read.runtimeOf([artistA.account.address]);
    const runtimeB = await directory.read.runtimeOf([artistB.account.address]);
    expect(runtimeA.toLowerCase()).to.not.equal(runtimeB.toLowerCase());
    expect(await directory.read.artistCount()).to.equal(2n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Initializer — personhood registrar bootstrap
// ─────────────────────────────────────────────────────────────────────────────

describe('DotifyRuntimeInitializer — bootstrap', () => {
  it('sets personhood registrar to the artist (owner) on creation', async () => {
    const { factory, directory, artistA } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await directory.read.runtimeOf([artistA.account.address])) as `0x${string}`;

    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);
    const registrar = await access.read.musicAccGetRegistrar();
    expect(registrar.toLowerCase()).to.equal(artistA.account.address.toLowerCase());
  });

  it('owner can reassign the personhood registrar and the new registrar can grant levels', async () => {
    const { factory, directory, artistA, other, listener } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await directory.read.runtimeOf([artistA.account.address])) as `0x${string}`;

    const artistAccess = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr, { client: { wallet: artistA } });
    await artistAccess.write.setPersonhoodRegistrar([other.account.address]);

    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);
    expect((await access.read.musicAccGetRegistrar()).toLowerCase()).to.equal(other.account.address.toLowerCase());

    const delegatedRegistrar = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr, { client: { wallet: other } });
    await delegatedRegistrar.write.musicAccSetPersonhoodLevel([listener.account.address, PersonhoodLevel.DIM1]);

    expect(await access.read.musicAccPersonhoodLevel([listener.account.address])).to.equal(PersonhoodLevel.DIM1);
  });

  it('delegated registrar cannot rotate itself; only the owner can update the registrar', async () => {
    const { factory, directory, artistA, other, listener } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await directory.read.runtimeOf([artistA.account.address])) as `0x${string}`;

    const artistAccess = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr, { client: { wallet: artistA } });
    await artistAccess.write.setPersonhoodRegistrar([other.account.address]);

    const delegatedRegistrar = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr, { client: { wallet: other } });

    try {
      await delegatedRegistrar.write.setPersonhoodRegistrar([listener.account.address]);
      expect.fail('Should have reverted');
    } catch (e: unknown) {
      expect((e as Error).message).to.include('MusicAccess: not owner');
    }
  });

  it('artist is also the SmartRuntime owner', async () => {
    const { factory, directory, artistA } = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await directory.read.runtimeOf([artistA.account.address])) as `0x${string}`;

    const ownership = await hre.viem.getContractAt('OwnershipPallet', runtimeAddr);
    const owner = await ownership.read.owner();
    expect(owner.toLowerCase()).to.equal(artistA.account.address.toLowerCase());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Music pallets on a live artist runtime
// ─────────────────────────────────────────────────────────────────────────────

describe('Artist SmartRuntime — music pallets', () => {
  async function withArtistRuntime() {
    const ctx = await loadFixture(deployDotifySystemFixture);
    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;

    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddr);
    const nft = await hre.viem.getContractAt('MusicNFTPallet', runtimeAddr);
    const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtimeAddr);
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);
    const cut = await hre.viem.getContractAt('DiamondCutPallet', runtimeAddr);

    return { ...ctx, runtimeAddr, registry, nft, royalties, access, cut };
  }

  it('registers a Classic track on the artist SmartRuntime', async () => {
    const { registry, nft, artistA, royaltyRecip } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration(), [royaltyRecip.account.address], [10_000]]);

    expect(await registry.read.musicRegIsRegistered([TRACK_HASH])).to.equal(true);
    const [track, owner] = await registry.read.musicRegGetTrack([TRACK_HASH]);
    expect(track.artist.toLowerCase()).to.equal(artistA.account.address.toLowerCase());
    expect(owner.toLowerCase()).to.equal(artistA.account.address.toLowerCase());
  });

  it('listener pays for access and royalties are distributed', async () => {
    const PRICE = parseEther('0.5');
    const { registry, royalties, access, artistA, listener, royaltyRecip, publicClient } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration({ pricePlanck: PRICE }), [royaltyRecip.account.address], [8_000]]);

    const recipBefore = await publicClient.getBalance({ address: royaltyRecip.account.address });

    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });

    expect(await access.read.musicAccHasPaid([TRACK_HASH, listener.account.address])).to.equal(true);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, listener.account.address])).to.equal(true);
    expect((await publicClient.getBalance({ address: royaltyRecip.account.address })) > recipBefore).to.equal(true);
  });

  it('HumanFree track: access granted after artist sets DIM1 personhood', async () => {
    const { registry, royalties, access, artistA, listener, royaltyRecip } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([
      sampleRegistration({
        contentHash: TRACK_HASH2,
        accessMode: AccessMode.HumanFree,
        pricePlanck: 0n,
        requiredPersonhood: PersonhoodLevel.DIM1
      }),
      [royaltyRecip.account.address],
      [10_000]
    ]);

    expect(await access.read.musicAccCanAccess([TRACK_HASH2, listener.account.address])).to.equal(false);

    // Artist is the registrar (bootstrapped by initializer) — grant DIM1
    const artistAccess = await hre.viem.getContractAt('MusicAccessPallet', access.address, { client: { wallet: artistA } });
    await artistAccess.write.musicAccSetPersonhoodLevel([listener.account.address, PersonhoodLevel.DIM1]);

    expect(await access.read.musicAccCanAccess([TRACK_HASH2, listener.account.address])).to.equal(true);
  });

  it('NFT owner is the artist; NFT transfer moves ownership', async () => {
    const { registry, nft, artistA, other, royaltyRecip } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration(), [royaltyRecip.account.address], [10_000]]);

    expect((await nft.read.musicNFTOwnerOf([1n])).toLowerCase()).to.equal(artistA.account.address.toLowerCase());

    const artistNft = await hre.viem.getContractAt('MusicNFTPallet', nft.address, { client: { wallet: artistA } });
    await artistNft.write.musicNFTTransfer([1n, other.account.address]);

    expect((await nft.read.musicNFTOwnerOf([1n])).toLowerCase()).to.equal(other.account.address.toLowerCase());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Access model v2 - Free mode and artist-driven mode changes
// ─────────────────────────────────────────────────────────────────────────────

describe('Access model v2 - Free mode + musicRegSetAccessMode', () => {
  const trackAccessModeChangedEvent = parseAbiItem(
    'event TrackAccessModeChanged(bytes32 indexed contentHash, address indexed artist, uint8 accessMode, uint128 pricePlanck, uint8 requiredPersonhood)'
  );

  // No chai-as-promised in this suite: assert reverts via the house pattern.
  async function expectRevert(promise: Promise<unknown>, fragment: string) {
    try {
      await promise;
      expect.fail('Should have reverted');
    } catch (e: unknown) {
      expect((e as Error).message).to.include(fragment);
    }
  }

  async function withArtistRuntime() {
    const ctx = await loadFixture(deployDotifySystemFixture);
    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;

    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddr);
    const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtimeAddr);
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);
    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddr, { client: { wallet: ctx.artistA } });

    return { ...ctx, runtimeAddr, registry, royalties, access, artistRegistry };
  }

  it('registers a Free track (no price, no personhood) and everyone can access it', async () => {
    const { artistRegistry, access, listener, other, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([
      sampleRegistration({ accessMode: AccessMode.Free, pricePlanck: 0n, requiredPersonhood: PersonhoodLevel.None }),
      [royaltyRecip.account.address],
      [10_000]
    ]);

    expect(await access.read.musicAccCanAccess([TRACK_HASH, listener.account.address])).to.equal(true);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, other.account.address])).to.equal(true);
  });

  it('normalizes price and personhood to zero for Free registrations', async () => {
    const { artistRegistry, registry, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([
      sampleRegistration({ accessMode: AccessMode.Free, pricePlanck: parseEther('1'), requiredPersonhood: PersonhoodLevel.DIM2 }),
      [royaltyRecip.account.address],
      [10_000]
    ]);

    const [track] = await registry.read.musicRegGetTrack([TRACK_HASH]);
    expect(track.accessMode).to.equal(AccessMode.Free);
    expect(track.pricePlanck).to.equal(0n);
    expect(track.requiredPersonhood).to.equal(PersonhoodLevel.None);
  });

  it('rejects payment for a Free track', async () => {
    const { artistRegistry, royalties, listener, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([
      sampleRegistration({ accessMode: AccessMode.Free, pricePlanck: 0n }),
      [royaltyRecip.account.address],
      [10_000]
    ]);

    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await expectRevert(listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: parseEther('0.5') }), 'not a Classic track');
  });

  it('artist flips Classic -> Free without re-registering; past buyers survive a flip back', async () => {
    const PRICE = parseEther('0.5');
    const { artistRegistry, royalties, access, listener, other, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([sampleRegistration({ pricePlanck: PRICE }), [royaltyRecip.account.address], [10_000]]);

    // Listener buys while Classic; `other` never pays.
    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });
    expect(await access.read.musicAccCanAccess([TRACK_HASH, other.account.address])).to.equal(false);

    // Flip to Free: everyone can listen, ciphertext untouched (same record).
    await artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Free, 0n, PersonhoodLevel.None]);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, other.account.address])).to.equal(true);

    // Flip back to Classic: the past buyer keeps access, the stranger loses it.
    await artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Classic, PRICE, PersonhoodLevel.None]);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, listener.account.address])).to.equal(true);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, other.account.address])).to.equal(false);
  });

  it('only the artist can change the access mode', async () => {
    const { artistRegistry, registry, other, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([sampleRegistration(), [royaltyRecip.account.address], [10_000]]);

    const otherRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: other } });
    await expectRevert(otherRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Free, 0n, PersonhoodLevel.None]), 'not artist');
  });

  it('validates the new policy on mode change (Classic price, HumanFree personhood)', async () => {
    const { artistRegistry, royaltyRecip } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([sampleRegistration(), [royaltyRecip.account.address], [10_000]]);

    await expectRevert(artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Classic, 0n, PersonhoodLevel.None]), 'Classic requires price');
    await expectRevert(
      artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.HumanFree, 0n, PersonhoodLevel.None]),
      'HumanFree requires personhood level'
    );
  });

  it('rejects mode changes on inactive tracks and emits the change event', async () => {
    const { artistRegistry, publicClient, royaltyRecip, runtimeAddr } = await withArtistRuntime();

    await artistRegistry.write.musicRegRegister([sampleRegistration(), [royaltyRecip.account.address], [10_000]]);

    const hash = await artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Free, 0n, PersonhoodLevel.None]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = await publicClient.getLogs({
      address: runtimeAddr,
      event: trackAccessModeChangedEvent,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber
    });
    expect(logs.length).to.equal(1);
    expect(logs[0].args.accessMode).to.equal(AccessMode.Free);

    await artistRegistry.write.musicRegDeactivate([TRACK_HASH]);
    await expectRevert(artistRegistry.write.musicRegSetAccessMode([TRACK_HASH, AccessMode.Classic, parseEther('1'), PersonhoodLevel.None]), 'inactive');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Artist isolation — two artists' storage is fully separate
// ─────────────────────────────────────────────────────────────────────────────

describe('Artist isolation', () => {
  it('tracks registered on artist A are invisible on artist B runtime', async () => {
    const ctx = await loadFixture(deployDotifySystemFixture);

    // Create runtimes for both artists
    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    const factoryAsB = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistB } });
    await factoryAsA.write.createRuntime();
    await factoryAsB.write.createRuntime();

    const runtimeAddrA = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;
    const runtimeAddrB = (await ctx.directory.read.runtimeOf([ctx.artistB.account.address])) as `0x${string}`;

    const registryA = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddrA, { client: { wallet: ctx.artistA } });
    await registryA.write.musicRegRegister([sampleRegistration(), [ctx.royaltyRecip.account.address], [10_000]]);

    // Same hash is not registered on B's runtime
    const registryB = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddrB);
    expect(await registryB.read.musicRegIsRegistered([TRACK_HASH])).to.equal(false);
    expect(await registryB.read.musicRegTrackCount()).to.equal(0n);
  });

  it('personhood granted on artist A has no effect on artist B', async () => {
    const ctx = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    const factoryAsB = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistB } });
    await factoryAsA.write.createRuntime();
    await factoryAsB.write.createRuntime();

    const runtimeAddrA = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;
    const runtimeAddrB = (await ctx.directory.read.runtimeOf([ctx.artistB.account.address])) as `0x${string}`;

    // Artist A grants listener DIM1
    const accessA = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddrA, { client: { wallet: ctx.artistA } });
    await accessA.write.musicAccSetPersonhoodLevel([ctx.listener.account.address, PersonhoodLevel.DIM1]);

    // Listener's level on B's runtime is still None
    const accessB = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddrB);
    expect(await accessB.read.musicAccPersonhoodLevel([ctx.listener.account.address])).to.equal(PersonhoodLevel.None);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Forkless upgrade — artist replaces their own music pallet
// ─────────────────────────────────────────────────────────────────────────────

describe('Forkless upgrade — artist replaces their MusicAccessPallet', () => {
  it('replaces access pallet without losing track registry state', async () => {
    const ctx = await loadFixture(deployDotifySystemFixture);
    const { accessArtifact } = ctx;

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;

    // Register a track first
    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddr, { client: { wallet: ctx.artistA } });
    await registry.write.musicRegRegister([sampleRegistration(), [ctx.royaltyRecip.account.address], [10_000]]);
    expect(await registry.read.musicRegIsRegistered([TRACK_HASH])).to.equal(true);

    // Deploy a new access pallet implementation (same code — proves storage survival)
    const newAccessPallet = await hre.viem.deployContract('MusicAccessPallet');

    // Artist uses diamondCut to replace
    const cut = await hre.viem.getContractAt('DiamondCutPallet', runtimeAddr, { client: { wallet: ctx.artistA } });
    await cut.write.diamondCut([
      [{ facetAddress: newAccessPallet.address, action: FacetCutAction.Replace, functionSelectors: selectorsFromAbi(accessArtifact.abi as Abi) }],
      ZERO_ADDR,
      '0x'
    ]);

    // Registry state is intact after upgrade
    expect(await registry.read.musicRegIsRegistered([TRACK_HASH])).to.equal(true);

    // Access logic still works through new pallet
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, ctx.artistA.account.address])).to.equal(true);
    expect(await access.read.musicAccCanAccess([TRACK_HASH, ctx.listener.account.address])).to.equal(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Royalties payment security (adversarial)
// ─────────────────────────────────────────────────────────────────────────────

describe('MusicRoyaltiesPallet — payment security', () => {
  async function withArtistRuntime() {
    const ctx = await loadFixture(deployDotifySystemFixture);
    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    await factoryAsA.write.createRuntime();
    const runtimeAddr = (await ctx.directory.read.runtimeOf([ctx.artistA.account.address])) as `0x${string}`;

    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtimeAddr);
    const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtimeAddr);
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtimeAddr);

    return { ...ctx, runtimeAddr, registry, royalties, access };
  }

  it('second musicRoyPayAccess for same listener+contentHash reverts with already-paid', async () => {
    const PRICE = parseEther('0.5');
    const { registry, royalties, artistA, listener, royaltyRecip } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration({ pricePlanck: PRICE }), [royaltyRecip.account.address], [10_000]]);

    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });

    try {
      await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });
      expect.fail('Should have reverted');
    } catch (e: unknown) {
      expect((e as Error).message).to.include('MusicRoyalties: already paid');
    }
  });

  it('overpayment is refunded: listener pays exactly price (+gas); recipients get exactly their split', async () => {
    const PRICE = parseEther('0.5');
    const OVERPAY = parseEther('1.5'); // 1.0 excess to be refunded
    const { registry, royalties, artistA, listener, royaltyRecip, other, publicClient } = await withArtistRuntime();

    // Two recipients: 70% / 30% of the price.
    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([
      sampleRegistration({ pricePlanck: PRICE }),
      [royaltyRecip.account.address, other.account.address],
      [7_000, 3_000]
    ]);

    const recip1Before = await publicClient.getBalance({ address: royaltyRecip.account.address });
    const recip2Before = await publicClient.getBalance({ address: other.account.address });
    const listenerBefore = await publicClient.getBalance({ address: listener.account.address });

    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    const txHash = await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: OVERPAY });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    const refundEvents = await publicClient.getLogs({
      address: royalties.address,
      event: musicRoyRefundedEvent,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber
    });

    const recip1After = await publicClient.getBalance({ address: royaltyRecip.account.address });
    const recip2After = await publicClient.getBalance({ address: other.account.address });
    const listenerAfter = await publicClient.getBalance({ address: listener.account.address });

    // Recipients receive exactly their split of the PRICE, not of msg.value.
    expect(recip1After - recip1Before).to.equal((PRICE * 7_000n) / 10_000n);
    expect(recip2After - recip2Before).to.equal((PRICE * 3_000n) / 10_000n);

    // Listener is out exactly PRICE plus gas; the 1.0 overpayment is refunded.
    expect(listenerBefore - listenerAfter).to.equal(PRICE + gasCost);
    expect(refundEvents).to.have.lengthOf(1);
    expect(refundEvents[0].args.contentHash).to.equal(TRACK_HASH);
    expect(refundEvents[0].args.listener?.toLowerCase()).to.equal(listener.account.address.toLowerCase());
    expect(refundEvents[0].args.amount).to.equal(OVERPAY - PRICE);
  });

  it('reentrancy: a malicious royalty recipient that re-enters for another track cannot bypass the guard', async () => {
    const PRICE = parseEther('0.5');
    const ctx = await withArtistRuntime();
    const { registry, royalties, access, artistA, listener } = ctx;

    // Deploy the malicious recipient and register track 1 paying it 100%.
    const evil = await hre.viem.deployContract('ReentrantRoyaltyRecipient');

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration({ contentHash: TRACK_HASH, pricePlanck: PRICE }), [evil.address], [10_000]]);
    // A second Classic track the attacker tries to re-enter for.
    await artistRegistry.write.musicRegRegister([sampleRegistration({ contentHash: TRACK_HASH2, pricePlanck: PRICE }), [artistA.account.address], [10_000]]);

    // Arm the attacker to re-enter musicRoyPayAccess(TRACK_HASH2) when it receives funds.
    await evil.write.configure([royalties.address, TRACK_HASH2]);

    // Outer payment for TRACK_HASH completes cleanly (recipient swallows the failed re-entry).
    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });

    // The attacker DID attempt re-entry, and it FAILED (guard held).
    expect(await evil.read.attempted()).to.equal(true);
    expect(await evil.read.reenterSucceeded()).to.equal(false);

    // Outer payment still granted access for TRACK_HASH; no access leaked for TRACK_HASH2.
    expect(await access.read.musicAccHasPaid([TRACK_HASH, listener.account.address])).to.equal(true);
    expect(await access.read.musicAccHasPaid([TRACK_HASH2, evil.address])).to.equal(false);
  });

  it('musicAccCanAccess returns false after musicRegDeactivate (fail-closed on inactive track)', async () => {
    const PRICE = parseEther('0.5');
    const { registry, royalties, access, artistA, listener, royaltyRecip } = await withArtistRuntime();

    const artistRegistry = await hre.viem.getContractAt('MusicRegistryPallet', registry.address, { client: { wallet: artistA } });
    await artistRegistry.write.musicRegRegister([sampleRegistration({ pricePlanck: PRICE }), [royaltyRecip.account.address], [10_000]]);

    const listenerRoyalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', royalties.address, { client: { wallet: listener } });
    await listenerRoyalties.write.musicRoyPayAccess([TRACK_HASH], { value: PRICE });
    expect(await access.read.musicAccCanAccess([TRACK_HASH, listener.account.address])).to.equal(true);

    // Artist deactivates the track.
    await artistRegistry.write.musicRegDeactivate([TRACK_HASH]);

    // Access is now denied even though the listener previously paid.
    expect(await access.read.musicAccCanAccess([TRACK_HASH, listener.account.address])).to.equal(false);
    // Payment record itself is preserved (deactivation does not refund/revoke history).
    expect(await access.read.musicAccHasPaid([TRACK_HASH, listener.account.address])).to.equal(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Directory pagination
// ─────────────────────────────────────────────────────────────────────────────

describe('ArtistDirectory — pagination', () => {
  it('artistsPage returns correct slices', async () => {
    const ctx = await loadFixture(deployDotifySystemFixture);

    const factoryAsA = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistA } });
    const factoryAsB = await hre.viem.getContractAt('ArtistRuntimeFactory', ctx.factory.address, { client: { wallet: ctx.artistB } });
    await factoryAsA.write.createRuntime();
    await factoryAsB.write.createRuntime();

    const [artists, runtimes] = await ctx.directory.read.artistsPage([0n, 10n]);
    expect(artists.length).to.equal(2);
    expect(runtimes.length).to.equal(2);
    expect(artists[0].toLowerCase()).to.equal(ctx.artistA.account.address.toLowerCase());
    expect(artists[1].toLowerCase()).to.equal(ctx.artistB.account.address.toLowerCase());
  });
});
