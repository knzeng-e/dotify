import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';
import { encodeAbiParameters, keccak256, toBytes, toFunctionSelector, zeroAddress, zeroHash, type AbiFunction } from 'viem';

const hash = (name: string) => keccak256(toBytes(name));
const precompileAddress = '0x000000000000000000000000000000000a010000';
const response = (status: bigint) => encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [status, zeroHash]);
const paidHash = hash('paid');
const otherHash = hash('other');
async function fixture() {
  const [artist, buyer, newcomer] = await hre.viem.getWalletClients();
  const cuts = [];
  for (const name of ['DiamondCutPallet', 'MusicRegistryPallet', 'MusicRoyaltiesPallet', 'MusicAccessPallet']) {
    const facet = await hre.viem.deployContract(name);
    cuts.push({
      facetAddress: facet.address,
      action: 0,
      functionSelectors: facet.abi.filter((entry): entry is AbiFunction => entry.type === 'function').map(toFunctionSelector)
    });
  }
  const runtime = await hre.viem.deployContract('SmartRuntime', [artist.account.address, artist.account.address, 18, cuts, zeroAddress, '0x']);
  const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime.address);
  const registration = (contentHash: `0x${string}`) => ({
    contentHash,
    title: 'Music',
    artistName: 'Artist',
    description: 'Story',
    imageRef: 'local-test:cover',
    audioRef: 'local-test:audio',
    metadataRef: 'local-test:metadata',
    artistContractRef: 'dotify:self-certified',
    accessMode: 1,
    pricePlanck: 10000n,
    requiredPersonhood: 0
  });
  for (const contentHash of [paidHash, otherHash]) await registry.write.musicRegRegister([registration(contentHash), [artist.account.address], [10000]]);
  const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
  const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtime.address, { client: { wallet: buyer } });
  await royalties.write.musicRoyPayAccess([paidHash], { value: 10000n });
  return { artist, buyer, newcomer, cuts, runtime, registry, access, royalties, registration };
}
async function rejects(promise: Promise<unknown>, reason: string) {
  let failure = '';
  try {
    await promise;
  } catch (error) {
    failure = String(error);
  }
  expect(failure).to.include(reason);
}

describe('A05 paid access survives policy changes while the release is active', () => {
  it('preserves an actual Classic purchase through HumanFree, Free, a higher Classic price and repeated mode changes', async () => {
    const f = await loadFixture(fixture);
    for (const [mode, price, required] of [
      [0, 0n, 2],
      [2, 0n, 0],
      [1, 20000n, 0],
      [0, 0n, 1]
    ] as const) {
      await f.registry.write.musicRegSetAccessMode([paidHash, mode, price, required]);
      expect(await f.access.read.musicAccCanAccess([paidHash, f.buyer.account.address])).to.equal(true);
      expect(await f.access.read.musicAccHasPaid([paidHash, f.buyer.account.address])).to.equal(true);
      expect(await f.access.read.musicAccCanAccess([paidHash, f.newcomer.account.address])).to.equal(mode === 2);
    }
    await f.registry.write.musicRegSetAccessMode([paidHash, 1, 20000n, 0]);
    await rejects(f.royalties.write.musicRoyPayAccess([paidHash], { value: 20000n }), 'already paid');
  });

  it('denies inactive releases to buyer and artist, preserves payment history and restores the grant under HumanFree on reactivation', async () => {
    const f = await loadFixture(fixture);
    await f.registry.write.musicRegSetAccessMode([paidHash, 0, 0n, 2]);
    await f.registry.write.musicRegDeactivate([paidHash]);
    for (const account of [f.buyer.account.address, f.artist.account.address])
      expect(await f.access.read.musicAccCanAccess([paidHash, account])).to.equal(false);
    expect(await f.access.read.musicAccHasPaid([paidHash, f.buyer.account.address])).to.equal(true);
    await f.registry.write.musicRegReactivate([paidHash]);
    expect(await f.access.read.musicAccCanAccess([paidHash, f.buyer.account.address])).to.equal(true);
    expect(await f.access.read.musicAccCanAccess([paidHash, f.newcomer.account.address])).to.equal(false);
  });

  it('keeps paid access independent of unusable proof without asserting humanity or admitting unpaid newcomers', async () => {
    const f = await loadFixture(fixture);
    await f.registry.write.musicRegSetAccessMode([paidHash, 0, 0n, 2]);
    const deployed = await hre.viem.deployContract('MockPersonhoodPrecompile');
    const code = await (await hre.viem.getPublicClient()).getCode({ address: deployed.address });
    await hre.network.provider.request({ method: 'hardhat_setCode', params: [precompileAddress, code] });
    const mock = await hre.viem.getContractAt('MockPersonhoodPrecompile', precompileAddress);
    for (const [raw, reverts] of [
      [response(0n), false],
      [response(1n), false],
      [response(3n), false],
      [response(257n), false],
      ['0x', false],
      [response(2n), true]
    ] as const) {
      await mock.write.setRawResponse([raw, reverts]);
      expect(await f.access.read.musicAccCanAccess([paidHash, f.buyer.account.address])).to.equal(true);
      expect(await f.access.read.musicAccHasPersonhood([f.buyer.account.address, 2])).to.equal(false);
      expect(await f.access.read.musicAccCanAccess([paidHash, f.newcomer.account.address])).to.equal(false);
      await rejects(f.royalties.write.musicRoyRecordListen([paidHash]), 'personhood required');
    }
    await mock.write.setRawResponse([response(2n), false]);
    expect(await f.access.read.musicAccCanAccess([paidHash, f.newcomer.account.address])).to.equal(true);
    expect(await f.access.read.musicAccHasPaid([paidHash, f.newcomer.account.address])).to.equal(false);
    await f.royalties.write.musicRoyRecordListen([paidHash]);
  });

  it('binds the grant to the same wallet, release and runtime; unknown releases stay closed', async () => {
    const f = await loadFixture(fixture);
    await f.registry.write.musicRegSetAccessMode([paidHash, 0, 0n, 2]);
    expect(await f.access.read.musicAccCanAccess([paidHash, f.buyer.account.address])).to.equal(true);
    for (const account of [f.newcomer.account.address, zeroAddress]) expect(await f.access.read.musicAccCanAccess([paidHash, account])).to.equal(false);
    for (const contentHash of [otherHash, hash('missing')])
      expect(await f.access.read.musicAccCanAccess([contentHash, f.buyer.account.address])).to.equal(false);
    const second = await hre.viem.deployContract('SmartRuntime', [f.artist.account.address, f.artist.account.address, 18, f.cuts, zeroAddress, '0x']);
    const secondRegistry = await hre.viem.getContractAt('MusicRegistryPallet', second.address);
    await secondRegistry.write.musicRegRegister([f.registration(paidHash), [f.artist.account.address], [10000]]);
    const secondAccess = await hre.viem.getContractAt('MusicAccessPallet', second.address);
    expect(await secondAccess.read.musicAccHasPaid([paidHash, f.buyer.account.address])).to.equal(false);
    expect(await secondAccess.read.musicAccCanAccess([paidHash, f.buyer.account.address])).to.equal(false);
  });
});
