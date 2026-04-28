# Dotify

**Let the Music connect the dots.**

Dotify is a decentralized, cultural social hub, aimed to incentivise direct human connection through real time music listening. Each user can eitheir use it as a normal spotify app, or decide to host an epehemeral sound session, and invite other listeners join the same real-time feed.
By uploading their tracks on `Dotify`, artists provide their explicit consent to make use of their art as an instrument of "humanificiation", while retaining full control of their productions. Dotify offers them a dedicated dashboard to manage their catalog, rights and monetization, without any intermediary and in real time.

![](./assets/images/Dotify_Home.png)

## What it does

- **Home**: artist-grouped music discovery, track artwork, descriptions, access
  mode badges, a player, and room-hosting controls.
- **Rooms**: open listening rooms plus manual room-code entry.
- **Artist Studio**: audio upload, cover image upload, description, rights
  metadata, music accessibility mode selection, and management of a smart `Music rights registry`.

## Path chosen

**Backend**: EVM smart-runtime system on Paseo Asset Hub. `ArtistRuntimeFactory`
creates one personal `SmartRuntime` per artist, and `ArtistDirectory` indexes
artist addresses to their runtimes.

**Frontend**: Static React + Vite web app deployed to dot.li.

**WebRTC**: Realtime music streaming

**Socket.io**: Signaling // TODO -> Use the statement store

## Deployed

**EVM factory** — `0x34f8eb390ba7c4ce3f7d8fab1cb82b099449b7f5` (Paseo Asset Hub, chainId 420420417)

**EVM directory** — `0xa93f43ef98924a3b42098c207332dceadb0632a7`

**Bulletin CID** — `bafkr4ibynaanfrddyjgpmut2qrcu6vdttocbp4feyw6vkgxkkhqndjksny`

**Gateway URL** — <https://paseo-ipfs.polkadot.io/ipfs/bafkr4ibynaanfrddyjgpmut2qrcu6vdttocbp4feyw6vkgxkkhqndjksny>

**DotNS name** — `dotify.dot.li`

## How to run end-to-end (locally)

**Prerequisites**: Node 22, npm 10+.

```bash
cd web
npm install
npm run dev:listen
```

Open the app in a browser at `http://localhost:5273`.

Default ports:

| Service       | URL                                              |
| ------------- | ------------------------------------------------ |
| Frontend      | <http://localhost:5273>                          |
| Signaling     | <http://localhost:8788>                          |
| Bulletin RPC  | `wss://paseo-bulletin-rpc.polkadot.io`           |
| Asset Hub RPC | <https://services.polkadothub-rpc.com/testnet>   |

The app talks to Paseo Bulletin and Asset Hub directly from the browser. A local
Ethereum node or local Substrate node is not required to run the demo.

**To rebuild and redeploy the frontend to Bulletin Chain:**

```bash
cd web
npm run build:bulletin   # produces dist-bulletin/index.html (~1 MB single file)
npm run deploy:bulletin  # uploads to Bulletin via Alice dev account
```

Alice must hold upload authorization on Paseo Bulletin. Update `deployments.json`
with the new CID printed by the deploy script, then register the CID with DotNS.

## Track model

Each uploaded track gets:

- a blake2b-256 content hash of the audio file;
- local blob URLs for draft playback before registration;
- Pinata IPFS refs for audio, cover, and metadata JSON;
- an optional JSON rights manifest published to Bulletin Chain;
- an EVM NFT minted by the artist `SmartRuntime` with the content hash, metadata
  reference, royalty splits, and access mode.

Draft track data is in-session only until registration. Registered tracks store
IPFS refs on-chain and can be loaded through the configured gateway.

## Access modes

- **Human free**: free listening for addresses with Polkadot Proof of Personhood
  (DIM1 or DIM2). The contract gates NFT transfer to the same level.
- **Classic**: paid access in DOT. The runtime records the price and distributes
  payments to configured royalty recipients on `musicRoyPayAccess`.

Proof of Personhood is a registrar-controlled mapping in the contract — ready
for a live Individuality chain integration without blocking the prototype.

## What works

- WebRTC host-to-listener audio stream (tested with two local browser tabs and
  across LAN).
- Socket.IO signaling with open-room discovery and manual room codes.
- Artist Studio: audio upload, cover image upload, Pinata IPFS pinning,
  blake2b hash, optional Bulletin Chain manifest upload, artist runtime
  creation, and on-chain release registration.
- Seed catalog with five tracks browsable on the Home view.
- SmartRuntime music pallets: registration, NFT ownership, access checks, paid
  access, listen recording, royalty split storage, and transfer gating by
  personhood level.

## What doesn't work / known limitations

- **Draft audio is session-only**: blob URLs are revoked on unmount before the
  release is registered. Registered releases rely on Pinata IPFS refs.

- **No real wallet**: signing uses hardcoded dev accounts (Alice for Bulletin,
  Alice EVM account for contract calls). A real signer integration using Pwallet is on the migration list.
- **Proof of Personhood is mocked**: `setPersonhoodLevel` is a dev-only admin
  call. Live Individuality chain reads are on the roadmap.
- **Pinata runs from the browser**: `VITE_PINATA_JWT` is exposed by Vite, so use
  a restricted token for demos only. A backend pinning proxy is still needed for
  production.

- **Single-host rooms**: no multi-host or handoff logic. If the host closes the
  tab, the room ends.

## Architecture

```text
Browser (React + Vite)
  ├── WebRTC audio stream (captureStream → RTCPeerConnection per listener)
  ├── Socket.IO  →  Node signaling server  (SDP/ICE only)
  ├── Pinata HTTP API  →  IPFS audio, cover, and metadata pinning
  ├── polkadot-api (PAPI)  →  Paseo Bulletin Chain  (optional manifest upload)
  └── viem  →  Paseo Asset Hub EVM  (ArtistDirectory, ArtistRuntimeFactory, SmartRuntime)
```

The frontend is built as a single self-contained HTML file using
`vite-plugin-singlefile` so it works when served from a flat IPFS CID.

## Rights contracts

`contracts/evm/contracts/ArtistRuntimeFactory.sol` deploys one
`SmartRuntime` per artist. The runtime is assembled from music pallets that
handle:

- one active track record per content hash (prevents duplicate registration);
- NFT mint with `ownerOf`, `balanceOf`, and transfer events;
- cover, audio, metadata, and Bulletin manifest references stored on-chain;
- Human free or Classic access mode with PoP gating;
- DOT payment and royalty distribution on `musicRoyPayAccess`.

## Structure

| Path             | Role                                                     |
| ---------------- | -------------------------------------------------------- |
| `web/`           | React app, signaling server, Bulletin deploy scripts     |
| `web/.papi/`     | PAPI descriptors for Bulletin Chain                      |
| `contracts/evm/` | Hardhat + Solidity smart-runtime contracts               |
| `deployments.json` | EVM factory, directory, initializer, and pallet addresses |
