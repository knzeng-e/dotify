# Dotify Contracts

The first Dotify contract is `MusicRightsRegistry`.

It records one active track per audio hash and mints a minimal NFT for each
registered track:

- artist wallet and display name;
- title, description, cover image IPFS reference, audio IPFS reference,
  Bulletin JSON manifest reference, and artist contract PDF IPFS reference;
- royalty recipients and basis-point splits;
- Human free or Classic access mode;
- DIM1/DIM2 Proof of Personhood requirement for Human free tracks;
- Classic track price and paid-access status;
- owner and transfer state for each track NFT.

Human free NFT transfers require the recipient to hold the required personhood
level. Classic access uses native-token payment and distributes the payment to
registered royalty recipients, with any remainder sent to the artist.

Available target:

- `evm/`: Hardhat + solc

```bash
cd contracts/evm
npm install
npm run deploy:local
```

For Polkadot Hub TestNet:

```bash
cd contracts/evm
npm run deploy:testnet
```

The smart-runtime deployment flow:

- deploys the shared pallets, initializer, directory, and factory;
- writes `deployments.json` and `web/src/config/deployments.ts`;
- verifies the deployed contracts on Blockscout automatically on `polkadotTestnet`.

To rerun verification without redeploying:

```bash
cd contracts/evm
npm run verify:testnet
```
