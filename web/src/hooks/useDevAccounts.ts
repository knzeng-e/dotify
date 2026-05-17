import { seedToAccount } from '@polkadot-apps/keys';
import type { PolkadotSigner } from 'polkadot-api';

const DEV_PHRASE = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';

export type DevAccount = {
  name: string;
  address: string;
  signer: PolkadotSigner;
};

function createDevAccount(name: string, path: string): DevAccount {
  const { ss58Address, signer } = seedToAccount(DEV_PHRASE, path, 42, 'sr25519');
  return { name, address: ss58Address, signer };
}

export const devAccounts: DevAccount[] = [
  createDevAccount('Alice', '//Alice'),
  createDevAccount('Bob', '//Bob'),
  createDevAccount('Charlie', '//Charlie')
];
