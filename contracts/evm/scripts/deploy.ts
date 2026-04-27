/**
 * Dotify — Smart Runtime deployment script
 *
 * Deploys the full Artist Runtime system:
 *   1. 7 shared pallet implementations (DiamondCut, DiamondLoupe, Ownership,
 *      MusicRegistry, MusicNFT, MusicRoyalties, MusicAccess)
 *   2. DotifyRuntimeInitializer (bootstraps each new artist runtime)
 *   3. ArtistDirectory        (artist → SmartRuntime index)
 *   4. ArtistRuntimeFactory   (deploys a SmartRuntime per artist on demand)
 *   5. Wires the factory into the directory (setFactory)
 *
 * Outputs:
 *   - deployments.json   (source of truth for addresses)
 *   - web/src/config/deployments.ts  (TypeScript constants for the DApp)
 *   - automatic explorer verification through the Hardhat verification backends enabled for the target network
 */

import hre from 'hardhat';
import { buildFactorySelectors, getDeployConfig, verifySmartRuntimeSystem, writeDeployments } from './smartRuntime';

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying Dotify Smart Runtime system on [${network}]...\n`);

  const cfg = await getDeployConfig(hre);

  // ── 1. Shared pallet implementations ──────────────────────────────────────
  console.log('Step 1/5 — Deploying shared pallet implementations');

  const cutPallet = await hre.viem.deployContract('DiamondCutPallet', [], cfg);
  const loupePallet = await hre.viem.deployContract('DiamondLoupePallet', [], cfg);
  const ownershipPallet = await hre.viem.deployContract('OwnershipPallet', [], cfg);
  const registryPallet = await hre.viem.deployContract('MusicRegistryPallet', [], cfg);
  const nftPallet = await hre.viem.deployContract('MusicNFTPallet', [], cfg);
  const royaltiesPallet = await hre.viem.deployContract('MusicRoyaltiesPallet', [], cfg);
  const accessPallet = await hre.viem.deployContract('MusicAccessPallet', [], cfg);

  console.log(`  DiamondCutPallet     : ${cutPallet.address}`);
  console.log(`  DiamondLoupePallet   : ${loupePallet.address}`);
  console.log(`  OwnershipPallet      : ${ownershipPallet.address}`);
  console.log(`  MusicRegistryPallet  : ${registryPallet.address}`);
  console.log(`  MusicNFTPallet       : ${nftPallet.address}`);
  console.log(`  MusicRoyaltiesPallet : ${royaltiesPallet.address}`);
  console.log(`  MusicAccessPallet    : ${accessPallet.address}`);

  // ── 2. Initializer ─────────────────────────────────────────────────────────
  console.log('\nStep 2/5 — Deploying DotifyRuntimeInitializer');
  const initializer = await hre.viem.deployContract('DotifyRuntimeInitializer', [], cfg);
  console.log(`  DotifyRuntimeInitializer: ${initializer.address}`);

  // ── 3. ArtistDirectory ─────────────────────────────────────────────────────
  console.log('\nStep 3/5 — Deploying ArtistDirectory');
  const directory = await hre.viem.deployContract('ArtistDirectory', [], cfg);
  console.log(`  ArtistDirectory: ${directory.address}`);

  // ── 4. ArtistRuntimeFactory ────────────────────────────────────────────────
  console.log('\nStep 4/5 — Deploying ArtistRuntimeFactory');
  const selectors = await buildFactorySelectors(hre);

  const factory = await hre.viem.deployContract(
    'ArtistRuntimeFactory',
    [
      directory.address,
      initializer.address,
      cutPallet.address,
      loupePallet.address,
      ownershipPallet.address,
      registryPallet.address,
      nftPallet.address,
      royaltiesPallet.address,
      accessPallet.address,
      selectors
    ],
    cfg
  );
  console.log(`  ArtistRuntimeFactory: ${factory.address}`);

  // ── 5. Wire factory into directory ─────────────────────────────────────────
  console.log('\nStep 5/5 — Wiring factory into ArtistDirectory');
  await directory.write.setFactory([factory.address]);
  console.log('  ✓ ArtistDirectory.factory set');

  // ── Write deployment artifacts ─────────────────────────────────────────────
  console.log('\nWriting deployment artifacts...');
  writeDeployments({
    factory: factory.address,
    directory: directory.address,
    initializer: initializer.address,
    pallets: {
      cutPallet: cutPallet.address,
      loupePallet: loupePallet.address,
      ownershipPallet: ownershipPallet.address,
      registryPallet: registryPallet.address,
      nftPallet: nftPallet.address,
      royaltiesPallet: royaltiesPallet.address,
      accessPallet: accessPallet.address
    }
  });

  if (process.env.SKIP_VERIFY === '1') {
    console.log('\nSkipping verification because SKIP_VERIFY=1.');
  } else {
    await verifySmartRuntimeSystem(
      hre,
      {
        factory: factory.address,
        directory: directory.address,
        initializer: initializer.address,
        pallets: {
          cutPallet: cutPallet.address,
          loupePallet: loupePallet.address,
          ownershipPallet: ownershipPallet.address,
          registryPallet: registryPallet.address,
          nftPallet: nftPallet.address,
          royaltiesPallet: royaltiesPallet.address,
          accessPallet: accessPallet.address
        }
      },
      {
        delayMs: 60_000,
        attempts: 5
      }
    );
  }

  console.log('\n✓ Dotify Smart Runtime deployed successfully!\n');
  console.log('  ArtistDirectory  :', directory.address);
  console.log('  ArtistRuntimeFactory:', factory.address);
  console.log('\n  Artists can now call factory.createRuntime() to get their SmartRuntime.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
