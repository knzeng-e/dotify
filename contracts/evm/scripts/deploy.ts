/**
 * Dotify — Smart Runtime deployment script
 *
 * Deploys the full Artist Runtime system:
 *   1. 7 shared pallet implementations (DiamondCut, DiamondLoupe, Ownership,
 *      MusicRegistry, MusicRoyalties, MusicAccess, MusicMetadata)
 *   2. DotifyRuntimeInitializer (bootstraps each new artist runtime)
 *   3. ArtistDirectory        (artist → SmartRuntime index)
 *   4. ArtistRuntimeFactory   (bootstraps a staged SmartRuntime per artist)
 *   5. Wires the factory into the directory (setFactory)
 *
 * Outputs:
 *   - deployments.json   (source of truth for addresses)
 *   - web/src/shared/config/deployments.ts  (TypeScript constants for the DApp)
 *   - automatic explorer verification through the Hardhat verification backends enabled for the target network
 */

import hre from 'hardhat';
import { deploySmartRuntimeSystem } from './deploySystem';
import { getDeployConfig, nativeTokenDecimalsForDeployment, verifySmartRuntimeSystem, writeDeployments } from './smartRuntime';

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying Dotify Smart Runtime system on [${network}]...\n`);

  const nativeTokenDecimals = nativeTokenDecimalsForDeployment();
  const cfg = await getDeployConfig(hre);

  const deployments = await deploySmartRuntimeSystem(hre, nativeTokenDecimals, cfg);
  writeDeployments(deployments);

  if (process.env.SKIP_VERIFY === '1') {
    console.log('\nSkipping verification because SKIP_VERIFY=1.');
  } else {
    await verifySmartRuntimeSystem(hre, deployments, {
      delayMs: 60_000,
      attempts: 5
    });
  }

  console.log('\n✓ Dotify Smart Runtime deployed successfully!\n');
  console.log('  ArtistDirectory  :', deployments.directory);
  console.log('  ArtistRuntimeFactory:', deployments.factory);
  console.log('\n  Artists can now call factory.createRuntime(), then factory.installRuntimeStep() until finalized.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
