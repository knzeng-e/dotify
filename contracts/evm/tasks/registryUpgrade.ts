import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  encodeFunctionData,
  getAddress,
  getContract,
  getContractAddress,
  keccak256,
  parseAbiItem,
  toBytes,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { POLKADOT_TESTNET_CHAIN, readDeployments } from '../scripts/smartRuntime';
import {
  MUSIC_REGISTRY_REGISTER_SELECTOR,
  assertRegistryArtifact,
  buildRegistryHotfixTransaction,
  canonicalJson,
  hashCanonical,
  isRegistryRuntimeSafe,
  registryUpgradePlanDigest,
  requireAddress,
  type RegistrySelector
} from '../scripts/registryUpgrade';

const PENDING_RUNTIME_PAGE_SIZE = 25_000n;
const HARDHAT_FIRST_ACCOUNT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

type GuardProbe = {
  status: 'protected' | 'vulnerable' | 'inconclusive';
  detail: string;
};

type RuntimeAudit = {
  runtime: Address;
  directoryArtist: Address;
  owner: Address;
  ownerMatchesDirectoryArtist: boolean;
  registerFacet: Address;
  registerFacetCodeHash: Hex | null;
  registerFacetMatchesSource: boolean;
  guard: GuardProbe;
  trackCount: string;
  foreignTrackHashes: Hex[];
  transferredTokenHashes: Hex[];
  selectorRoutes: Array<RegistrySelector & { facet: Address; codeHash: Hex | null }>;
};

type PendingRuntime = { artist: Address; runtime: Address; stage: number };

type PendingDiscovery = { status: 'complete'; deploymentBlock: string; runtimes: PendingRuntime[] } | { status: 'unavailable'; detail: string; runtimes: [] };

type CatalogueSnapshot = {
  owner: Address;
  trackCount: string;
  tracks: Array<{
    hash: Hex;
    record: unknown;
    tokenOwner: Address;
    royaltySplits: Array<{ recipient: Address; bps: string }>;
    totalBps: string;
  }>;
};

type RegistryUpgradePlanBody = {
  schema: 'dotify.registry-owner-guard.v1';
  chainId: number;
  capturedBlockNumber: string;
  capturedBlockHash: Hex;
  runtime: Address;
  owner: Address;
  expectedOldFacet: Address;
  targetFacet: Address;
  targetCodeHash: Hex;
  selector: typeof MUSIC_REGISTRY_REGISTER_SELECTOR;
  trackStateHash: Hex;
  preservedSelectorRoutes: Array<RegistrySelector & { facet: Address }>;
  transaction: {
    to: Address;
    value: '0x0';
    data: Hex;
  };
};

type RegistryUpgradePlan = RegistryUpgradePlanBody & { digest: Hex; evidenceDigest: Hex };

const bootstrapStartedEvent = parseAbiItem('event ArtistRuntimeBootstrapStarted(address indexed artist, address indexed runtime)');

