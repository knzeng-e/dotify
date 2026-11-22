// Public, finalized readback only. Never signs or changes deployed state.
import hre from 'hardhat';
import { createPublicClient, http } from 'viem';
import { POLKADOT_TESTNET_CHAIN, readDeployments } from './smartRuntime';
import { freshCdmPackages, freshDeploymentAccount, inspectFreshSystem, reviewedFactoryCodeHash } from './freshDeployment';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNativeEmptyFactoryProof } from './nativeFactoryAudit';
const abi = [
  {
    type: 'function',
    name: 'getAddressAtVersion',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'uint32' }
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'isSome', type: 'bool' },
          { name: 'value', type: 'address' }
        ]
      }
    ]
  }
] as const;
async function main() {
  const client = createPublicClient({ chain: POLKADOT_TESTNET_CHAIN, transport: http((hre.network.config as { url: string }).url) });
  if ((await client.getChainId()) !== 420420417) throw new Error('Unexpected chain');
  const block = await client.getBlock({ blockTag: 'finalized' });
  const record = readDeployments();
  const system = await inspectFreshSystem(hre, client, record, block.number, freshDeploymentAccount(process.env.DOTIFY_DEPLOYER_ADDRESS));
  const factoryCodeHash = await reviewedFactoryCodeHash(hre, client, record.factory, block.number);
  const pendingRuntimeProof = await readNativeEmptyFactoryProof({
    rpcUrl: process.env.DOTIFY_NATIVE_RPC || '',
    block,
    factory: record.factory,
    factoryCodeHash
  });
  const cdm = JSON.parse(readFileSync(resolve(__dirname, '../cdm.json'), 'utf8'));
  if (cdm.registry?.toLowerCase() !== '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f') throw new Error('Unexpected CDM registry');
  const matches = [];
  for (const { name, address, version } of freshCdmPackages(cdm, record)) {
    const result = await client.readContract({
      address: '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f',
      abi,
      functionName: 'getAddressAtVersion',
      args: [name, version],
      blockNumber: block.number
    });
    if (!result.isSome || result.value.toLowerCase() !== address.toLowerCase())
      throw new Error('Exact new address/version is not finalized in the CDM registry');
    matches.push({ name, address, version });
  }
  console.log(
    JSON.stringify({
      schema: 'dotify.fresh-cdm-readback.v3',
      chainId: 420420417,
      ...system,
      pendingRuntimeProof,
      blockNumber: Number(block.number),
      blockHash: block.hash,
      packages: matches
    })
  );
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Readback failed');
  process.exitCode = 1;
});
