// Public, finalized readback only. Never signs or changes deployed state.
import hre from 'hardhat';
import { createPublicClient, http } from 'viem';
import { POLKADOT_TESTNET_CHAIN, readDeployments } from './smartRuntime';
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
  const matches = [];
  for (const [name, address] of [
    ['@dotify/artist-directory', record.directory],
    ['@dotify/artist-runtime-factory', record.factory]
  ] as const) {
    const versions = [];
    for (let version = 0; version < 8; version++) {
      const result = await client.readContract({
        address: '0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f',
        abi,
        functionName: 'getAddressAtVersion',
        args: [name, version],
        blockNumber: block.number
      });
      if (result.isSome && result.value.toLowerCase() === address.toLowerCase()) versions.push(version);
    }
    if (!versions.length) throw new Error('New address is not finalized in the CDM registry');
    matches.push({ name, address, versions });
  }
  console.log(
    JSON.stringify({ schema: 'dotify.fresh-cdm-readback.v1', chainId: 420420417, blockNumber: Number(block.number), blockHash: block.hash, packages: matches })
  );
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Readback failed');
  process.exitCode = 1;
});
