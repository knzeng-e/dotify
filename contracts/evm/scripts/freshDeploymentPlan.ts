// Read-only preparation for the owner-requested fresh testnet deployment.
import hre from 'hardhat';
import { formatEther, keccak256 } from 'viem';
import { getDeployConfig, readDeployments } from './smartRuntime';
async function main() {
  if (hre.network.name !== 'polkadotTestnet') throw new Error('Fresh-reset planning targets the existing test environment only');
  const cfg = await getDeployConfig(hre);
  const client = cfg.client?.public;
  const wallet = cfg.client?.wallet;
  if (!client || !wallet?.account) throw new Error('A configured deployment signer is required');
  const chainId = await client.getChainId();
  if (chainId !== 420420417) throw new Error('Unexpected chain; no reset is prepared');
  const contracts = [
    'DiamondCutPallet',
    'DiamondLoupePallet',
    'OwnershipPallet',
    'MusicRegistryPallet',
    'MusicNFTPallet',
    'MusicRoyaltiesPallet',
    'MusicAccessPallet',
    'DotifyRuntimeInitializer',
    'ArtistDirectory',
    'ArtistRuntimeFactory'
  ];
  const artifacts = await Promise.all(
    contracts.map(async name => ({ name, creationCodeHash: keccak256((await hre.artifacts.readArtifact(name)).bytecode as `0x${string}`) }))
  );
  console.log(
    JSON.stringify({
      schema: 'dotify.fresh-deployment-plan.v1',
      chainId,
      deployer: wallet.account.address,
      balanceTestPas: formatEther(await client.getBalance({ address: wallet.account.address })),
      previous: readDeployments(),
      contracts: artifacts,
      plannedTransactions: 11,
      oldDeploymentModified: false,
      oldIpfsContentDeleted: false
    })
  );
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Deployment preparation failed');
  process.exitCode = 1;
});
