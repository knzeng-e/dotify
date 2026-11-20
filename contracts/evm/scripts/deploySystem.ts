import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { buildFactoryConstructorArguments, getDeployConfig, PALLET_CONTRACTS, type SmartRuntimeDeployments } from './smartRuntime';

/** Shared by the operator entry point and local deployment regressions. Writes on the selected chain. */
export async function deploySmartRuntimeSystem(
  hre: HardhatRuntimeEnvironment,
  nativeTokenDecimals: number,
  cfg: Awaited<ReturnType<typeof getDeployConfig>>
): Promise<SmartRuntimeDeployments> {
  if (!Number.isInteger(nativeTokenDecimals) || nativeTokenDecimals < 0 || nativeTokenDecimals > 18) throw new Error('Unsupported native precision');
  const pallets = {} as SmartRuntimeDeployments['pallets'];
  for (const [key, name] of PALLET_CONTRACTS) {
    const deployed = await hre.viem.deployContract(name, [], cfg);
    pallets[key] = deployed.address;
    console.log(`${name}: ${deployed.address}`);
  }
  const initializer = await hre.viem.deployContract('DotifyRuntimeInitializer', [], cfg);
  console.log(`DotifyRuntimeInitializer: ${initializer.address}`);
  const directory = await hre.viem.deployContract('ArtistDirectory', [], cfg);
  console.log(`ArtistDirectory: ${directory.address}`);
  const configuration = { nativeTokenDecimals, pallets, directory: directory.address, initializer: initializer.address };
  const factory = await hre.viem.deployContract('ArtistRuntimeFactory', [...(await buildFactoryConstructorArguments(hre, configuration))], cfg);
  console.log(`ArtistRuntimeFactory: ${factory.address}`);
  const wiringHash = await directory.write.setFactory([factory.address]);
  console.log(`Directory factory wiring: ${wiringHash}`);
  const publicClient = cfg.client?.public ?? (await hre.viem.getPublicClient());
  const receipt = await publicClient.waitForTransactionReceipt({ hash: wiringHash });
  if (receipt.status !== 'success') throw new Error('Directory factory wiring failed');
  return { ...configuration, factory: factory.address };
}
