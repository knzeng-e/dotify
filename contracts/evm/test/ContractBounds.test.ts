import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';
import { keccak256, toBytes, toFunctionSelector, zeroAddress, maxUint256, getAddress, type Abi, type AbiFunction } from 'viem';

const selectors = (abi: Abi) => abi.filter((x): x is AbiFunction => x.type === 'function').map(toFunctionSelector);
const hash = (id: string) => keccak256(toBytes(id));
const registration = (id = 'one') => ({
  contentHash: hash(id),
  title: 'Music',
  artistName: 'Artist',
  description: 'Story',
  imageRef: 'ipfs://cover',
  audioRef: 'ipfs://audio',
  metadataRef: 'ipfs://metadata',
  artistContractRef: 'ipfs://rights',
  accessMode: 1,
  pricePlanck: 10000n,
  requiredPersonhood: 0
});
async function rejects(promise: Promise<unknown>, message: string) {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(String(error)).to.include(message);
}
async function fixture() {
  const [owner, listener, stranger] = await hre.viem.getWalletClients();
  const names = [
    'DiamondCutPallet',
    'DiamondLoupePallet',
    'OwnershipPallet',
    'MusicRegistryPallet',
    'MusicNFTPallet',
    'MusicRoyaltiesPallet',
    'MusicAccessPallet',
    'MusicMetadataPallet'
  ];
  const cuts = [];
  const allSelectors: string[] = [];
  for (const name of names) {
    const facet = await hre.viem.deployContract(name);
    const abi = (await hre.artifacts.readArtifact(name)).abi;
    const functionSelectors = selectors(abi);
    allSelectors.push(...functionSelectors);
    cuts.push({ facetAddress: facet.address, action: 0, functionSelectors });
  }
  expect(new Set(allSelectors).size).to.equal(allSelectors.length);
  const runtime = await hre.viem.deployContract('SmartRuntime', [owner.account.address, cuts, zeroAddress, '0x']);
  const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime.address, { client: { wallet: owner } });
  const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtime.address, { client: { wallet: listener } });
  return { owner, listener, stranger, runtime, registry, royalties, client: await hre.viem.getPublicClient() };
}
const current = () => fixture();

