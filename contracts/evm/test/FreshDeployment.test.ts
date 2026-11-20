import { expect } from 'chai';
import hre from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { getAddress, toFunctionSelector, zeroAddress } from 'viem';
import { deploySmartRuntimeSystem } from '../scripts/deploySystem';
import { FRESH_CORE_TRANSACTION_COUNT, freshArtifactInventory, freshCdmPackages, freshDeploymentAccount, inspectFreshSystem } from '../scripts/freshDeployment';

async function system() {
  const deployments = await deploySmartRuntimeSystem(hre, 10, {});
  const client = await hre.viem.getPublicClient();
  const [artist] = await hre.viem.getWalletClients();
  const factory = await hre.viem.getContractAt('ArtistRuntimeFactory', deployments.factory);
  return { deployments, client, artist, factory };
}

async function rejects(operation: Promise<unknown>, fragment: string) {
  try {
    await operation;
  } catch (error) {
    expect(String(error)).to.include(fragment);
    return;
  }
  throw new Error('Expected rejection');
}

describe('Fresh generation preparation', () => {
  it('uses the actual operator deployment path and verifies all seven facets before cutover', async () => {
    const { deployments, client, artist } = await loadFixture(system);
    const result = await inspectFreshSystem(hre, client, deployments, await client.getBlockNumber(), artist.account.address);
    expect(result.artistCount).to.equal('0');
    expect(result.nativeTokenDecimals).to.equal(10);
    expect(result.verifiedImplementations).to.include('MusicMetadataPallet');
    const inventory = await freshArtifactInventory(hre);
    expect(inventory).to.have.length(10);
    expect(FRESH_CORE_TRANSACTION_COUNT).to.equal(11);
  });

  it('installs metadata before transferring administration and publishing the artist', async () => {
    const { factory, deployments, artist } = await loadFixture(system);
    await factory.write.createRuntime();
    const runtime = getAddress(String(await factory.read.pendingRuntimeOf([artist.account.address])));
    for (let i = 0; i < 6; i++) await factory.write.installRuntimeStep();
    expect(await factory.read.runtimeOf([artist.account.address])).to.equal(zeroAddress);
    const loupe = await hre.viem.getContractAt('DiamondLoupePallet', runtime);
    const selector = toFunctionSelector('musicRegUpdateMetadata(bytes32,string,string,string,string)');
    expect(getAddress(String(await loupe.read.facetAddress([selector]))).toLowerCase()).to.equal(deployments.pallets.metadataPallet.toLowerCase());
    const ownership = await hre.viem.getContractAt('OwnershipPallet', runtime);
    expect(getAddress(String(await ownership.read.owner())).toLowerCase()).to.equal(factory.address.toLowerCase());
    await factory.write.installRuntimeStep();
    expect(getAddress(String(await factory.read.runtimeOf([artist.account.address]))).toLowerCase()).to.equal(runtime.toLowerCase());
    expect(getAddress(String(await ownership.read.owner())).toLowerCase()).to.equal(artist.account.address.toLowerCase());
  });

  it('rejects an incomplete manifest, swapped implementation, precision mismatch or nonempty directory', async () => {
    const { deployments, client, factory, artist } = await loadFixture(system);
    const block = await client.getBlockNumber();
    await rejects(
      inspectFreshSystem(hre, client, { ...deployments, pallets: { ...deployments.pallets, metadataPallet: undefined } }, block, artist.account.address),
      'Incomplete'
    );
    await rejects(
      inspectFreshSystem(
        hre,
        client,
        { ...deployments, pallets: { ...deployments.pallets, metadataPallet: deployments.pallets.registryPallet } },
        block,
        artist.account.address
      ),
      'Factory metadataPallet'
    );
    await rejects(inspectFreshSystem(hre, client, { ...deployments, nativeTokenDecimals: 18 }, block, artist.account.address), 'native precision');
    await factory.write.createRuntime();
    for (let i = 0; i < 7; i++) await factory.write.installRuntimeStep();
    await rejects(inspectFreshSystem(hre, client, deployments, await client.getBlockNumber(), artist.account.address), 'must be empty');
  });

  it('rejects changed implementation code at the inspected block', async () => {
    const { deployments, client, artist } = await loadFixture(system);
    await hre.network.provider.send('hardhat_setCode', [deployments.pallets.metadataPallet, '0x60006000fd']);
    await rejects(inspectFreshSystem(hre, client, deployments, await client.getBlockNumber(), artist.account.address), 'MusicMetadataPallet bytecode');
  });

  it('rejects factory code drift even when its immutable getters still match', async () => {
    const { deployments, client, artist } = await loadFixture(system);
    const code = (await client.getCode({ address: deployments.factory }))!;
    const changed = code.slice(0, -2) + (code.endsWith('00') ? '01' : '00');
    await hre.network.provider.send('hardhat_setCode', [deployments.factory, changed]);
    await rejects(inspectFreshSystem(hre, client, deployments, await client.getBlockNumber(), artist.account.address), 'ArtistRuntimeFactory bytecode');
  });

  it('binds exact CDM addresses and uint32 versions, including versions above seven', async () => {
    const { deployments } = await loadFixture(system);
    const snapshot = {
      dependencies: { '@dotify/artist-directory': 12, '@dotify/artist-runtime-factory': 21 },
      contracts: {
        '@dotify/artist-directory': { version: 12, address: deployments.directory },
        '@dotify/artist-runtime-factory': { version: 21, address: deployments.factory }
      }
    };
    expect(freshCdmPackages(snapshot, deployments).map(entry => entry.version)).to.deep.equal([12, 21]);
    for (const version of [-1, 2 ** 32, 1.5, '12', undefined]) {
      expect(() => freshCdmPackages({ ...snapshot, dependencies: { ...snapshot.dependencies, '@dotify/artist-directory': version } }, deployments)).to.throw(
        'exact'
      );
    }
    snapshot.contracts['@dotify/artist-directory'].address = deployments.factory;
    expect(() => freshCdmPackages(snapshot, deployments)).to.throw('exact');
    expect(() => freshCdmPackages(null, deployments)).to.throw('exact');
  });

  it('requires an explicit public account without private-key or fallback account lookup', () => {
    for (const value of [undefined, '', 'artist', zeroAddress]) expect(() => freshDeploymentAccount(value)).to.throw('DOTIFY_DEPLOYER_ADDRESS');
    expect(freshDeploymentAccount('0x1111111111111111111111111111111111111111')).to.equal('0x1111111111111111111111111111111111111111');
  });
});
