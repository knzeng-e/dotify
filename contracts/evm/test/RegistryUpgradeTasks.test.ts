import { expect } from 'chai';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import hre from 'hardhat';
import { getAddress, keccak256, toBytes, type Hex } from 'viem';
import { MUSIC_REGISTRY_REGISTER_SELECTOR, buildRegistryHotfixCalldata } from '../scripts/registryUpgrade';

async function deployTaskFixture() {
  const [owner, other] = await hre.viem.getWalletClients();
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

  return { owner, other, publicClient, directory, factory, royaltiesPallet, runtime };
}

function taskRegistration(overrides: Partial<{ contentHash: Hex; audioRef: string; pricePlanck: bigint }> = {}) {
  return {
    contentHash: overrides.contentHash ?? keccak256(toBytes('dotify:registry-upgrade-task-track')),
    title: 'Registry task track',
    artistName: 'Task Artist',
    description: 'Runtime upgrade task fixture',
    imageRef: 'ipfs://cover',
    audioRef: overrides.audioRef ?? 'ipfs://audio',
    metadataRef: 'ipfs://metadata',
    artistContractRef: 'artist://task',
    accessMode: 1,
    pricePlanck: overrides.pricePlanck ?? 1_000n,
    requiredPersonhood: 0
  };
}

async function installUnsafeRegisterFacet(
  owner: Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number],
  publicClient: Awaited<ReturnType<typeof hre.viem.getPublicClient>>,
  runtime: `0x${string}`
) {
  const unsafeFacet = await hre.viem.deployContract('UnsafeMusicRegistryRegisterMock');
  const cutArtifact = await hre.artifacts.readArtifact('DiamondCutPallet');
  const unsafeCut = buildRegistryHotfixCalldata(cutArtifact.abi, unsafeFacet.address);
  const unsafeCutHash = await owner.sendTransaction({ account: owner.account, to: runtime, data: unsafeCut });
  await publicClient.waitForTransactionReceipt({ hash: unsafeCutHash });
  return unsafeFacet;
}

function withSilentConsole<T>(callback: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = () => undefined;
  return callback().finally(() => {
    console.log = originalLog;
  });
}

