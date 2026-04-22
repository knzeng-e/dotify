import { expect } from 'chai';
import hre from 'hardhat';
import { keccak256, stringToBytes } from 'viem';

describe('MusicRightsRegistry (EVM)', function () {
  async function deployFixture() {
    const registry = await hre.viem.deployContract('MusicRightsRegistry');
    const [artist, listener] = await hre.viem.getWalletClients();
    return { registry, artist, listener };
  }

  it('registers a track NFT with access metadata and royalties', async function () {
    const { registry, artist } = await deployFixture();
    const contentHash = keccak256(stringToBytes('track'));

    await registry.write.registerTrack([
      {
        contentHash,
        title: 'Lisbon Signal',
        artistName: 'Dotify Artist',
        description: 'A shared listening track for Lisbon commuters.',
        imageRef: 'ipfs://cover',
        audioRef: 'ipfs://audio',
        metadataRef: 'paseo-bulletin:manifest-track',
        artistContractRef: 'ipfs://artist-contract',
        accessMode: 0,
        pricePlanck: 0n,
        requiredPersonhood: 1
      },
      [artist.account.address],
      [7000]
    ]);

    const trackResult = await registry.read.getTrack([contentHash]);
    const track = trackResult[0];
    expect(track.tokenId).to.equal(1n);
    expect(track.artist.toLowerCase()).to.equal(artist.account.address.toLowerCase());
    expect(track.title).to.equal('Lisbon Signal');
    expect(track.royaltyBps).to.equal(7000);
    expect(track.audioRef).to.equal('ipfs://audio');
    expect(track.metadataRef).to.equal('paseo-bulletin:manifest-track');
    expect(track.artistContractRef).to.equal('ipfs://artist-contract');
    expect(track.accessMode).to.equal(0);
    expect(track.requiredPersonhood).to.equal(1);
    expect(track.active).to.equal(true);
    expect(trackResult[1].toLowerCase()).to.equal(artist.account.address.toLowerCase());

    const split = await registry.read.getRoyaltySplitAt([contentHash, 0n]);
    expect(split[0].toLowerCase()).to.equal(artist.account.address.toLowerCase());
    expect(split[1]).to.equal(7000);
  });

  it('prevents duplicate registrations', async function () {
    const { registry, artist } = await deployFixture();
    const contentHash = keccak256(stringToBytes('track'));

    await registry.write.registerTrack([
      {
        contentHash,
        title: 'One',
        artistName: 'Artist',
        description: 'Description',
        imageRef: 'ipfs://cover',
        audioRef: 'ipfs://audio-one',
        metadataRef: 'paseo-bulletin:manifest-one',
        artistContractRef: 'ipfs://artist-contract-one',
        accessMode: 0,
        pricePlanck: 0n,
        requiredPersonhood: 1
      },
      [artist.account.address],
      [1000]
    ]);

    let failed = false;
    try {
      await registry.write.registerTrack([
        {
          contentHash,
          title: 'Two',
          artistName: 'Artist',
          description: 'Description',
          imageRef: 'ipfs://cover',
          audioRef: 'ipfs://audio-two',
          metadataRef: 'paseo-bulletin:manifest-two',
          artistContractRef: 'ipfs://artist-contract-two',
          accessMode: 0,
          pricePlanck: 0n,
          requiredPersonhood: 1
        },
        [artist.account.address],
        [1000]
      ]);
    } catch {
      failed = true;
    }

    expect(failed).to.equal(true);
  });

  it('keeps human-free transfers gated by Proof of Personhood', async function () {
    const { registry, artist, listener } = await deployFixture();
    const contentHash = keccak256(stringToBytes('human-free-track'));

    await registry.write.registerTrack([
      {
        contentHash,
        title: 'DIM2 Signal',
        artistName: 'Dotify Artist',
        description: 'A human-free track requiring verified individuality.',
        imageRef: 'ipfs://cover',
        audioRef: 'ipfs://audio-human-free',
        metadataRef: 'paseo-bulletin:manifest-human-free',
        artistContractRef: 'ipfs://artist-contract-human-free',
        accessMode: 0,
        pricePlanck: 0n,
        requiredPersonhood: 2
      },
      [artist.account.address],
      [8000]
    ]);

    expect(await registry.read.canAccess([contentHash, listener.account.address])).to.equal(false);

    let failed = false;
    try {
      await registry.write.transferTrack([1n, listener.account.address]);
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);

    await registry.write.setPersonhoodLevel([listener.account.address, 2]);
    expect(await registry.read.canAccess([contentHash, listener.account.address])).to.equal(true);

    await registry.write.transferTrack([1n, listener.account.address]);
    expect((await registry.read.ownerOf([1n])).toLowerCase()).to.equal(listener.account.address.toLowerCase());
  });

  it('requires payment before classic tracks become accessible', async function () {
    const { registry, artist, listener } = await deployFixture();
    const contentHash = keccak256(stringToBytes('classic-track'));

    await registry.write.registerTrack([
      {
        contentHash,
        title: 'Classic Signal',
        artistName: 'Dotify Artist',
        description: 'A paid track with automatic settlement metadata.',
        imageRef: 'ipfs://cover',
        audioRef: 'ipfs://audio-classic',
        metadataRef: 'paseo-bulletin:manifest-classic',
        artistContractRef: 'ipfs://artist-contract-classic',
        accessMode: 1,
        pricePlanck: 10n,
        requiredPersonhood: 0
      },
      [artist.account.address],
      [7000]
    ]);

    expect(await registry.read.canAccess([contentHash, listener.account.address])).to.equal(false);

    await registry.write.payForAccess([contentHash], { account: listener.account, value: 10n });
    expect(await registry.read.canAccess([contentHash, listener.account.address])).to.equal(true);
  });
});
