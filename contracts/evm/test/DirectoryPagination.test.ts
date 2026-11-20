import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';
import { getAddress, maxUint256 } from 'viem';

const address = (value: number) => getAddress(`0x${value.toString(16).padStart(40, '0')}`);
async function emptyDirectory() {
  const [factory] = await hre.viem.getWalletClients();
  const directory = await hre.viem.deployContract('ArtistDirectory');
  await directory.write.setFactory([factory.account.address]);
  return { directory };
}
async function populatedDirectory() {
  const { directory } = await emptyDirectory();
  const artists = Array.from({ length: 207 }, (_, i) => address(1000 + i));
  const runtimes = artists.map((_, i) => address(2000 + i));
  for (let i = 0; i < artists.length; i++) await directory.write.register([artists[i], runtimes[i]]);
  return { directory, artists, runtimes };
}

describe('A08 bounded ArtistDirectory pagination', () => {
  it('returns paired empty arrays for an empty directory at ordinary and maximum offsets/limits', async () => {
    const { directory } = await loadFixture(emptyDirectory);
    expect(await directory.read.artistCount()).to.equal(0n);
    for (const offset of [0n, 1n, maxUint256]) {
      for (const limit of [0n, 1n, 100n, maxUint256]) {
        expect(await directory.read.artistsPage([offset, limit])).to.deep.equal([[], []]);
      }
    }
  });

  it('returns empty for zero limits or offsets at/past the end without overflow', async () => {
    const { directory, artists } = await loadFixture(populatedDirectory);
    for (const offset of [0n, 1n, BigInt(artists.length - 1), BigInt(artists.length), BigInt(artists.length + 1), maxUint256 - 1n, maxUint256]) {
      expect(await directory.read.artistsPage([offset, 0n])).to.deep.equal([[], []]);
      if (offset >= BigInt(artists.length)) expect(await directory.read.artistsPage([offset, maxUint256])).to.deep.equal([[], []]);
    }
  });

  it('handles offset 1 with uint256 maximum limit without an arithmetic panic', async () => {
    const { directory, artists, runtimes } = await loadFixture(populatedDirectory);
    expect(await directory.read.artistsPage([1n, maxUint256])).to.deep.equal([artists.slice(1, 101), runtimes.slice(1, 101)]);
  });

  it('clamps limits to 100 and the remaining entries, including the offset-1/uint256-max reproduction', async () => {
    const { directory, artists, runtimes } = await loadFixture(populatedDirectory);
    for (const offset of [0, 1, 107, 206]) {
      for (const limit of [1n, 99n, 100n, 101n, 207n, maxUint256]) {
        const length = Number(limit < 100n ? limit : 100n);
        expect(await directory.read.artistsPage([BigInt(offset), limit]), `offset ${offset}, limit ${limit}`).to.deep.equal([
          artists.slice(offset, offset + length),
          runtimes.slice(offset, offset + length)
        ]);
      }
    }
  });

  it('traverses capped pages without loss, duplication or broken artist/runtime pairing', async () => {
    const { directory, artists, runtimes } = await loadFixture(populatedDirectory);
    const collectedArtists = [],
      collectedRuntimes = [],
      lengths = [];
    let offset = 0n;
    while (offset < (await directory.read.artistCount())) {
      const [pageArtists, pageRuntimes] = await directory.read.artistsPage([offset, maxUint256]);
      expect(pageArtists.length).to.be.greaterThan(0).and.at.most(100);
      expect(pageRuntimes.length).to.equal(pageArtists.length);
      collectedArtists.push(...pageArtists);
      collectedRuntimes.push(...pageRuntimes);
      lengths.push(pageArtists.length);
      offset += BigInt(pageArtists.length);
    }
    expect(lengths).to.deep.equal([100, 100, 7]);
    expect(collectedArtists).to.deep.equal(artists);
    expect(collectedRuntimes).to.deep.equal(runtimes);
    expect(new Set(collectedArtists).size).to.equal(artists.length);
    expect(await directory.read.runtimeOf([artists[100]])).to.equal(runtimes[100]);
    expect(await directory.read.artistAtIndex([206n])).to.equal(artists[206]);
  });
});
