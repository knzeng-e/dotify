import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';
import { encodeAbiParameters, keccak256, toBytes, toFunctionSelector, zeroAddress, zeroHash, type AbiFunction } from 'viem';

const precompileAddress = '0x000000000000000000000000000000000a010000';
const alias = `0x${'ab'.repeat(32)}` as const;
const hash = (name: string) => keccak256(toBytes(name));
const response = (status: bigint) => encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes32' }], [status, alias]);
async function fixture() {
  const [artist, listener] = await hre.viem.getWalletClients();
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
  for (const [name, mode, required] of [
    ['dim1', 0, 1],
    ['dim2', 0, 2],
    ['free', 2, 0],
    ['paid', 1, 0]
  ] as const) {
    await registry.write.musicRegRegister([
      {
        contentHash: hash(name),
        title: name,
        artistName: 'Artist',
        description: 'Music',
        imageRef: 'ipfs://cover',
        audioRef: 'ipfs://audio',
        metadataRef: 'ipfs://metadata',
        artistContractRef: 'dotify:self-certified',
        accessMode: mode,
        pricePlanck: 10000n,
        requiredPersonhood: required
      },
      [artist.account.address],
      [10000]
    ]);
  }
  const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
  const royalty = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtime.address, { client: { wallet: listener } });
  await royalty.write.musicRoyPayAccess([hash('paid')], { value: 10000n });
  const deployed = await hre.viem.deployContract('MockPersonhoodPrecompile');
  const code = await (await hre.viem.getPublicClient()).getCode({ address: deployed.address });
  await hre.network.provider.request({ method: 'hardhat_setCode', params: [precompileAddress, code] });
  const mock = await hre.viem.getContractAt('MockPersonhoodPrecompile', precompileAddress);
  return { artist, listener, access, royalty, mock };
}
async function assertDenied(f: Awaited<ReturnType<typeof fixture>>, status = 0) {
  expect(await f.access.read.musicAccPersonhoodInfo([f.listener.account.address])).to.deep.equal([status, zeroHash, false]);
  expect(await f.access.read.musicAccPersonhoodLevel([f.listener.account.address])).to.equal(0);
  expect(await f.access.read.musicAccHasPersonhood([f.listener.account.address, 0])).to.equal(true);
  for (const level of [1, 2]) {
    expect(await f.access.read.musicAccHasPersonhood([f.listener.account.address, level])).to.equal(false);
    expect(await f.access.read.musicAccCanAccess([hash(`dim${level}`), f.listener.account.address])).to.equal(false);
  }
}
describe('A06 supported personhood evidence', () => {
  it('keeps raw, typed and gated access consistent across all 256 uint8 statuses', async () => {
    const f = await loadFixture(fixture);
    for (let status = 0; status <= 255; status++) {
      await f.mock.write.setRawResponse([response(BigInt(status)), false]);
      const supported = status <= 2;
      expect(await f.access.read.musicAccPersonhoodInfo([f.listener.account.address]), `raw status ${status}`).to.deep.equal([
        status,
        supported ? alias : zeroHash,
        supported
      ]);
      expect(await f.access.read.musicAccPersonhoodLevel([f.listener.account.address]), `typed status ${status}`).to.equal(supported ? status : 0);
      for (const level of [1, 2]) {
        const allowed = supported && status >= level;
        expect(await f.access.read.musicAccHasPersonhood([f.listener.account.address, level]), `predicate status ${status}/${level}`).to.equal(allowed);
        expect(await f.access.read.musicAccCanAccess([hash(`dim${level}`), f.listener.account.address]), `track status ${status}/${level}`).to.equal(allowed);
      }
    }
  });
  for (const word of [256n, 257n, 1n << 255n, (1n << 256n) - 1n]) {
    it(`denies a dirty uint8 status word ${word} without a decoder/enum revert`, async () => {
      const f = await loadFixture(fixture);
      await f.mock.write.setRawResponse([response(word), false]);
      await assertDenied(f);
    });
  }
  for (const length of [0, 1, 32, 63, 65, 96]) {
    it(`denies a ${length}-byte response rather than accepting a changed layout`, async () => {
      const f = await loadFixture(fixture);
      const bytes = `0x${'00'.repeat(length)}` as const;
      await f.mock.write.setRawResponse([bytes, false]);
      await assertDenied(f);
    });
  }
  it('denies a reverted precompile without affecting Free, paid Classic or original-artist access', async () => {
    const f = await loadFixture(fixture);
    await f.mock.write.setRawResponse([response(1n), false]);
    await f.royalty.write.musicRoyRecordListen([hash('dim1')]);
    for (const reverts of [true, false]) {
      await f.mock.write.setRawResponse([response(3n), reverts]);
      await assertDenied(f, reverts ? 0 : 3);
      expect(await f.access.read.musicAccCanAccess([hash('free'), f.listener.account.address])).to.equal(true);
      expect(await f.access.read.musicAccCanAccess([hash('paid'), f.listener.account.address])).to.equal(true);
      expect(await f.access.read.musicAccCanAccess([hash('dim2'), f.artist.account.address])).to.equal(true);
      let failure = '';
      try {
        await f.royalty.write.musicRoyRecordListen([hash('dim1')]);
      } catch (error) {
        failure = String(error);
      }
      expect(failure).to.include('MusicRoyalties: personhood required');
    }
  });
});