async function expectRejection(callback: () => Promise<unknown>, pattern: RegExp) {
  try {
    await callback();
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).to.match(pattern);
    return;
  }
  throw new Error(`Expected rejection matching ${pattern}`);
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
    await installUnsafeRegisterFacet(owner, publicClient, runtime);
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');

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

  it('dry-runs and executes a royalties facet upgrade without losing catalogue state', async () => {
    const { owner, other, runtime } = await deployTaskFixture();
    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime, { client: { wallet: owner } });
    const registration = taskRegistration();
    await registry.write.musicRegRegister([registration, [other.account.address], [10_000]]);
    const replacementRoyalties = await hre.viem.deployContract('MusicRoyaltiesPallet');
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-runtime-royalties-upgrade-'));
    const planPath = path.join(evidenceDirectory, 'plan.json');
    const executionPath = path.join(evidenceDirectory, 'execution.json');

    try {
      await withSilentConsole(() =>
        hre.run('runtime:royalties-upgrade', {
          runtime,
          facet: replacementRoyalties.address,
          execute: false,
          confirmPlan: '',
          out: planPath
        })
      );
      const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as {
        digest: Hex;
        status: string;
        trackStateHash: Hex;
        replaceSelectors: Array<{ name: string; selector: Hex }>;
        transaction: { data: Hex } | null;
      };
      expect(plan.status).to.equal('simulated-dry-run');
      expect(plan.replaceSelectors.map(selector => selector.name)).to.include.members(['musicRoyClaim', 'musicRoyClaimable', 'musicRoyPayAccess']);
      expect(plan.transaction?.data).to.match(/^0x[0-9a-f]+$/i);

      await withSilentConsole(() =>
        hre.run('runtime:royalties-upgrade', {
          runtime,
          facet: replacementRoyalties.address,
          execute: true,
          confirmPlan: plan.digest,
          out: executionPath
        })
      );
      const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8')) as {
        status: string;
        transactionHash: Hex;
        catalogueStatePreserved: boolean;
        trackStateHash: Hex;
      };
      expect(execution.status).to.equal('verified-finalized');
      expect(execution.transactionHash).to.match(/^0x[0-9a-f]{64}$/i);
      expect(execution.catalogueStatePreserved).to.equal(true);
      expect(execution.trackStateHash).to.equal(plan.trackStateHash);

      const loupe = await hre.viem.getContractAt('DiamondLoupePallet', runtime);
      const selectorsByName = new Map(plan.replaceSelectors.map(selector => [selector.name, selector.selector] as const));
      for (const name of ['musicRoyClaim', 'musicRoyClaimable', 'musicRoyPayAccess']) {
        const selector = selectorsByName.get(name);
        expect(selector).to.be.a('string');
        expect(getAddress(await loupe.read.facetAddress([selector as Hex]))).to.equal(getAddress(replacementRoyalties.address));
      }

      const readRegistry = await hre.viem.getContractAt('MusicRegistryPallet', runtime);
      expect(await readRegistry.read.musicRegTrackCount()).to.equal(1n);
      const [record] = await readRegistry.read.musicRegGetTrack([registration.contentHash]);
      expect(record.title).to.equal(registration.title);
    } finally {
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('exports a runtime snapshot and blocks runtime-bound encrypted replay by default', async () => {
    const { owner, other, runtime } = await deployTaskFixture();
    const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime, { client: { wallet: owner } });
    const registration = taskRegistration({
      contentHash: keccak256(toBytes('dotify:registry-upgrade-task-encrypted-track')),
      audioRef: 'dotify:enc:v2:420420417:0x1111111111111111111111111111111111111111:0x2222:audio'
    });
    await registry.write.musicRegRegister([registration, [other.account.address], [10_000]]);
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-runtime-export-'));
    const snapshotPath = path.join(evidenceDirectory, 'snapshot.json');
    const migrationPath = path.join(evidenceDirectory, 'migration.json');
    const previousExitCode = process.exitCode;

    try {
      await withSilentConsole(() =>
        hre.run('runtime:export', {
          runtime,
          recipient: other.account.address,
          out: snapshotPath
        })
      );
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
        schema: string;
        runtime: string;
        trackCount: string;
        tracks: Array<{ hash: Hex; royaltySplits: Array<{ recipient: string; bps: string }> }>;
        recipientClaimable: { recipient: string; amount: string; status: string };
      };
      expect(snapshot.schema).to.equal('dotify.runtime-catalogue-snapshot.v1');
      expect(getAddress(snapshot.runtime)).to.equal(runtime);
      expect(snapshot.trackCount).to.equal('1');
      expect(snapshot.tracks[0].hash).to.equal(registration.contentHash);
      expect(snapshot.tracks[0].royaltySplits[0]).to.deep.equal({ recipient: getAddress(other.account.address), bps: '10000' });
      expect(snapshot.recipientClaimable).to.deep.equal({ recipient: getAddress(other.account.address), amount: '0', status: 'read' });

      process.exitCode = undefined;
      await withSilentConsole(() =>
        hre.run('runtime:migration-plan', {
          snapshot: snapshotPath,
          targetRuntime: '0x3333333333333333333333333333333333333333',
          allowEncryptedAudioReuse: false,
          out: migrationPath
        })
      );
      expect(process.exitCode).to.equal(2);
      const migration = JSON.parse(fs.readFileSync(migrationPath, 'utf8')) as {
        schema: string;
        transactionCount: number;
        blockedTrackCount: number;
        blockedTracks: Array<{ hash: Hex; reason: string }>;
      };
      expect(migration.schema).to.equal('dotify.runtime-track-migration-plan.v1');
      expect(migration.transactionCount).to.equal(0);
      expect(migration.blockedTrackCount).to.equal(1);
      expect(migration.blockedTracks[0].hash).to.equal(registration.contentHash);
      expect(migration.blockedTracks[0].reason).to.include('runtime-bound');
    } finally {
      process.exitCode = previousExitCode;
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('rejects registry:upgrade execution when --confirm-plan does not match the fresh digest', async () => {
    const { owner, publicClient, runtime } = await deployTaskFixture();
    await installUnsafeRegisterFacet(owner, publicClient, runtime);
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-task-'));

    try {
      await expectRejection(
        () =>
          withSilentConsole(() =>
            hre.run('registry:upgrade', {
              runtime,
              facet: correctedFacet.address,
              execute: true,
              confirmPlan: `0x${'11'.repeat(32)}`,
              out: path.join(evidenceDirectory, 'execution.json')
            })
          ),
        /Refusing upgrade: --confirm-plan must equal the fresh digest 0x[0-9a-f]{64}\./i
      );
    } finally {
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('rejects registry:upgrade when the target facet bytecode hash does not match the corrected registry source', async () => {
    const { runtime } = await deployTaskFixture();
    const wrongFacet = await hre.viem.deployContract('UnsafeMusicRegistryRegisterMock');

    await expectRejection(
      () =>
        withSilentConsole(() =>
          hre.run('registry:upgrade', {
            runtime,
            facet: wrongFacet.address,
            execute: false,
            confirmPlan: '',
            out: ''
          })
        ),
      /Target facet code hash 0x[0-9a-f]{64} does not match corrected source 0x[0-9a-f]{64}\./i
    );
  });

  it('rejects registry:upgrade execution when the configured signer is not the runtime owner', async () => {
    const { owner, other, publicClient, runtime } = await deployTaskFixture();
    await installUnsafeRegisterFacet(owner, publicClient, runtime);
    const ownership = await hre.viem.getContractAt('OwnershipPallet', runtime, { client: { wallet: owner } });
    const transferHash = await ownership.write.transferOwnership([other.account.address]);
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-task-'));

    try {
      await withSilentConsole(() =>
        hre.run('registry:upgrade', {
          runtime,
          facet: correctedFacet.address,
          execute: false,
          confirmPlan: '',
          out: path.join(evidenceDirectory, 'plan.json')
        })
      );
      const plan = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'plan.json'), 'utf8')) as { digest: Hex };

      await expectRejection(
        () =>
          withSilentConsole(() =>
            hre.run('registry:upgrade', {
              runtime,
              facet: correctedFacet.address,
              execute: true,
              confirmPlan: plan.digest,
              out: path.join(evidenceDirectory, 'execution.json')
            })
          ),
        new RegExp(`Configured signer ${owner.account.address} is not current runtime owner ${getAddress(other.account.address)}\\.`, 'i')
      );
    } finally {
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('rejects registry:upgrade execution when the runtime owner is a contract', async () => {
    const { owner, publicClient, directory, runtime } = await deployTaskFixture();
    await installUnsafeRegisterFacet(owner, publicClient, runtime);
    const ownership = await hre.viem.getContractAt('OwnershipPallet', runtime, { client: { wallet: owner } });
    const transferHash = await ownership.write.transferOwnership([directory.address]);
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-task-'));

    try {
      await withSilentConsole(() =>
        hre.run('registry:upgrade', {
          runtime,
          facet: correctedFacet.address,
          execute: false,
          confirmPlan: '',
          out: path.join(evidenceDirectory, 'plan.json')
        })
      );
      const plan = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'plan.json'), 'utf8')) as { digest: Hex };

      await expectRejection(
        () =>
          withSilentConsole(() =>
            hre.run('registry:upgrade', {
              runtime,
              facet: correctedFacet.address,
              execute: true,
              confirmPlan: plan.digest,
              out: path.join(evidenceDirectory, 'execution.json')
            })
          ),
        /Runtime owner is a contract\. Submit the generated calldata through that contract governance; this task will not impersonate it\./
      );
    } finally {
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('refuses to overwrite an existing registry:upgrade evidence output path', async () => {
    const { runtime } = await deployTaskFixture();
    const correctedFacet = await hre.viem.deployContract('MusicRegistryPallet');
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-task-'));
    const existingPath = path.join(evidenceDirectory, 'existing.json');
    fs.writeFileSync(existingPath, '{}\n');

    try {
      await expectRejection(
        () =>
          withSilentConsole(() =>
            hre.run('registry:upgrade', {
              runtime,
              facet: correctedFacet.address,
              execute: false,
              confirmPlan: '',
              out: existingPath
            })
          ),
        new RegExp(`Refusing to overwrite existing evidence: ${existingPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      );
    } finally {
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });

  it('dry-runs registry:deploy-facet with the expected code hash and execute instructions', async () => {
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (...values: unknown[]) => output.push(values.map(String).join(' '));

    try {
      await hre.run('registry:deploy-facet', {
        execute: false,
        confirmChainId: '',
        confirmCodeHash: '',
        out: ''
      });
    } finally {
      console.log = originalLog;
    }

    const reportText = output.find(value => value.includes('"action": "dry-run"'));
    expect(reportText).to.be.a('string');
    const report = JSON.parse(reportText!) as { action: string; chainId: number; correctedSourceCodeHash: Hex; next: string; warning: string };
    expect(report.action).to.equal('dry-run');
    expect(report.chainId).to.equal(31337);
    expect(report.correctedSourceCodeHash).to.match(/^0x[0-9a-f]{64}$/i);
    expect(report.next).to.include(`--confirm-chain-id ${report.chainId}`);
    expect(report.next).to.include(`--confirm-code-hash ${report.correctedSourceCodeHash}`);
    expect(report.warning).to.include('never upgrades a runtime');
  });

  it('executes registry:deploy-facet and writes a finalized bytecode-verified manifest', async () => {
    const artifact = await hre.artifacts.readArtifact('MusicRegistryPallet');
    const expectedCodeHash = keccak256(artifact.deployedBytecode as Hex);
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dotify-registry-facet-'));
    const manifestPath = path.join(evidenceDirectory, 'facet.json');
    const originalLog = console.log;
    console.log = () => undefined;

    try {
      await hre.run('registry:deploy-facet', {
        execute: true,
        confirmChainId: '31337',
        confirmCodeHash: expectedCodeHash,
        out: manifestPath
      });
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        status: string;
        chainId: number;
        transactionHash: string;
        facet: string;
        codeHash: Hex;
        explorerSourceVerified: boolean;
      };
      expect(manifest.status).to.equal('deployed-finalized-bytecode-verified');
      expect(manifest.chainId).to.equal(31337);
      expect(manifest.transactionHash).to.match(/^0x[0-9a-f]{64}$/i);
      expect(getAddress(manifest.facet)).to.equal(manifest.facet);
      expect(manifest.codeHash).to.equal(expectedCodeHash);
      expect(manifest.explorerSourceVerified).to.equal(false);
    } finally {
      console.log = originalLog;
      fs.rmSync(evidenceDirectory, { recursive: true, force: true });
    }
  });
});
