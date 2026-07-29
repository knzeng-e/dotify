// Register Dotify's already-deployed contracts in the Product CDM registry.
//
// Why a task instead of `cdm deploy`:
//
// `cdm deploy` builds, deploys, publishes metadata, and registers in one pass. Dotify's
// contracts are already deployed and already hold the live catalog, so deploying again
// would mint new addresses and orphan every existing artist runtime. The registry's
// `publishLatest(name, address, metadataUri)` registers a name against an arbitrary
// address, which is exactly the operation Dotify needs and the one the CLI does not
// expose on its own.
//
// Registration is first-writer-owns and there is no release or transfer entry point in
// the registry contract, so claiming a name is effectively permanent. This task is
// therefore read-only by default: it reports what it would do and stops. Execution
// requires --confirm plus an explicit private key.

import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { POLKADOT_TESTNET_CHAIN, readDeployments } from '../scripts/smartRuntime';

/// Community-operated ContractRegistry for the Product `devnet` preset, i.e. Paseo
/// testnet Asset Hub (para 1000, EVM chain 420420417). Sourced from
/// paritytech/contract-dependency-manager `src/lib/env/src/registry.ts`.
///
/// Deliberately not the `paseo` preset registry: CDM's own docs note that `paseo`
/// targets paseo-next (para 1500), a different network that holds no Dotify contracts.
const DEVNET_REGISTRY_ADDRESS = '0x59b0245778917af55224e5f8fb55f7f8d452619f' as const;

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'publishLatest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'contract_name', type: 'string' },
      { name: 'contract_address', type: 'address' },
      { name: 'metadata_uri', type: 'string' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'getAddress',
    stateMutability: 'view',
    inputs: [{ name: 'contract_name', type: 'string' }],
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
  },
  {
    type: 'function',
    name: 'getOwner',
    stateMutability: 'view',
    inputs: [{ name: 'contract_name', type: 'string' }],
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

/// Only fixed-address contracts can be registered. Artist runtimes are per-artist
/// diamonds with no single address, so `@dotify/smart-runtime` is intentionally absent:
/// registering one artist's runtime under a shared name would misrepresent the catalog.
const PACKAGES = [
  { name: '@dotify/artist-directory', deploymentKey: 'directory' as const },
  { name: '@dotify/artist-runtime-factory', deploymentKey: 'factory' as const }
];

type PackagePlan = {
  name: string;
  address: Address;
  hasCode: boolean;
  registeredAddress: Address | null;
  owner: Address | null;
  action: 'register' | 'already-current' | 'blocked-owned-by-other' | 'update-version' | 'blocked-no-code';
  detail: string;
};

/// The registry returns Rust `Option<Address>` as a `(bool, address)` tuple. viem may
/// surface it as either an array or a named object depending on ABI shape, so accept
/// both rather than depending on that detail.
function optional(result: unknown): Address | null {
  if (Array.isArray(result)) {
    return result[0] ? getAddress(result[1] as string) : null;
  }
  if (result && typeof result === 'object' && 'isSome' in result) {
    const { isSome, value } = result as { isSome: boolean; value: string };
    return isSome ? getAddress(value) : null;
  }
  return null;
}

async function buildPlan(hre: HardhatRuntimeEnvironment, registry: Address, signer: Address | null): Promise<PackagePlan[]> {
  const rpcUrl = (hre.network.config as { url?: string }).url;
  const publicClient = createPublicClient({ chain: POLKADOT_TESTNET_CHAIN, transport: http(rpcUrl) });
  const deployments = readDeployments();

  const plans: PackagePlan[] = [];

  for (const pkg of PACKAGES) {
    const configured = deployments[pkg.deploymentKey];
    if (!configured) {
      throw new Error(`deployments.json has no "${pkg.deploymentKey}" address. Deploy before registering.`);
    }
    const address = getAddress(configured);

    const code = await publicClient.getCode({ address });
    const hasCode = Boolean(code && code !== '0x');

    const [registeredRaw, ownerRaw] = await Promise.all([
      publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'getAddress', args: [pkg.name] }),
      publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'getOwner', args: [pkg.name] }).catch(() => null)
    ]);

    const registeredAddress = optional(registeredRaw);
    const owner = ownerRaw ? optional(ownerRaw) : null;

    let action: PackagePlan['action'];
    let detail: string;

    if (!hasCode) {
      action = 'blocked-no-code';
      detail = `${address} has no bytecode on this chain. Registering it would publish a dead pointer.`;
    } else if (registeredAddress === null) {
      action = 'register';
      detail = `name is free; first publisher becomes its permanent owner`;
    } else if (owner && signer && owner.toLowerCase() !== signer.toLowerCase()) {
      action = 'blocked-owned-by-other';
      detail = `already owned by ${owner}; the registry rejects a publish from any other account`;
    } else if (registeredAddress.toLowerCase() === address.toLowerCase()) {
      action = 'already-current';
      detail = `already points at ${address}; nothing to do`;
    } else {
      action = 'update-version';
      detail = `currently ${registeredAddress}; publishing appends a new version pointing at ${address}`;
    }

    plans.push({ name: pkg.name, address, hasCode, registeredAddress, owner, action, detail });
  }

  return plans;
}

