// Read-only preparation for the owner-requested fresh testnet deployment.
import hre from 'hardhat';
import { execFileSync } from 'node:child_process';
import { formatEther } from 'viem';
import { nativeTokenDecimalsForDeployment, POLKADOT_TESTNET_CHAIN, readDeployments } from './smartRuntime';
import { freshArtifactInventory, freshDeploymentAccount, FRESH_CORE_TRANSACTION_COUNT } from './freshDeployment';
async function main() {
  if (hre.network.name !== 'polkadotTestnet') throw new Error('Fresh-reset planning targets the existing test environment only');
  const nativeTokenDecimals = nativeTokenDecimalsForDeployment();
  const deployer = freshDeploymentAccount(process.env.DOTIFY_DEPLOYER_ADDRESS);
  const client = await hre.viem.getPublicClient({ chain: POLKADOT_TESTNET_CHAIN });
  const chainId = await client.getChainId();
  if (chainId !== 420420417) throw new Error('Unexpected chain; no reset is prepared');
  const artifacts = await freshArtifactInventory(hre);
  const block = await client.getBlock({ blockTag: 'finalized' });
  console.log(
    JSON.stringify({
      schema: 'dotify.fresh-deployment-plan.v2',
      source: {
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        clean: execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).trim().length === 0
      },
      chainId,
      nativeTokenDecimals,
      deployer,
      finalizedBlock: { number: String(block.number), hash: block.hash },
      nonce: await client.getTransactionCount({ address: deployer, blockTag: 'pending' }),
      balanceTestPas: formatEther(await client.getBalance({ address: deployer, blockNumber: block.number })),
      previous: readDeployments(),
      contracts: artifacts,
      plannedTransactions: FRESH_CORE_TRANSACTION_COUNT,
      transactionScope: 'Core creations and directory wiring only; excludes CDM, storage, clients and artist bootstrap',
      signingAuthority: 'none',
      nativeAndHostAcceptance: 'pending',
      oldDeploymentModified: false,
      oldStorageObjectsDeleted: false
    })
  );
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Deployment preparation failed');
  process.exitCode = 1;
});
