import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import hre from 'hardhat';
import { getAddress } from 'viem';
import { MUSIC_REGISTRY_REGISTER_SELECTOR, buildRegistryHotfixCalldata } from '../scripts/registryUpgrade';

async function deployTaskFixture() {
  const [owner] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const cutPallet = await hre.viem.deployContract('DiamondCutPallet');
  const loupePallet = await hre.viem.deployContract('DiamondLoupePallet');
  const ownershipPallet = await hre.viem.deployContract('OwnershipPallet');
  const registryPallet = await hre.viem.deployContract('MusicRegistryPallet');
  const nftPallet = await hre.viem.deployContract('MusicNFTPallet');
  const royaltiesPallet = await hre.viem.deployContract('MusicRoyaltiesPallet');
  const accessPallet = await hre.viem.deployContract('MusicAccessPallet');
  const initializer = await hre.viem.deployContract('DotifyRuntimeInitializer');
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
  await directory.write.setFactory([factory.address]);

  const ownerFactory = await hre.viem.getContractAt('ArtistRuntimeFactory', factory.address, { client: { wallet: owner } });
  await ownerFactory.write.createRuntime();
  for (let step = 0; step < 7; step += 1) await ownerFactory.write.installRuntimeStep();
  const runtime = getAddress(await factory.read.runtimeOf([owner.account.address]));

  return { owner, publicClient, directory, factory, runtime };
}

describe('Registry remediation Hardhat tasks', () => {
  it('audits a paired corrected system at one finalized block', async () => {
    const { directory, factory, runtime } = await deployTaskFixture();
    const output: string[] = [];
    const originalLog = console.log;
    const previousExitCode = process.exitCode;
    let taskExitCode: typeof process.exitCode;
    process.exitCode = undefined;
    console.log = (...values: unknown[]) => output.push(values.map(String).join(' '));

    try {
      await hre.run('registry:audit', { factory: factory.address, directory: directory.address });
    } finally {
      console.log = originalLog;
      taskExitCode = process.exitCode;
      process.exitCode = previousExitCode;
    }

    expect(taskExitCode).not.to.equal(2);
    const reportText = output.find(value => value.includes('"schema": "dotify.registry-audit.v1"'));
    expect(reportText).to.be.a('string');
    const report = JSON.parse(reportText!) as {
      blockHash: string;
      factoryDirectoryMatches: boolean;
      directoryFactoryMatches: boolean;
      configuredFacetMatchesSource: boolean;
      pendingDiscovery: { status: string };
      runtimes: Array<{
        runtime: string;
        ownerMatchesDirectoryArtist: boolean;
        registerFacetMatchesSource: boolean;
        guard: { status: string };
        selectorRoutes: unknown[];
      }>;
    };
    expect(report.blockHash).to.match(/^0x[0-9a-f]{64}$/i);
    expect(report.factoryDirectoryMatches).to.equal(true);
    expect(report.directoryFactoryMatches).to.equal(true);
    expect(report.configuredFacetMatchesSource).to.equal(true);
    expect(report.pendingDiscovery.status).to.equal('complete');
    expect(report.runtimes).to.have.lengthOf(1);
    expect(getAddress(report.runtimes[0].runtime)).to.equal(runtime);
    expect(report.runtimes[0].ownerMatchesDirectoryArtist).to.equal(true);
    expect(report.runtimes[0].registerFacetMatchesSource).to.equal(true);
    expect(report.runtimes[0].guard.status).to.equal('protected');
    expect(report.runtimes[0].selectorRoutes).to.have.lengthOf(10);
  });

  it('executes a vulnerable-to-protected upgrade and finalizes its evidence manifest', async () => {
    const { owner, publicClient, runtime } = await deployTaskFixture();
    const unsafeFacet = await hre.viem.deployContract('UnsafeMusicRegistryRegisterMock');
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');
    const cutArtifact = await hre.artifacts.readArtifact('DiamondCutPallet');
    const unsafeCut = buildRegistryHotfixCalldata(cutArtifact.abi, unsafeFacet.address);
    const unsafeCutHash = await owner.sendTransaction({ account: owner.account, to: runtime, data: unsafeCut });
    await publicClient.waitForTransactionReceipt({ hash: unsafeCutHash });

    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-task-'));
    const planPath = path.join(evidenceDirectory, 'plan.json');
    const executionPath = path.join(evidenceDirectory, 'execution.json');
    const originalLog = console.log;
    console.log = () => undefined;
    try {
      await hre.run('registry:upgrade', {
        runtime,
        facet: correctedFacet.address,
        execute: false,
        confirmPlan: '',
        out: planPath
      });
      const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as { digest: string; status: string; preflight: { currentGuard: { status: string } } };
      expect(plan.status).to.equal('simulated-dry-run');
      expect(plan.preflight.currentGuard.status).to.equal('vulnerable');

      await hre.run('registry:upgrade', {
        runtime,
        facet: correctedFacet.address,
        execute: true,
        confirmPlan: plan.digest,
        out: executionPath
      });
      const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8')) as {
        status: string;
        transactionHash: string;
        catalogueStatePreserved: boolean;
        outsiderProbe: { status: string };
      };
      expect(execution.status).to.equal('verified-finalized');
      expect(execution.transactionHash).to.match(/^0x[0-9a-f]{64}$/i);
      expect(execution.catalogueStatePreserved).to.equal(true);
      expect(execution.outsiderProbe.status).to.equal('protected');

      const loupe = await hre.viem.getContractAt('DiamondLoupePallet', runtime);
      expect(getAddress(await loupe.read.facetAddress([MUSIC_REGISTRY_REGISTER_SELECTOR]))).to.equal(getAddress(correctedFacet.address));
    } finally {
      console.log = originalLog;
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });
});
