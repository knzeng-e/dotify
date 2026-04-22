# Dotify

**Let the Music connect the dots.**

Dotify is a decentralized, Spotify-inspired shared-listening app. A host opens a
listening room, streams audio from their device through WebRTC, and invited
listeners join the same real-time feed. The product separates listener discovery
from artist administration so users browse and listen while artists manage their
catalog, rights, and monetization.

The product direction is informed by the presentation deck: short, voluntary,
social listening moments with artist ownership, discovery, and on-chain
settlement built into the platform.

## Product Areas

- **Home**: artist-grouped music discovery, track artwork, descriptions, access
  mode badges, a player, and room-hosting controls.
- **Rooms**: open listening rooms plus manual room-code entry.
- **Artist Studio**: audio upload, cover image upload, artist contract PDF
  upload, description, rights metadata, Bulletin Chain manifest publication,
  access mode selection, and contract registration.

## Track Model

Each uploaded track is treated as an NFT-backed music asset with:

- audio content hash and IPFS audio reference;
- cover image IPFS reference;
- artist contract PDF IPFS reference;
- compact Bulletin Chain JSON manifest reference;
- description and metadata fields;
- artist wallet and artist display name;
- copyright and royalty recipients expressed in basis points;
- access mode, price, and Proof of Personhood requirement;
- NFT owner and transfer constraints.

## Access Modes

- **Human free**: free listening for users with Polkadot Proof of Personhood.
  Artists can require DIM1 or DIM2. The NFT transfer path is also gated so these
  tracks can only move to addresses with the required personhood level.
- **Classic**: paid access through DOT payment or future subscription logic. The
  current contract records the price, marks paid listeners as eligible, and
  automatically distributes payments to configured royalty recipients.

Proof of Personhood is represented locally by a registrar-controlled mapping in
the first contract version. That keeps the app ready for a future live
integration with Polkadot's People/Proof of Personhood primitives without
blocking the current prototype.

## Architecture

- Static React + Vite frontend, ready for IPFS/DotNS publication.
- Socket.IO only handles WebRTC signaling and open-room discovery.
- WebRTC carries the audio stream between host and listeners.
- IPFS stores large assets: audio files, cover images, and artist contract PDFs.
- Bulletin Chain stores only the compact JSON rights manifest because Bulletin
  payloads are limited to 8 MiB.
- Solidity contracts deploy to the EVM target.
- `dotify.dot.li` is the intended public domain target.

See `docs/polkadot-stack-alignment.md` for the current mapping between Dotify
and the local `polkadot-apps/skills` guidance.

## Structure

| Path             | Role                                                     |
| ---------------- | -------------------------------------------------------- |
| `web/`           | React app, signaling server, and Bulletin integration    |
| `web/.papi/`     | PAPI descriptors for Bulletin Chain                      |
| `contracts/evm/` | Hardhat + solc target for `MusicRightsRegistry`          |

## Local Development

```bash
cd web
npm install
npm run dev:listen
```

Default endpoints:

- Frontend: `http://localhost:5273`
- Signaling: `http://localhost:8788`
- Local Substrate RPC: `ws://localhost:9944`
- Local Ethereum RPC: `http://localhost:8545`
- Bulletin Paseo RPC: `wss://paseo-bulletin-rpc.polkadot.io`

The frontend can run without a deployed contract. Artist registrations stay local
in that mode. To enable EVM on-chain writes, set `VITE_DOTIFY_EVM_CONTRACT` or
update `web/src/config/deployments.ts`. To use a real pinning service instead of
staged local references, set `VITE_IPFS_UPLOAD_URL` and optionally
`VITE_IPFS_GATEWAY_URL`.

## Rights Contract

`MusicRightsRegistry` handles the first Dotify rights layer:

- one active track record per content hash;
- a minted track NFT with `ownerOf`, `balanceOf`, and transfer events;
- cover, audio, artist contract PDF, and Bulletin manifest references;
- Human free or Classic access mode;
- DIM1/DIM2 Proof of Personhood gating for Human free access and transfer;
- DOT payment access for Classic tracks;
- royalty split storage and automatic native-token redistribution.

Future phases can add subscription pools, secondary-market fees, richer NFT
metadata, and artist reward campaigns.