task('registry:audit', 'Read-only audit of the configured registry facet and every finalized or pending runtime')
  .addOptionalParam('factory', 'ArtistRuntimeFactory address; defaults to deployments.json', '', types.string)
  .addOptionalParam('directory', 'ArtistDirectory address; defaults to deployments.json', '', types.string)
  .setAction(async (args: { factory: string; directory: string }, hre) => {
    await hre.run('compile');
    const publicClient = await getPublicClient(hre);
    const chainId = await publicClient.getChainId();
    const capturedBlock = await publicClient.getBlock({ blockTag: 'finalized' });
    const record = readDeployments();
    const factoryAddress = requireAddress('factory', args.factory || record.factory);
    const directoryAddress = requireAddress('directory', args.directory || record.directory);
    const source = await getRegistrySource(hre);
    const factory = await getReadContract(hre, publicClient, 'ArtistRuntimeFactory', factoryAddress);
    const directory = await getReadContract(hre, publicClient, 'ArtistDirectory', directoryAddress);
    const configuredFacet = getAddress(await factory.read.registryPallet({ blockNumber: capturedBlock.number }));
    const configuredCodeHash = await readCodeHash(publicClient, configuredFacet, capturedBlock.number);
    const factoryDirectory = getAddress(await factory.read.directory({ blockNumber: capturedBlock.number }));
    const directoryFactory = getAddress(await directory.read.factory({ blockNumber: capturedBlock.number }));
    const artistCountValue = await directory.read.artistCount({ blockNumber: capturedBlock.number });
    if (artistCountValue > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Directory artist count ${artistCountValue} exceeds safe tooling limits.`);
    const artistCount = Number(artistCountValue);
    const entries = [] as Array<{ artist: Address; runtime: Address }>;

    for (let offset = 0; offset < artistCount; offset += 100) {
      const [pageArtists, pageRuntimes] = await directory.read.artistsPage([BigInt(offset), BigInt(Math.min(100, artistCount - offset))], {
        blockNumber: capturedBlock.number
      });
      if (pageArtists.length !== pageRuntimes.length) throw new Error(`Directory page at offset ${offset} returned mismatched arrays.`);
      for (let index = 0; index < pageArtists.length; index += 1) {
        entries.push({ artist: getAddress(pageArtists[index]), runtime: getAddress(pageRuntimes[index]) });
      }
    }

    const runtimeAudits = [] as RuntimeAudit[];
    for (const entry of entries) {
      runtimeAudits.push(
        await auditRuntime(hre, publicClient, entry.runtime, entry.artist, source.abi, source.selectors, source.codeHash, capturedBlock.number)
      );
    }

    const pendingDiscovery = await discoverPendingRuntimes(hre, publicClient, factoryAddress, capturedBlock.number);
    const pendingAudits = [] as Array<{ artist: Address; runtime: Address; stage: number; audit?: RuntimeAudit }>;
    for (const entry of pendingDiscovery.runtimes) {
      pendingAudits.push({
        ...entry,
        audit:
          entry.stage >= 4
            ? await auditRuntime(hre, publicClient, entry.runtime, entry.artist, source.abi, source.selectors, source.codeHash, capturedBlock.number)
            : undefined
      });
    }

    const report = {
      schema: 'dotify.registry-audit.v1',
      chainId,
      blockNumber: capturedBlock.number.toString(),
      blockHash: capturedBlock.hash,
      factory: factoryAddress,
      directory: directoryAddress,
      factoryDirectory,
      directoryFactory,
      factoryDirectoryMatches: factoryDirectory === directoryAddress,
      directoryFactoryMatches: directoryFactory === factoryAddress,
      configuredFacet,
      configuredCodeHash,
      correctedSourceCodeHash: source.codeHash,
      configuredFacetMatchesSource: configuredCodeHash === source.codeHash,
      finalizedRuntimeCount: entries.length,
      runtimes: runtimeAudits,
      pendingDiscovery: {
        status: pendingDiscovery.status,
        ...(pendingDiscovery.status === 'complete' ? { deploymentBlock: pendingDiscovery.deploymentBlock } : { detail: pendingDiscovery.detail })
      },
      pendingRuntimes: pendingAudits
    };

    console.log(formatJson(report));

    const unsafeFinalized = runtimeAudits.some(
      audit =>
        !isRegistryRuntimeSafe(
          {
            registerFacetMatchesSource: audit.registerFacetMatchesSource,
            ownerMatchesDirectoryArtist: audit.ownerMatchesDirectoryArtist,
            guardStatus: audit.guard.status,
            foreignTrackCount: audit.foreignTrackHashes.length,
            selectorRoutes: audit.selectorRoutes
          },
          source.selectors.length
        )
    );
    const unsafePending = pendingDiscovery.status !== 'complete' || pendingAudits.length > 0;
    if (!report.configuredFacetMatchesSource || !report.factoryDirectoryMatches || !report.directoryFactoryMatches || unsafeFinalized || unsafePending) {
      console.error('\nRegistry audit failed: publication must remain quarantined until every reported condition is remediated.');
      process.exitCode = 2;
    }
  });

task('registry:deploy-facet', 'Compile or explicitly deploy only the corrected MusicRegistryPallet')
  .addFlag('execute', 'Broadcast the deployment transaction')
  .addOptionalParam('confirmChainId', 'Required chain ID confirmation when --execute is set', '', types.string)
  .addOptionalParam('confirmCodeHash', 'Required corrected deployed-bytecode hash when --execute is set', '', types.string)
  .addOptionalParam('out', 'Deployment manifest path; required with --execute', '', types.string)
  .setAction(async (args: { execute: boolean; confirmChainId: string; confirmCodeHash: string; out: string }, hre) => {
    await hre.run('compile');
    const publicClient = await getPublicClient(hre);
    const chainId = await publicClient.getChainId();
    const source = await getRegistrySource(hre);

    if (!args.execute) {
      console.log(
        formatJson({
          action: 'dry-run',
          chainId,
          contract: 'MusicRegistryPallet',
          correctedSourceCodeHash: source.codeHash,
          next: `Re-run with --execute --confirm-chain-id ${chainId} --confirm-code-hash ${source.codeHash} --out <manifest-path>`,
          warning: 'This deploys only a stateless facet. It never edits deployments.json and never upgrades a runtime.'
        })
      );
      return;
    }

    if (args.confirmChainId !== String(chainId)) {
      throw new Error(`Refusing deployment: --confirm-chain-id must equal ${chainId}.`);
    }
    if (args.confirmCodeHash.toLowerCase() !== source.codeHash.toLowerCase()) {
      throw new Error(`Refusing deployment: --confirm-code-hash must equal ${source.codeHash}.`);
    }
    if (!args.out) throw new Error('Refusing deployment: --out is required so the transaction evidence cannot be lost.');
    reserveJsonOutput(args.out, {
      schema: 'dotify.registry-facet-deployment.v1',
      status: 'reserved-before-broadcast',
      chainId,
      expectedCodeHash: source.codeHash,
      note: 'If this file remains reserved, inspect the deployer account and chain before retrying.'
    });

    const wallet = await getOwnerWallet(hre, 'deployer');
    const deployer = getAddress(wallet.account.address);
    const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'pending' });
    const predictedFacet = getContractAddress({ from: deployer, nonce: BigInt(nonce) });
    overwriteReservedJson(args.out, {
      schema: 'dotify.registry-facet-deployment.v1',
      status: 'prepared-before-broadcast',
      chainId,
      expectedCodeHash: source.codeHash,
      deployer,
      nonce,
      predictedFacet,
      note: 'No signed transaction hash means no broadcast-safe payload was persisted. Inspect the deployer nonce before retrying.'
    });
    const signed = await signRawTransaction(hre, wallet, {
      data: source.bytecode,
      nonce,
      value: 0n
    });
    if (signed.nonce !== nonce) throw new Error(`Prepared deployment nonce ${signed.nonce} differs from reserved nonce ${nonce}.`);
    overwriteReservedJson(args.out, {
      schema: 'dotify.registry-facet-deployment.v1',
      status: 'signed-before-broadcast',
      chainId,
      expectedCodeHash: source.codeHash,
      deployer,
      nonce,
      predictedFacet,
      transactionHash: signed.transactionHash,
      note: 'The transaction hash is derived from locally signed bytes. If broadcast response is lost, inspect this hash and nonce before retrying.'
    });
    const broadcastHash = await wallet.sendRawTransaction({
      serializedTransaction: signed.serializedTransaction
    });
    if (broadcastHash !== signed.transactionHash) {
      throw new Error(`RPC returned transaction hash ${broadcastHash}, but locally signed bytes hash to ${signed.transactionHash}.`);
    }
    overwriteReservedJson(args.out, {
      schema: 'dotify.registry-facet-deployment.v1',
      status: 'broadcast',
      chainId,
      expectedCodeHash: source.codeHash,
      deployer,
      nonce,
      predictedFacet,
      transactionHash: signed.transactionHash,
      broadcastHash
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: signed.transactionHash });
    if (receipt.status !== 'success' || !receipt.contractAddress) {
      throw new Error(`Registry facet deployment ${signed.transactionHash} did not produce a successful contract receipt.`);
    }
    const { receipt: finalizedReceipt, finalizedBlockNumber } = await waitForCanonicalFinality(hre, publicClient, signed.transactionHash, receipt);
    const facetAddress = getAddress(receipt.contractAddress);
    if (predictedFacet !== facetAddress) throw new Error(`Predicted facet ${predictedFacet} differs from receipt address ${facetAddress}.`);
    const deployedCodeHash = await readCodeHash(publicClient, facetAddress, finalizedReceipt.blockNumber);
    if (deployedCodeHash !== source.codeHash) {
      throw new Error(`Deployed facet code hash ${deployedCodeHash ?? 'missing'} does not match ${source.codeHash}.`);
    }

    const manifest = {
      schema: 'dotify.registry-facet-deployment.v1',
      status: 'deployed-finalized-bytecode-verified',
      chainId,
      transactionHash: signed.transactionHash,
      blockNumber: finalizedReceipt.blockNumber.toString(),
      blockHash: finalizedReceipt.blockHash,
      finalizedBlockNumber: finalizedBlockNumber.toString(),
      deployer,
      nonce,
      facet: facetAddress,
      codeHash: deployedCodeHash,
      explorerSourceVerified: false,
      note: 'Not active until each runtime owner applies a separately verified selector hotfix.'
    };
    overwriteReservedJson(args.out, manifest);
    console.log(formatJson(manifest));
  });

task('registry:upgrade', 'Prepare, simulate, or explicitly apply the owner-only registration hotfix to one runtime')
  .addParam('runtime', 'One SmartRuntime proxy address', undefined, types.string)
  .addParam('facet', 'Corrected MusicRegistryPallet address', undefined, types.string)
  .addFlag('execute', 'Broadcast the owner-signed selector replacement')
  .addOptionalParam('confirmPlan', 'Exact plan digest required when --execute is set', '', types.string)
  .addOptionalParam('out', 'Plan/evidence path; required with --execute', '', types.string)
  .setAction(async (args: { runtime: string; facet: string; execute: boolean; confirmPlan: string; out: string }, hre) => {
    await hre.run('compile');
    const publicClient = await getPublicClient(hre);
    const runtime = requireAddress('runtime', args.runtime);
    const targetFacet = requireAddress('facet', args.facet);
    const source = await getRegistrySource(hre);
    const capturedBlock = await publicClient.getBlock({ blockTag: 'finalized' });
    const targetCodeHash = await readCodeHash(publicClient, targetFacet, capturedBlock.number);
    if (targetCodeHash !== source.codeHash) {
      throw new Error(`Target facet code hash ${targetCodeHash ?? 'missing'} does not match corrected source ${source.codeHash}.`);
    }
    if (args.execute && !args.out) throw new Error('Refusing upgrade: --out is required with --execute so broadcast evidence cannot be lost.');
    if (args.out) assertOutputPathAvailable(args.out);

    const before = await readCatalogueSnapshot(hre, publicClient, runtime, capturedBlock.number);
    const plan = await buildUpgradePlan(
      hre,
      publicClient,
      runtime,
      targetFacet,
      targetCodeHash,
      source.selectors,
      before,
      capturedBlock.number,
      capturedBlock.hash
    );
    console.log(formatJson(plan));

    const currentProbe = await probeOwnerGuard(publicClient, runtime, source.abi, before.owner, capturedBlock.number);
    console.log(`\nCurrent outsider probe: ${currentProbe.status} — ${currentProbe.detail}`);

    if (plan.expectedOldFacet.toLowerCase() === targetFacet.toLowerCase()) {
      if (currentProbe.status !== 'protected') {
        throw new Error('Selector already targets the corrected facet, but the outsider probe did not prove the owner guard.');
      }
      if (args.out) {
        writeJson(args.out, {
          ...plan,
          status: 'already-protected-no-transaction',
          preflight: { currentGuard: currentProbe, ownerCutSimulation: 'not-needed' }
        });
      }
      console.log('No transaction needed: this runtime already routes musicRegRegister to the corrected facet.');
      return;
    }

    await simulateRawCall(publicClient, before.owner, plan.transaction.to, plan.transaction.data, 'owner hotfix simulation', capturedBlock.number);
    const preflight = { currentGuard: currentProbe, ownerCutSimulation: 'succeeded' as const };
    if (!args.execute) {
      if (args.out) writeJson(args.out, { ...plan, status: 'simulated-dry-run', preflight });
      console.log(`\nDry-run only. The runtime owner may re-run with --execute --confirm-plan ${plan.digest}`);
      return;
    }

    if (args.confirmPlan.toLowerCase() !== plan.digest.toLowerCase()) {
      throw new Error(`Refusing upgrade: --confirm-plan must equal the fresh digest ${plan.digest}.`);
    }

    const ownerCode = await publicClient.getCode({ address: before.owner, blockNumber: capturedBlock.number });
    if (ownerCode && ownerCode !== '0x') {
      throw new Error('Runtime owner is a contract. Submit the generated calldata through that contract governance; this task will not impersonate it.');
    }

    const wallet = await getOwnerWallet(hre, 'runtime owner');
    if (getAddress(wallet.account.address) !== before.owner) {
      throw new Error(`Configured signer ${wallet.account.address} is not current runtime owner ${before.owner}.`);
    }

    const ownerNonce = await publicClient.getTransactionCount({ address: before.owner, blockTag: 'pending' });
    writeJson(args.out, {
      ...plan,
      status: 'prepared-before-broadcast',
      preflight,
      signer: getAddress(wallet.account.address),
      nonce: ownerNonce,
      note: 'No signed transaction hash means no broadcast-safe payload was persisted. Inspect the owner nonce before retrying.'
    });

    const signed = await signRawTransaction(hre, wallet, {
      to: plan.transaction.to,
      data: plan.transaction.data,
      value: 0n,
      nonce: ownerNonce
    });
    if (signed.nonce !== ownerNonce) throw new Error(`Prepared owner nonce ${signed.nonce} differs from reserved nonce ${ownerNonce}.`);
    overwriteReservedJson(args.out, {
      ...plan,
      status: 'signed-before-broadcast',
      preflight,
      signer: getAddress(wallet.account.address),
      nonce: ownerNonce,
      transactionHash: signed.transactionHash,
      note: 'The transaction hash is derived from locally signed bytes. If broadcast response is lost, inspect this hash and nonce before retrying.'
    });
    const broadcastHash = await wallet.sendRawTransaction({
      serializedTransaction: signed.serializedTransaction
    });
    if (broadcastHash !== signed.transactionHash) {
      throw new Error(`RPC returned transaction hash ${broadcastHash}, but locally signed bytes hash to ${signed.transactionHash}.`);
    }
    overwriteReservedJson(args.out, {
      ...plan,
      status: 'broadcast',
      preflight,
      signer: getAddress(wallet.account.address),
      nonce: ownerNonce,
      transactionHash: signed.transactionHash,
      broadcastHash
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: signed.transactionHash });
    if (receipt.status !== 'success') throw new Error(`Registry hotfix transaction ${signed.transactionHash} failed.`);
    const { receipt: finalizedReceipt, finalizedBlockNumber } = await waitForCanonicalFinality(hre, publicClient, signed.transactionHash, receipt);

    const after = await readCatalogueSnapshot(hre, publicClient, runtime, finalizedReceipt.blockNumber);
    if (hashCanonical(after) !== plan.trackStateHash) {
      throw new Error('Post-upgrade catalogue snapshot differs from the pre-upgrade state. Quarantine this runtime and investigate immediately.');
    }
    const loupe = await getReadContract(hre, publicClient, 'DiamondLoupePallet', runtime);
    const registerFacet = getAddress(await loupe.read.facetAddress([MUSIC_REGISTRY_REGISTER_SELECTOR], { blockNumber: finalizedReceipt.blockNumber }));
    if (registerFacet !== targetFacet) throw new Error(`musicRegRegister still routes to ${registerFacet}, expected ${targetFacet}.`);
    for (const preserved of plan.preservedSelectorRoutes) {
      const actual = getAddress(await loupe.read.facetAddress([preserved.selector], { blockNumber: finalizedReceipt.blockNumber }));
      if (actual !== preserved.facet) throw new Error(`Preserved selector ${preserved.name} moved from ${preserved.facet} to ${actual}.`);
    }
    const afterProbe = await probeOwnerGuard(publicClient, runtime, source.abi, before.owner, finalizedReceipt.blockNumber);
    if (afterProbe.status !== 'protected') {
      throw new Error(`Post-upgrade outsider probe is ${afterProbe.status}: ${afterProbe.detail}`);
    }

    const verification = {
      ...plan,
      status: 'verified-finalized',
      preflight,
      signer: getAddress(wallet.account.address),
      nonce: ownerNonce,
      transactionHash: signed.transactionHash,
      receiptBlockNumber: finalizedReceipt.blockNumber.toString(),
      receiptBlockHash: finalizedReceipt.blockHash,
      finalizedBlockNumber: finalizedBlockNumber.toString(),
      catalogueStatePreserved: true,
      outsiderProbe: afterProbe
    };
    overwriteReservedJson(args.out, verification);
    console.log(formatJson(verification));
  });

async function getPublicClient(hre: HardhatRuntimeEnvironment): Promise<PublicClient> {
  return (
    hre.network.name === 'polkadotTestnet' ? await hre.viem.getPublicClient({ chain: POLKADOT_TESTNET_CHAIN }) : await hre.viem.getPublicClient()
  ) as PublicClient;
}

async function getOwnerWallet(hre: HardhatRuntimeEnvironment, role: string) {
  const [wallet] =
    hre.network.name === 'polkadotTestnet' ? await hre.viem.getWalletClients({ chain: POLKADOT_TESTNET_CHAIN }) : await hre.viem.getWalletClients();
  if (!wallet?.account) {
    throw new Error(`No ${role} wallet configured. Set PRIVATE_KEY through Hardhat vars on the signing machine.`);
  }
  return wallet;
}

type SignableWallet = Awaited<ReturnType<typeof getOwnerWallet>>;

type SignedRawTransaction = {
  nonce: number;
  serializedTransaction: Hex;
  transactionHash: Hex;
};

async function signRawTransaction(
  hre: HardhatRuntimeEnvironment,
  wallet: SignableWallet,
  request: { to?: Address; data: Hex; value: bigint; nonce: number }
): Promise<SignedRawTransaction> {
  const signer =
    typeof wallet.account.signTransaction === 'function'
      ? wallet.account
      : hre.network.name === 'hardhat'
        ? privateKeyToAccount(HARDHAT_FIRST_ACCOUNT_PRIVATE_KEY)
        : undefined;
  if (!signer) {
    throw new Error('Configured wallet is not a local signer. Use a local PRIVATE_KEY so transaction bytes and hash can be persisted before broadcast.');
  }
  if (getAddress(signer.address) !== getAddress(wallet.account.address)) {
    throw new Error(`Prepared signer ${signer.address} does not match wallet account ${wallet.account.address}.`);
  }
  const prepared = await wallet.prepareTransactionRequest({
    account: wallet.account,
    to: request.to,
    data: request.data,
    value: request.value,
    nonce: request.nonce
  });
  if (prepared.nonce === undefined) throw new Error('Prepared transaction did not include a nonce.');
  const serializedTransaction = await signer.signTransaction(prepared as never, { serializer: wallet.chain?.serializers?.transaction });
  return {
    nonce: prepared.nonce,
    serializedTransaction,
    transactionHash: keccak256(serializedTransaction)
  };
}

async function waitForCanonicalFinality(
  hre: HardhatRuntimeEnvironment,
  publicClient: PublicClient,
  transactionHash: Hex,
  receipt: TransactionReceipt
): Promise<{ receipt: TransactionReceipt; finalizedBlockNumber: bigint }> {
  if (receipt.transactionHash !== transactionHash) {
    throw new Error(`Receipt hash ${receipt.transactionHash} differs from expected transaction hash ${transactionHash}.`);
  }
  if (hre.network.name === 'hardhat') return { receipt, finalizedBlockNumber: receipt.blockNumber };

  const timeoutAt = Date.now() + 10 * 60_000;
  while (Date.now() < timeoutAt) {
    const finalizedBlock = await publicClient.getBlock({ blockTag: 'finalized' });
    if (finalizedBlock.number >= receipt.blockNumber) {
      const canonicalReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
      if (
        canonicalReceipt.transactionHash !== transactionHash ||
        canonicalReceipt.status !== receipt.status ||
        canonicalReceipt.blockNumber !== receipt.blockNumber ||
        canonicalReceipt.blockHash !== receipt.blockHash
      ) {
        throw new Error(`Transaction ${transactionHash} receipt changed before finality. Do not trust the previous manifest; re-audit before retrying.`);
      }
      return { receipt: canonicalReceipt, finalizedBlockNumber: finalizedBlock.number };
    }
    await new Promise(resolve => setTimeout(resolve, 6_000));
  }
  throw new Error(`Timed out waiting for receipt block ${receipt.blockNumber} to become finalized.`);
}

async function getRegistrySource(hre: HardhatRuntimeEnvironment) {
  const artifact = await hre.artifacts.readArtifact('MusicRegistryPallet');
  const abi = artifact.abi as Abi;
  const selectors = assertRegistryArtifact(abi);
  const bytecode = artifact.bytecode as Hex;
  const deployedBytecode = artifact.deployedBytecode as Hex;
  if (!bytecode || bytecode === '0x') throw new Error('MusicRegistryPallet creation bytecode is missing. Compile contracts first.');
  if (!deployedBytecode || deployedBytecode === '0x') throw new Error('MusicRegistryPallet deployed bytecode is missing. Compile contracts first.');
  return { abi, selectors, bytecode, deployedBytecode, codeHash: keccak256(deployedBytecode) };
}

async function auditRuntime(
  hre: HardhatRuntimeEnvironment,
  publicClient: PublicClient,
  runtime: Address,
  directoryArtist: Address,
  registryAbi: Abi,
  selectors: RegistrySelector[],
  correctedCodeHash: Hex,
  blockNumber: bigint
): Promise<RuntimeAudit> {
  const runtimeCode = await publicClient.getCode({ address: runtime, blockNumber });
  if (!runtimeCode || runtimeCode === '0x') throw new Error(`Runtime ${runtime} has no contract code.`);
  const ownership = await getReadContract(hre, publicClient, 'OwnershipPallet', runtime);
  const loupe = await getReadContract(hre, publicClient, 'DiamondLoupePallet', runtime);
  const registry = await getReadContract(hre, publicClient, 'MusicRegistryPallet', runtime);
  const owner = getAddress(await ownership.read.owner({ blockNumber }));
  const selectorRoutes = [] as RuntimeAudit['selectorRoutes'];
  const facetCodeHashes = new Map<Address, Hex | null>();
  for (const selector of selectors) {
    const facet = getAddress(await loupe.read.facetAddress([selector.selector], { blockNumber }));
    let codeHash = facetCodeHashes.get(facet);
    if (codeHash === undefined) {
      codeHash = facet === zeroAddress ? null : await readCodeHash(publicClient, facet, blockNumber);
      facetCodeHashes.set(facet, codeHash);
    }
    selectorRoutes.push({ ...selector, facet, codeHash });
  }
  const registerFacet = selectorRoutes.find(route => route.selector === MUSIC_REGISTRY_REGISTER_SELECTOR)?.facet;
  if (!registerFacet || registerFacet === zeroAddress) throw new Error(`Runtime ${runtime} does not route musicRegRegister.`);
  const registerFacetCodeHash = await readCodeHash(publicClient, registerFacet, blockNumber);
  const trackCount = await registry.read.musicRegTrackCount({ blockNumber });
  const foreignTrackHashes = [] as Hex[];
  const transferredTokenHashes = [] as Hex[];
  for (let index = 0n; index < trackCount; index += 1n) {
    const hash = await registry.read.musicRegTrackHashAtIndex([index], { blockNumber });
    const [track, tokenOwner] = await registry.read.musicRegGetTrack([hash], { blockNumber });
    if (getAddress(track.artist) !== owner) foreignTrackHashes.push(hash);
    if (getAddress(tokenOwner) !== owner) transferredTokenHashes.push(hash);
  }
  return {
    runtime,
    directoryArtist,
    owner,
    ownerMatchesDirectoryArtist: owner === directoryArtist,
    registerFacet,
    registerFacetCodeHash,
    registerFacetMatchesSource: registerFacetCodeHash === correctedCodeHash,
    guard: await probeOwnerGuard(publicClient, runtime, registryAbi, owner, blockNumber),
    trackCount: trackCount.toString(),
    foreignTrackHashes,
    transferredTokenHashes,
    selectorRoutes
  };
}

async function readCatalogueSnapshot(
  hre: HardhatRuntimeEnvironment,
  publicClient: PublicClient,
  runtime: Address,
  blockNumber: bigint
): Promise<CatalogueSnapshot> {
  const ownership = await getReadContract(hre, publicClient, 'OwnershipPallet', runtime);
  const registry = await getReadContract(hre, publicClient, 'MusicRegistryPallet', runtime);
  const royalties = await getReadContract(hre, publicClient, 'MusicRoyaltiesPallet', runtime);
  const owner = getAddress(await ownership.read.owner({ blockNumber }));
  const trackCount = await registry.read.musicRegTrackCount({ blockNumber });
  const tracks: CatalogueSnapshot['tracks'] = [];

  for (let index = 0n; index < trackCount; index += 1n) {
    const hash = await registry.read.musicRegTrackHashAtIndex([index], { blockNumber });
    const [record, tokenOwner] = await registry.read.musicRegGetTrack([hash], { blockNumber });
    const splitCount = await royalties.read.musicRoySplitCount([hash], { blockNumber });
    const royaltySplits: CatalogueSnapshot['tracks'][number]['royaltySplits'] = [];
    for (let splitIndex = 0n; splitIndex < splitCount; splitIndex += 1n) {
      const [recipient, bps] = await royalties.read.musicRoySplitAt([hash, splitIndex], { blockNumber });
      royaltySplits.push({ recipient: getAddress(recipient), bps: bps.toString() });
    }
    tracks.push({
      hash,
      record,
      tokenOwner: getAddress(tokenOwner),
      royaltySplits,
      totalBps: (await royalties.read.musicRoyTotalBps([hash], { blockNumber })).toString()
    });
  }

  return { owner, trackCount: trackCount.toString(), tracks };
}

async function buildUpgradePlan(
  hre: HardhatRuntimeEnvironment,
  publicClient: PublicClient,
  runtime: Address,
  targetFacet: Address,
  targetCodeHash: Hex,
  selectors: RegistrySelector[],
  snapshot: CatalogueSnapshot,
  capturedBlockNumber: bigint,
  capturedBlockHash: Hex
): Promise<RegistryUpgradePlan> {
  const chainId = await publicClient.getChainId();
  const loupe = await getReadContract(hre, publicClient, 'DiamondLoupePallet', runtime);
  const routes = [] as Array<RegistrySelector & { facet: Address }>;
  for (const selector of selectors) {
    routes.push({ ...selector, facet: getAddress(await loupe.read.facetAddress([selector.selector], { blockNumber: capturedBlockNumber })) });
  }
  const register = routes.find(route => route.selector === MUSIC_REGISTRY_REGISTER_SELECTOR);
  if (!register || register.facet === zeroAddress) throw new Error(`Runtime ${runtime} does not expose musicRegRegister.`);
  const diamondCutArtifact = await hre.artifacts.readArtifact('DiamondCutPallet');
  const body: RegistryUpgradePlanBody = {
    schema: 'dotify.registry-owner-guard.v1',
    chainId,
    capturedBlockNumber: capturedBlockNumber.toString(),
    capturedBlockHash,
    runtime,
    owner: snapshot.owner,
    expectedOldFacet: register.facet,
    targetFacet,
    targetCodeHash,
    selector: MUSIC_REGISTRY_REGISTER_SELECTOR,
    trackStateHash: hashCanonical(snapshot),
    preservedSelectorRoutes: routes.filter(route => route.selector !== MUSIC_REGISTRY_REGISTER_SELECTOR),
    transaction: buildRegistryHotfixTransaction(diamondCutArtifact.abi as Abi, runtime, targetFacet)
  };
  return { ...body, digest: registryUpgradePlanDigest(body), evidenceDigest: hashCanonical(body) };
}

async function probeOwnerGuard(publicClient: PublicClient, runtime: Address, registryAbi: Abi, owner: Address, blockNumber: bigint): Promise<GuardProbe> {
  const outsider =
    owner.toLowerCase() === '0x000000000000000000000000000000000000dead'
      ? getAddress('0x0000000000000000000000000000000000000001')
      : getAddress('0x000000000000000000000000000000000000dEaD');
  const contentHash = keccak256(toBytes(`dotify:registry-owner-guard-audit:${runtime.toLowerCase()}`));
  const data = encodeFunctionData({
    abi: registryAbi,
    functionName: 'musicRegRegister',
    args: [
      {
        contentHash,
        title: 'Registry owner guard audit',
        artistName: 'Read-only outsider probe',
        description: 'This state-changing call is simulated with eth_call and is never broadcast.',
        imageRef: 'audit:image',
        audioRef: 'audit:audio',
        metadataRef: 'audit:metadata',
        artistContractRef: 'audit:contract',
        accessMode: 1,
        pricePlanck: 1n,
        requiredPersonhood: 0
      },
      [outsider],
      [10_000]
    ]
  });

  try {
    await publicClient.call({ account: outsider, to: runtime, data, blockNumber });
    return { status: 'vulnerable', detail: 'Outsider registration simulation succeeded.' };
  } catch (error) {
    const detail = errorDetails(error);
    return /LibDiamond: not owner/i.test(detail)
      ? { status: 'protected', detail: 'Outsider simulation reverted with LibDiamond: not owner.' }
      : { status: 'inconclusive', detail: firstLine(detail) };
  }
}

async function simulateRawCall(publicClient: PublicClient, account: Address, to: Address, data: Hex, label: string, blockNumber: bigint) {
  try {
    await publicClient.call({ account, to, data, blockNumber });
  } catch (error) {
    throw new Error(`${label} failed: ${firstLine(errorDetails(error))}`);
  }
}

async function readCodeHash(publicClient: PublicClient, address: Address, blockNumber?: bigint): Promise<Hex | null> {
  const code = await publicClient.getCode({ address, blockNumber });
  return code && code !== '0x' ? keccak256(code) : null;
}

async function discoverPendingRuntimes(
  hre: HardhatRuntimeEnvironment,
  publicClient: PublicClient,
  factoryAddress: Address,
  latestBlock: bigint
): Promise<PendingDiscovery> {
  try {
    const deploymentBlock = await findDeploymentBlock(publicClient, factoryAddress, latestBlock);
    const started = new Map<Address, Address>();
    for (let fromBlock = deploymentBlock; fromBlock <= latestBlock; fromBlock += PENDING_RUNTIME_PAGE_SIZE) {
      const toBlock = fromBlock + PENDING_RUNTIME_PAGE_SIZE - 1n > latestBlock ? latestBlock : fromBlock + PENDING_RUNTIME_PAGE_SIZE - 1n;
      const logs = await publicClient.getLogs({ address: factoryAddress, event: bootstrapStartedEvent, fromBlock, toBlock });
      for (const log of logs) {
        if (log.args.artist && log.args.runtime) started.set(getAddress(log.args.artist), getAddress(log.args.runtime));
      }
    }

    const factory = await getReadContract(hre, publicClient, 'ArtistRuntimeFactory', factoryAddress);
    const pending = [] as PendingRuntime[];
    for (const [artist] of started) {
      const runtime = getAddress(await factory.read.pendingRuntimeOf([artist], { blockNumber: latestBlock }));
      if (runtime === zeroAddress) continue;
      pending.push({
        artist,
        runtime,
        stage: Number(await factory.read.pendingRuntimeStageOf([artist], { blockNumber: latestBlock }))
      });
    }
    return { status: 'complete', deploymentBlock: deploymentBlock.toString(), runtimes: pending };
  } catch (error) {
    return { status: 'unavailable', detail: firstLine(errorDetails(error)), runtimes: [] };
  }
}

async function findDeploymentBlock(publicClient: PublicClient, address: Address, latestBlock: bigint): Promise<bigint> {
  const latestCode = await publicClient.getCode({ address, blockNumber: latestBlock });
  if (!latestCode || latestCode === '0x') throw new Error(`Factory ${address} has no code at audit block ${latestBlock}.`);
  let low = 0n;
  let high = latestBlock;
  while (low < high) {
    const middle = (low + high) / 2n;
    const code = await publicClient.getCode({ address, blockNumber: middle });
    if (code && code !== '0x') high = middle;
    else low = middle + 1n;
  }
  return low;
}

function writeJson(outputPath: string, value: unknown) {
  const absolutePath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeDurableFile(absolutePath, `${formatJson(value)}\n`, 'wx');
  fsyncDirectory(path.dirname(absolutePath));
  console.log(`Wrote ${absolutePath}`);
}

function assertOutputPathAvailable(outputPath: string) {
  const absolutePath = path.resolve(outputPath);
  if (fs.existsSync(absolutePath)) {
    throw new Error(`Refusing to overwrite existing evidence: ${absolutePath}`);
  }
}

function reserveJsonOutput(outputPath: string, value: unknown) {
  assertOutputPathAvailable(outputPath);
  writeJson(outputPath, value);
}

function overwriteReservedJson(outputPath: string, value: unknown) {
  const absolutePath = path.resolve(outputPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Reserved evidence path disappeared before finalization: ${absolutePath}`);
  const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
  writeDurableFile(temporaryPath, `${formatJson(value)}\n`, 'wx');
  fs.renameSync(temporaryPath, absolutePath);
  fsyncDirectory(path.dirname(absolutePath));
  console.log(`Updated ${absolutePath}`);
}

function writeDurableFile(filePath: string, contents: string, flag: 'w' | 'wx') {
  const descriptor = fs.openSync(filePath, flag, 0o600);
  try {
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function fsyncDirectory(directoryPath: string) {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(directoryPath, 'r');
    fs.fsyncSync(descriptor);
  } catch {
    // Some filesystems do not support fsync on directories. The manifest file
    // itself is still fsynced before the atomic rename.
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function formatJson(value: unknown) {
  return JSON.stringify(JSON.parse(canonicalJson(value)), null, 2);
}

function errorDetails(error: unknown): string {
  const details: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown };
    for (const value of [candidate.shortMessage, candidate.details, candidate.message]) {
      if (typeof value === 'string' && !details.includes(value)) details.push(value);
    }
    current = candidate.cause;
  }
  return details.join(' | ') || String(error);
}

function firstLine(value: string) {
  return value.split('\n')[0] ?? value;
}

async function getReadContract(hre: HardhatRuntimeEnvironment, publicClient: PublicClient, contractName: string, address: Address): Promise<any> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  return getContract({ address, abi: artifact.abi as Abi, client: { public: publicClient } });
}
