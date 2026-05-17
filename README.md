# Dotify

**Let the Music connect the dots.**

Dotify is a decentralized cultural social hub that incentivizes direct human
connection through real-time music listening. Each user can browse it like a
music app or host an ephemeral listening session and invite other listeners into
the same real-time feed.

By uploading tracks to Dotify, artists opt into using their work as an
instrument of human connection while retaining control over catalog, rights, and
monetization through their own artist runtime.

![](./assets/images/Dotify_Home.png)

## What it does

- **Home**: artist-grouped music discovery, track artwork, descriptions, access
  mode badges, a policy-aware player, and room-hosting controls.
- **Rooms**: open listening rooms plus manual room-code entry.
- **Artist portal**: a dedicated `/artists` onboarding and studio surface where
  artists connect a wallet, create their runtime, upload releases, configure
  access, and manage royalty records outside the listener-first app shell.

## Path chosen

**Backend**: EVM smart-runtime system on Paseo Asset Hub. `ArtistRuntimeFactory`
creates one personal `SmartRuntime` per artist, and `ArtistDirectory` indexes
artist addresses to their runtimes.

**Frontend**: Static React + Vite web app deployed to dot.li.

**WebRTC**: real-time music streaming.

**Socket.IO**: signaling for room discovery and SDP/ICE exchange. A future
iteration can move signaling to statement-store style infrastructure.

## Deployed

**EVM factory** — `0x74ba85c2b29d2acb3777b9b3ca26c286945cae3c` (Paseo Asset Hub, chainId 420420417)

**EVM directory** — `0xdd92194909df3dc5c3d254b53f7283d025c35d8c`

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

Open the listener app in a browser at `http://localhost:5273`. The artist
onboarding and studio flow is available at `http://localhost:5273/artists`.

Default ports:

| Service       | URL                                              |
| ------------- | ------------------------------------------------ |
| Frontend      | <http://localhost:5273>                          |
| Artist portal | <http://localhost:5273/artists>                  |
| Signaling     | <http://localhost:8788>                          |
| Backend API   | <http://localhost:8790>                          |
| Bulletin RPC  | `wss://paseo-bulletin-rpc.polkadot.io`           |
| Asset Hub RPC | <https://services.polkadothub-rpc.com/testnet>   |

The app talks to Paseo Bulletin and Asset Hub directly from the browser. A local
Ethereum node or local Substrate node is not required to run the demo.

### Running the backend API

The backend service is the production boundary for future upload orchestration,
wallet-signed content-key delivery, and health checks. Ticket 01 exposes the
skeleton endpoints only; Pinata upload handling lands in Ticket 02.

```bash
cd services/api
npm install
cp .env.example .env
npm run dev
```

Set `VITE_DOTIFY_API_URL=http://localhost:8790` in `web/.env.local` when testing
frontend/backend integration. The current artist upload flow remains demo/local
until the server-side Pinata upload ticket lands.

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
- encrypted Pinata IPFS refs for audio plus IPFS refs for cover and metadata
  JSON;
- an optional advanced JSON rights manifest archived to Bulletin Chain;
- an EVM NFT minted by the artist `SmartRuntime` with the content hash, metadata
  reference, royalty splits, and access mode.

Draft track data is in-session only until registration. Registered tracks store
IPFS refs on-chain and can be loaded through the configured gateway. IPFS reads
use a primary gateway plus fallback gateways to avoid custom gateway
authorization failures.

## Access modes

- **Human free**: free listening for addresses with Polkadot Proof of Personhood
  (DIM1 or DIM2). The contract gates NFT transfer to the same level.
- **Classic**: paid access in DOT. The runtime records the price and distributes
  payments to configured royalty recipients on `musicRoyPayAccess`.

Proof of Personhood is a registrar-controlled mapping in the contract — ready
for a live Individuality chain integration without blocking the prototype.

The frontend checks `musicAccCanAccess` before loading a registered track. If the
listener does not meet the PoP or payment requirement, it creates a separate 42%
preview and shows a warning explaining the restriction and the action needed to
unlock the whole track. This is product-policy enforcement in the current
client; production-grade protection still needs server-side or artist-side key
delivery.

