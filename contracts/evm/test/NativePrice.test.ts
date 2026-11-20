import { expect } from 'chai';
import hre from 'hardhat';
import { keccak256, toBytes, toFunctionSelector, zeroAddress } from 'viem';
import { nativeTokenDecimalsForDeployment } from '../scripts/smartRuntime';

const hash = (id: string) => keccak256(toBytes(id));
const registration = (id: string, price: bigint) => ({
  contentHash: hash(id),
  title: 'Exact price',
  artistName: 'Artist',
  description: 'Music',
  imageRef: 'ipfs://cover',
  audioRef: 'ipfs://audio',
  metadataRef: 'ipfs://metadata',
  artistContractRef: 'dotify:self-certified',
  accessMode: 1,
  pricePlanck: price,
  requiredPersonhood: 0
});
async function rejects(call: Promise<unknown>, fragment: string) {
  let error: unknown;
  try {
    await call;
  } catch (e) {
    error = e;
  }
  expect(String(error)).to.include(fragment);
}
async function system(decimals = 10) {
  const [artist, listener] = await hre.viem.getWalletClients();
  const facets = [];
  for (const name of [
    'DiamondCutPallet',
    'DiamondLoupePallet',
    'OwnershipPallet',
    'MusicRegistryPallet',
    'MusicRoyaltiesPallet',
    'MusicAccessPallet',
    'MusicMetadataPallet'
  ])
    facets.push(await hre.viem.deployContract(name));
  const directory = await hre.viem.deployContract('ArtistDirectory');
  const initializer = await hre.viem.deployContract('DotifyRuntimeInitializer');
  const factory = await hre.viem.deployContract('ArtistRuntimeFactory', [
    directory.address,
    initializer.address,
    ...facets.map(f => f.address),
    decimals
  ] as never);
  await directory.write.setFactory([factory.address]);
  await factory.write.createRuntime();
  for (let i = 0; i < 7; i++) await factory.write.installRuntimeStep();
  const runtime = await factory.read.runtimeOf([artist.account.address]);
  const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime);
  return { artist, listener, factory, runtime, registry };
}

describe('A07 exact native-compatible prices without NFTs', () => {
  it('requires an explicit native deployment precision instead of inferring it from EVM decimals', () => {
    const previous = process.env.DOTIFY_NATIVE_TOKEN_DECIMALS;
    try {
      for (const raw of [undefined, '', '19', '-1', '1e1', '10.5']) {
        if (raw === undefined) delete process.env.DOTIFY_NATIVE_TOKEN_DECIMALS;
        else process.env.DOTIFY_NATIVE_TOKEN_DECIMALS = raw;
        expect(() => nativeTokenDecimalsForDeployment()).to.throw('explicitly');
      }
      process.env.DOTIFY_NATIVE_TOKEN_DECIMALS = '10';
      expect(nativeTokenDecimalsForDeployment()).to.equal(10);
    } finally {
      if (previous === undefined) delete process.env.DOTIFY_NATIVE_TOKEN_DECIMALS;
      else process.env.DOTIFY_NATIVE_TOKEN_DECIMALS = previous;
    }
  });
  it('rejects unsupported native precision when creating the factory', async () => {
    await rejects(system(19), 'unsupported native decimals');
  });

  for (const decimals of [0, 10, 12, 18]) {
    it(`accepts the smallest native unit and the largest representable uint128 price at ${decimals} decimals`, async () => {
      const f = await system(decimals);
      expect(await f.factory.read.nativeTokenDecimals()).to.equal(decimals);
      expect(await f.registry.read.musicRegNativeDecimals()).to.equal(decimals);
      const quantum = 10n ** BigInt(18 - decimals);
      const largest = (((1n << 128n) - 1n) / quantum) * quantum;
      for (const [id, price] of [
        ['minimum', quantum],
        ['maximum', largest]
      ] as const) {
        const reg = registration(id, price);
        await f.registry.write.musicRegRegister([reg, [f.artist.account.address], [10000]]);
        expect((await f.registry.read.musicRegGetTrack([reg.contentHash])).pricePlanck).to.equal(price);
      }
    });
  }

  it('rejects unrepresentable registration and edits atomically, then settles the exact smallest price', async () => {
    const f = await system();
    const q = 100_000_000n;
    for (const price of [0n, q - 1n, q + 1n]) {
      await rejects(
        f.registry.write.musicRegRegister([registration(String(price), price), [f.artist.account.address], [10000]]),
        price === 0n ? 'Classic requires price' : 'unrepresentable price'
      );
    }
    expect(await f.registry.read.musicRegTrackCount()).to.equal(0n);
    const reg = registration('valid', q);
    await f.registry.write.musicRegRegister([reg, [f.artist.account.address], [10000]]);
    const before = await f.registry.read.musicRegGetTrack([reg.contentHash]);
    await rejects(f.registry.write.musicRegSetAccessMode([reg.contentHash, 1, q + 1n, 0]), 'unrepresentable price');
    expect(await f.registry.read.musicRegGetTrack([reg.contentHash])).to.deep.equal(before);
    const access = await hre.viem.getContractAt('MusicAccessPallet', f.runtime);
    expect(await access.read.musicAccCanAccess([reg.contentHash, f.listener.account.address])).to.equal(false);
    const client = await hre.viem.getPublicClient();
    const balance = await client.getBalance({ address: f.artist.account.address });
    const payer = await hre.viem.getContractAt('MusicRoyaltiesPallet', f.runtime, { client: { wallet: f.listener } });
    await payer.write.musicRoyPayAccess([reg.contentHash], { value: q });
    expect((await client.getBalance({ address: f.artist.account.address })) - balance).to.equal(q);
    expect(await access.read.musicAccCanAccess([reg.contentHash, f.listener.account.address])).to.equal(true);
  });

  it('installs no NFT selectors, advertises no ERC721 interface and emits no mint at registration', async () => {
    const f = await system();
    const loupe = await hre.viem.getContractAt('DiamondLoupePallet', f.runtime);
    for (const signature of [
      'musicNFTTransfer(uint256,address)',
      'musicNFTOwnerOf(uint256)',
      'musicNFTApprove(address,uint256)',
      'musicNFTSetApprovalForAll(address,bool)',
      'musicNFTBalanceOf(address)',
      'musicNFTGetApproved(uint256)',
      'musicNFTIsApprovedForAll(address,address)',
      'musicRegGetTrackByTokenId(uint256)',
      'ownerOf(uint256)',
      'safeTransferFrom(address,address,uint256)'
    ]) {
      expect(await loupe.read.facetAddress([toFunctionSelector(signature)])).to.equal(zeroAddress);
    }
    expect(await loupe.read.supportsInterface(['0x80ac58cd'])).to.equal(false);
    const reg = registration('no-token', 100_000_000n);
    const tx = await f.registry.write.musicRegRegister([reg, [f.artist.account.address], [10000]]);
    const receipt = await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: tx });
    const nftTopics = ['Transfer(address,address,uint256)', 'MusicNFTTransfer(address,address,uint256)'].map(s => keccak256(toBytes(s)));
    expect(receipt.logs.some(log => nftTopics.includes(log.topics[0]!))).to.equal(false);
    expect(await f.registry.read.musicRegGetTrack([reg.contentHash])).not.to.have.property('tokenId');
  });
});
