import hre from 'hardhat';
import { hydrateDeploymentsFromChain, readDeployments, verifySmartRuntimeSystem, writeDeployments } from './smartRuntime';

async function main() {
  const deployments = await hydrateDeploymentsFromChain(hre, readDeployments());
  writeDeployments(deployments);
  console.log(`\nVerifying Dotify Smart Runtime system on [${hre.network.name}]...\n`);
  await verifySmartRuntimeSystem(hre, deployments, { delayMs: 0 });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