For registered artist tracks, users without a connected wallet are treated as
unauthorized listeners and receive preview-only playback. Dev-account fallback
must not grant full listener playback.

## What works

- WebRTC host-to-listener audio stream (tested with two local browser tabs and
  across LAN).
- Socket.IO signaling with open-room discovery and manual room codes.
- Artist portal: wallet-gated artist onboarding, audio upload, cover image
  upload, Pinata IPFS pinning, canonical IPFS metadata, blake2b hash, optional
  Bulletin Chain archival upload, artist runtime creation, and on-chain release
  registration.
- Best-effort encrypted audio storage with 42% preview playback for restricted
  listeners.
- Seed catalog with five tracks browsable on the Home view.
- SmartRuntime music pallets: registration, NFT ownership, access checks, paid
  access, listen recording, royalty split storage, and transfer gating by
  personhood level.

## What doesn't work / known limitations

- **Draft audio is session-only**: blob URLs are revoked on unmount before the
  release is registered. Registered releases rely on Pinata IPFS refs.
- **Client-side protection is best-effort**: encrypted audio and preview gating
  improve the demo, but the frontend still contains the code and configured
  content secret. Production needs wallet-gated key delivery.
- **Wallet scope**: Dotify treats the connected EVM account as the primary
  artist and listener identity. Artist registration and release publication
  require a connected wallet; dev EVM accounts are not used as public fallback
  signers. Bulletin archival still needs a Substrate signer when enabled.
- **Proof of Personhood is mocked**: `setPersonhoodLevel` is a dev-only admin
  call. Live Individuality chain reads are on the roadmap.
- **Pinata runs from the browser**: `VITE_PINATA_JWT` is exposed by Vite, so use
  a restricted token for demos only. The backend skeleton is in place; the
  server-side Pinata upload proxy is tracked by Ticket 02.

- **Single-host rooms**: no multi-host or handoff logic. If the host closes the
  tab, the room ends.

## Architecture

```text
Browser (React + Vite)
  ├── WebRTC audio stream (captureStream → RTCPeerConnection per listener)
  ├── Socket.IO       →  Node signaling server  (SDP/ICE only)
  ├── Dotify API      →  backend service  (health, auth nonce, future key delivery)
  ├── Pinata HTTP API →  encrypted audio, cover, and metadata pinning (demo/local)
  ├── IPFS gateways   →  primary + fallback reads for manifests and audio bytes
  ├── polkadot-api (PAPI)  →  Paseo Bulletin Chain  (optional manifest upload)
  └── viem            →  Paseo Asset Hub EVM  (ArtistDirectory, ArtistRuntimeFactory, SmartRuntime)
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

| Path               | Role                                                     |
| ------------------ | -------------------------------------------------------- |
| `web/`             | React app, signaling server, Bulletin deploy scripts     |
| `web/.papi/`       | PAPI descriptors for Bulletin Chain                      |
| `services/api/`    | Backend API: health, auth nonce, future key delivery     |
| `contracts/evm/`   | Hardhat + Solidity smart-runtime contracts               |
| `deployments.json` | EVM factory, directory, initializer, pallet addresses    |

## Improvement Backlog

1. Harden wallet support: injected EVM providers, passkey recovery warnings,
   network mismatch handling, and clear transaction preflight states.
2. Move Pinata uploads and audio key delivery behind a backend or artist-operated
   key service.
3. Replace bundled content secrets with per-track key custody and wallet-signed
   unlock requests.
4. Integrate live Proof of Personhood / Individuality data instead of manual
   registrar writes.
5. Add a production artist dashboard on `/artists`: release drafts, edit
   metadata, royalty analytics, and profile verification state.
6. Deploy and monitor a public signaling server for DotNS / Bulletin builds.
7. Add frontend tests for registration, payment, preview gating, unlock, and
   listening rooms.
8. Split the large React app into catalog, player, artist portal, rooms, and
   chain modules.
9. Add deployment smoke tests for DotNS/Bulletin CIDs, IPFS gateway fallback,
   and contract address availability.
10. Improve room resilience with host handoff, reconnect recovery, and explicit
   room expiry.