task('cdm:publish', 'Register Dotify contracts in the Product CDM registry. Read-only unless --confirm is passed.')
  .addOptionalParam('registry', 'ContractRegistry address', DEVNET_REGISTRY_ADDRESS, types.string)
  .addOptionalParam('metadataUri', 'Metadata pointer stored alongside the address (Bulletin CID or URL)', '', types.string)
  .addOptionalParam('privateKey', 'Publisher key. Required only with --confirm.', '', types.string)
  .addFlag('confirm', 'Actually submit the registration transactions')
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const registry = getAddress(args.registry as string);
    const rpcUrl = (hre.network.config as { url?: string }).url;
    const publicClient = createPublicClient({ chain: POLKADOT_TESTNET_CHAIN, transport: http(rpcUrl) });

    const registryCode = await publicClient.getCode({ address: registry });
    if (!registryCode || registryCode === '0x') {
      throw new Error(`No ContractRegistry at ${registry} on this network. Check --registry and the RPC endpoint.`);
    }

    const account = args.privateKey ? privateKeyToAccount(args.privateKey as Hex) : null;
    const plans = await buildPlan(hre, registry, account?.address ?? null);

    console.log(`\nCDM registry: ${registry}`);
    console.log(`Chain:        ${await publicClient.getChainId()}`);
    console.log(`Publisher:    ${account?.address ?? '(not supplied — read-only plan)'}\n`);

    for (const plan of plans) {
      console.log(`${plan.name}`);
      console.log(`  address: ${plan.address}`);
      console.log(`  action:  ${plan.action}`);
      console.log(`  detail:  ${plan.detail}`);
      if (!args.confirm) {
        console.log(
          `  calldata: ${encodeFunctionData({
            abi: REGISTRY_ABI,
            functionName: 'publishLatest',
            args: [plan.name, plan.address, args.metadataUri as string]
          })}`
        );
      }
      console.log('');
    }

    const blocked = plans.filter(plan => plan.action.startsWith('blocked'));
    if (blocked.length > 0) {
      throw new Error(`Refusing to proceed: ${blocked.map(plan => `${plan.name} (${plan.action})`).join(', ')}`);
    }

    const actionable = plans.filter(plan => plan.action === 'register' || plan.action === 'update-version');

    if (!args.confirm) {
      console.log(
        actionable.length === 0
          ? 'Nothing to publish — every name already resolves to the configured address.'
          : `Dry run. ${actionable.length} name(s) would be published. Re-run with --confirm --private-key <key> to submit.\n` +
              'Registration is first-writer-owns and the registry has no release or transfer entry point, so a claimed name is permanent.'
      );
      return;
    }

    if (!account) {
      throw new Error('--confirm requires --private-key.');
    }
    if (actionable.length === 0) {
      console.log('Nothing to publish.');
      return;
    }

    const walletClient = createWalletClient({ account, chain: POLKADOT_TESTNET_CHAIN, transport: http(rpcUrl) });

    for (const plan of actionable) {
      const hash = await walletClient.writeContract({
        address: registry,
        abi: REGISTRY_ABI,
        functionName: 'publishLatest',
        args: [plan.name, plan.address, args.metadataUri as string]
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`${plan.name} -> ${plan.address}  tx ${hash}  ${receipt.status}`);
    }

    console.log('\nPublished. Verify with: cdm i -n devnet ' + actionable.map(plan => plan.name).join(' '));
  });
