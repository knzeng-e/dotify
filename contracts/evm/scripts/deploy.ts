import hre from 'hardhat';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineChain } from 'viem';

const DEPLOYMENTS_JSON = path.resolve(__dirname, '../../../deployments.json');
const DEPLOYMENTS_TS = path.resolve(__dirname, '../../../web/src/config/deployments.ts');
const POLKADOT_TESTNET_CHAIN_ID = 420420417;
const POLKADOT_TESTNET_CHAIN = defineChain({
  id: POLKADOT_TESTNET_CHAIN_ID,
  name: 'Polkadot Hub TestNet',
  nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://eth-rpc-testnet.polkadot.io/'] }
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://blockscout-testnet.polkadot.io/'
    }
  }
});

function updateDeployments(address: string) {
  let data: { evm: string | null } = { evm: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(DEPLOYMENTS_JSON, 'utf-8')) as Record<string, unknown>;
    data = { evm: typeof parsed.evm === 'string' ? parsed.evm : null };
  } catch {
    // Fresh project.
  }
  data.evm = address;

  fs.writeFileSync(DEPLOYMENTS_JSON, JSON.stringify(data, null, 2) + '\n');

  const fmt = (value: string | null) => (value === null ? 'null' : `"${value}"`);
  const ts = `const embeddedEvmDeployment = ${fmt(data.evm)} as \`0x\${string}\` | null;
const envEvmDeployment = import.meta.env.VITE_DOTIFY_EVM_CONTRACT as \`0x\${string}\` | undefined;

export const deployments: { evm: \`0x\${string}\` | null } = {
\tevm: envEvmDeployment ?? embeddedEvmDeployment,
};
`;
  fs.writeFileSync(DEPLOYMENTS_TS, ts);
}

async function main() {
  console.log('Deploying Dotify MusicRightsRegistry (EVM)...');
  const deployConfig = await getDeployConfig();

  const contract = await hre.viem.deployContract('MusicRightsRegistry', [], deployConfig);
  console.log(`EVM MusicRightsRegistry deployed to: ${contract.address}`);
  updateDeployments(contract.address);
}

async function getDeployConfig() {
  if (hre.network.name !== 'polkadotTestnet') {
    return {};
  }

  const publicClient = await hre.viem.getPublicClient({ chain: POLKADOT_TESTNET_CHAIN });
  const [wallet] = await hre.viem.getWalletClients({ chain: POLKADOT_TESTNET_CHAIN });

  if (!wallet) {
    throw new Error('No deployer account configured. Set one with: npx hardhat vars set PRIVATE_KEY');
  }

  return {
    client: {
      public: publicClient,
      wallet
    }
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
