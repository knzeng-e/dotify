import hre from 'hardhat';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DEPLOYMENTS_JSON = path.resolve(__dirname, '../../../deployments.json');
const DEPLOYMENTS_TS = path.resolve(__dirname, '../../../web/src/config/deployments.ts');

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
  const ts = `export const deployments: { evm: \`0x\${string}\` | null } = {
\tevm:
\t\t${fmt(data.evm)} as \`0x\${string}\` | null ??
\t\t(import.meta.env.VITE_DOTIFY_EVM_CONTRACT as \`0x\${string}\` | undefined) ??
\t\tnull,
};
`;
  fs.writeFileSync(DEPLOYMENTS_TS, ts);
}

async function main() {
  console.log('Deploying Dotify MusicRightsRegistry (EVM)...');
  const contract = await hre.viem.deployContract('MusicRightsRegistry');
  console.log(`EVM MusicRightsRegistry deployed to: ${contract.address}`);
  updateDeployments(contract.address);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