describe('W38 bounded registrations and compatible upgrades', () => {
  for (const [field, limit] of Object.entries({
    title: 800,
    artistName: 800,
    description: 8000,
    imageRef: 512,
    audioRef: 512,
    metadataRef: 512,
    artistContractRef: 512
  })) {
    it(`${field}: accepts the byte boundary and rejects one extra byte before minting`, async () => {
      const { registry, owner } = await loadFixture(current);
      const valid = { ...registration(), [field]: 'é'.repeat(limit / 2) };
      await registry.write.musicRegRegister([valid, [owner.account.address], [10000]]);
      expect((await registry.read.musicRegGetTrack([valid.contentHash]))[0][field as keyof typeof valid]).to.equal(valid[field as keyof typeof valid]);
      await rejects(
        registry.write.musicRegRegister([
          { ...valid, contentHash: hash('extra'), [field]: valid[field as keyof typeof valid] + 'x' },
          [owner.account.address],
          [10000]
        ]),
        `${field} too long`
      );
      expect(await registry.read.musicRegTrackCount()).to.equal(1n);
      expect(await registry.read.musicRegIsRegistered([hash('extra')])).to.equal(false);
    });
  }
  it('caps all split entries, even duplicate recipients; preserves zero/length validation', async () => {
    const { registry, owner } = await loadFixture(current);
    await registry.write.musicRegRegister([registration(), Array(16).fill(owner.account.address), Array(16).fill(625)]);
    await rejects(registry.write.musicRegRegister([registration('bad'), Array(17).fill(owner.account.address), Array(17).fill(1)]), 'too many recipients');
    await rejects(registry.write.musicRegRegister([registration('zero'), [], []]), 'no splits');
    await rejects(registry.write.musicRegRegister([registration('mismatch'), [owner.account.address], []]), 'length mismatch');
    expect(await registry.read.musicRegTrackCount()).to.equal(1n);
  });
  it('paginates in registration order, includes inactive tracks and safely clamps huge limits', async () => {
    const { registry, owner } = await loadFixture(current);
    expect(await registry.read.musicRegTrackHashesPage([0n, 100n])).to.deep.equal([]);
    const hashes = [];
    for (let i = 0; i < 103; i++) {
      const reg = registration(String(i));
      hashes.push(reg.contentHash);
      await registry.write.musicRegRegister([reg, [owner.account.address], [10000]]);
    }
    await registry.write.musicRegDeactivate([hashes[0]]);
    expect(await registry.read.musicRegTrackHashesPage([0n, maxUint256])).to.deep.equal(hashes.slice(0, 100));
    expect(await registry.read.musicRegTrackHashesPage([100n, 100n])).to.deep.equal(hashes.slice(100));
    expect(await registry.read.musicRegTrackHashesPage([0n, 0n])).to.deep.equal([]);
    expect(await registry.read.musicRegTrackHashesPage([103n, 1n])).to.deep.equal([]);
    expect(await registry.read.musicRegTrackHashesPage([maxUint256, maxUint256])).to.deep.equal([]);
  });
  for (const kind of ['eoa', 'gas-consuming'] as const) {
    it(`measures a purchase at 16 ${kind} recipients and preserves access`, async () => {
      const { registry, royalties, client, runtime, listener } = await loadFixture(current);
      const recipients = [];
      for (let i = 0; i < 16; i++)
        recipients.push(
          kind === 'eoa'
            ? (`0x${(100 + i).toString(16).padStart(40, '0')}` as `0x${string}`)
            : (await hre.viem.deployContract('GasConsumingRoyaltyRecipient')).address
        );
      await registry.write.musicRegRegister([registration(), recipients, Array(16).fill(625)]);
      const tx = await royalties.write.musicRoyPayAccess([hash('one')], { value: 10000n, gas: 4000000n });
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      expect(receipt.status).to.equal('success');
      expect(receipt.gasUsed < 3000000n).to.equal(true);
      console.log(`W38 purchase ${kind}: ${receipt.gasUsed} gas`);
      const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
      expect(await access.read.musicAccCanAccess([hash('one'), listener.account.address])).to.equal(true);
      if (kind === 'gas-consuming') expect(await royalties.read.musicRoyClaimable([recipients[0]])).to.equal(625n);
    });
  }
  it('future artist-only module replacement preserves purchases, splits and NFT ownership', async () => {
    const { owner, stranger, registry, royalties, runtime, listener } = await loadFixture(current);
    await registry.write.musicRegRegister([registration(), [owner.account.address], [10000]]);
    await royalties.write.musicRoyPayAccess([hash('one')], { value: 10000n });
    const before = await registry.read.musicRegGetTrack([hash('one')]);
    const facet = await hre.viem.deployContract('MusicRegistryPallet');
    const functionSelectors = selectors((await hre.artifacts.readArtifact('MusicRegistryPallet')).abi);
    const cuts = [{ facetAddress: facet.address, action: 1, functionSelectors }];
    const badCut = await hre.viem.getContractAt('DiamondCutPallet', runtime.address, { client: { wallet: stranger } });
    await rejects(badCut.write.diamondCut([cuts, zeroAddress, '0x']), 'LibDiamond: not owner');
    const cut = await hre.viem.getContractAt('DiamondCutPallet', runtime.address, { client: { wallet: owner } });
    await cut.write.diamondCut([cuts, zeroAddress, '0x']);
    expect(await registry.read.musicRegGetTrack([hash('one')])).to.deep.equal(before);
    expect(await registry.read.musicRegTrackHashesPage([0n, 100n])).to.deep.equal([hash('one')]);
    expect(await royalties.read.musicRoySplitAt([hash('one'), 0n])).to.deep.equal([getAddress(owner.account.address), 10000]);
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
    expect(await access.read.musicAccCanAccess([hash('one'), listener.account.address])).to.equal(true);
    await rejects(registry.write.musicRegRegister([{ ...registration('new'), title: 'x'.repeat(801) }, [owner.account.address], [10000]]), 'title too long');
  });
});
