# Dotify Contracts

Dotify currently uses a smart-runtime contract system rather than a single
registry contract.

`ArtistRuntimeFactory` deploys one personal `SmartRuntime` per artist.
`ArtistDirectory` records the artist address to runtime mapping. The runtime is
assembled from pallets that record one active track per audio hash and mint a
minimal NFT for each registered track:

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
- writes `deployments.json` and `web/src/shared/config/deployments.ts`;
- verifies the deployed contracts on Blockscout automatically on `polkadotTestnet`.

The Polkadot Hub EVM deployment target uses Solidity optimizer + `viaIR`.
Keep those settings enabled for testnet deployments: `ArtistRuntimeFactory`
embeds the `SmartRuntime` creation path, and an unoptimized factory can exceed
the chain's runtime/weight limits when artists call `createRuntime()`.

To rerun verification without redeploying:

```bash
cd contracts/evm
npm run verify:testnet
```

To run the contract suite:

```bash
cd contracts/evm
npm test
```

## Current Notes

- `ArtistRuntime.test.ts` covers the active smart-runtime / pallet system:
  runtime creation, registration, paid access, royalty distribution,
  personhood-gated access, NFT transfer gating, and runtime isolation.
- `MusicRightsRegistry.sol` and `MusicRightsRegistry.test.ts` are legacy
  monolithic registry code kept in the repository for comparison. The web app
  uses the smart-runtime pallet ABI from `web/src/config/contracts.ts`.
- The frontend performs access checks before playback. Access model v2 retired
  the 42% preview: denied protected playback is a gate with no protected audio.
  Contracts remain the source of truth for `musicAccCanAccess` and
  `musicRoyPayAccess`.

## Improvements

- Archive or remove the legacy monolithic registry once the smart-runtime path
  is fully accepted.
- Generate frontend ABI definitions from Hardhat artifacts instead of
  maintaining inline ABI objects manually.
- Add deployment smoke tests that read the live factory, directory, and pallet
  addresses after `deploy:testnet`.
- Add an operator flow for a shared personhood registrar or Individuality
  integration.
