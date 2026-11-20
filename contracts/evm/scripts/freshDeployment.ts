import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getAddress, isAddress, keccak256, zeroAddress, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { PALLET_CONTRACTS, type SmartRuntimeDeploymentRecord, type SmartRuntimeDeployments } from './smartRuntime';

export const FRESH_CONTRACT_NAMES = [
  ...PALLET_CONTRACTS.map(([, name]) => name),
  'DotifyRuntimeInitializer',
  'ArtistDirectory',
  'ArtistRuntimeFactory'
] as const;
export const FRESH_CORE_TRANSACTION_COUNT = FRESH_CONTRACT_NAMES.length + 1;

/** A public address is sufficient for planning; never construct a signing client here. */
export function freshDeploymentAccount(value: string | undefined) {
  if (!value || !isAddress(value) || value.toLowerCase() === zeroAddress)
    throw new Error('Set DOTIFY_DEPLOYER_ADDRESS to an explicit nonzero public deployment address');
  return getAddress(value);
}

export async function freshArtifactInventory(hre: HardhatRuntimeEnvironment) {
  return Promise.all(
    FRESH_CONTRACT_NAMES.map(async name => {
      const artifact = await hre.artifacts.readArtifact(name);
      return { name, creationCodeHash: keccak256(artifact.bytecode as `0x${string}`) };
    })
  );
}

/** Verify the new core at one explicit block before any active-generation cutover. */
export async function inspectFreshSystem(
  hre: HardhatRuntimeEnvironment,
  client: PublicClient,
  record: SmartRuntimeDeploymentRecord,
  blockNumber: bigint,
  expectedDeployer: Address
) {
  if (record.nativeTokenDecimals === undefined || !record.initializer || !PALLET_CONTRACTS.every(([key]) => record.pallets[key]))
    throw new Error('Incomplete fresh deployment manifest; metadata and native precision are required');
  const deployments = record as SmartRuntimeDeployments;
  const factoryAbi = (await hre.artifacts.readArtifact('ArtistRuntimeFactory')).abi as Abi;
  const directoryAbi = (await hre.artifacts.readArtifact('ArtistDirectory')).abi as Abi;
  const readFactory = (functionName: string) => client.readContract({ address: record.factory, abi: factoryAbi, functionName, blockNumber });
  const expected = { directory: deployments.directory, initContract: deployments.initializer, ...deployments.pallets };
  for (const [name, address] of Object.entries(expected)) {
    if (!isAddress(address) || address.toLowerCase() === zeroAddress) throw new Error(`Invalid ${name} address`);
    const actual = await readFactory(name);
    if (typeof actual !== 'string' || actual.toLowerCase() !== address.toLowerCase()) throw new Error(`Factory ${name} does not match the fresh manifest`);
  }
  if (Number(await readFactory('nativeTokenDecimals')) !== deployments.nativeTokenDecimals)
    throw new Error('Factory native precision does not match the fresh manifest');
  const pairedFactory = await client.readContract({ address: deployments.directory, abi: directoryAbi, functionName: 'factory', blockNumber });
  if (String(pairedFactory).toLowerCase() !== deployments.factory.toLowerCase()) throw new Error('Directory/factory pairing mismatch');
  const deployer = await client.readContract({ address: deployments.directory, abi: directoryAbi, functionName: 'deployer', blockNumber });
  if (String(deployer).toLowerCase() !== expectedDeployer.toLowerCase()) throw new Error('Directory deployer does not match the explicit plan account');
  const artists = await client.readContract({ address: deployments.directory, abi: directoryAbi, functionName: 'artistCount', blockNumber });
  if (artists !== 0n) throw new Error('Fresh directory must be empty before cutover');
  const implementations = [
    ...PALLET_CONTRACTS.map(([key, name]) => [deployments.pallets[key], name] as const),
    [deployments.initializer, 'DotifyRuntimeInitializer'],
    [deployments.directory, 'ArtistDirectory'],
    [deployments.factory, 'ArtistRuntimeFactory']
  ] as const;
  for (const [address, name] of implementations) {
    const code = await client.getCode({ address, blockNumber });
    const artifact = await hre.artifacts.readArtifact(name);
    const build = await hre.artifacts.getBuildInfo(`${artifact.sourceName}:${name}`);
    const references = build?.output.contracts[artifact.sourceName]?.[name]?.evm.deployedBytecode.immutableReferences;
    if (!code || code === '0x' || !references || !matchesReviewedCode(code, artifact.deployedBytecode as Hex, references))
      throw new Error(`${name} bytecode does not match the reviewed source`);
  }
  return {
    nativeTokenDecimals: deployments.nativeTokenDecimals,
    artistCount: '0',
    deployer,
    verifiedImplementations: implementations.map(([, name]) => name)
  };
}

/** Mask only compiler-declared immutable slots; their values are checked through getters above. */
function matchesReviewedCode(actual: Hex, expected: Hex, references: Record<string, { start: number; length: number }[]>) {
  if (actual.length !== expected.length) return false;
  let normalizedActual: string = actual;
  let normalizedExpected: string = expected;
  for (const { start, length } of Object.values(references).flat()) {
    const offset = 2 + start * 2;
    const end = offset + length * 2;
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length <= 0 || end > actual.length) return false;
    normalizedActual = normalizedActual.slice(0, offset) + '0'.repeat(length * 2) + normalizedActual.slice(end);
    normalizedExpected = normalizedExpected.slice(0, offset) + '0'.repeat(length * 2) + normalizedExpected.slice(end);
  }
  return normalizedActual.toLowerCase() === normalizedExpected.toLowerCase();
}

/** Exact finalized versions, never a search for any historical matching address. */
export function freshCdmPackages(snapshot: unknown, record: SmartRuntimeDeploymentRecord) {
  const cdm = snapshot as { dependencies?: Record<string, number>; contracts?: Record<string, { version?: number; address?: string; metadataCid?: string }> };
  return (
    [
      ['@dotify/artist-directory', record.directory],
      ['@dotify/artist-runtime-factory', record.factory]
    ] as const
  ).map(([name, address]) => {
    const entry = cdm?.contracts?.[name];
    const version = cdm?.dependencies?.[name];
    if (
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version < 0 ||
      version > 0xffffffff ||
      entry?.version !== version ||
      typeof entry?.address !== 'string' ||
      entry.address.toLowerCase() !== address.toLowerCase()
    )
      throw new Error(`CDM snapshot does not bind the exact ${name} address/version`);
    return { name, address, version };
  });
}
