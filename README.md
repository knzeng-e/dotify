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
- **Rooms**: open listening rooms plus manual room-code entry. Room guests should
  be able to join and listen without wallet friction.
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

| Service       | URL                                            |
| ------------- | ---------------------------------------------- |
| Frontend      | <http://localhost:5273>                        |
| Artist portal | <http://localhost:5273/artists>                |
| Signaling     | <http://localhost:8788>                        |
| Backend API   | <http://localhost:8790>                        |
| Bulletin RPC  | `wss://paseo-bulletin-rpc.polkadot.io`         |
| Asset Hub RPC | <https://eth-rpc-testnet.polkadot.io/>        |

The app talks to Paseo Bulletin and Asset Hub directly from the browser. A local
Ethereum node or local Substrate node is not required to run the demo.
If the public Asset Hub RPC is unavailable, set `VITE_ETH_RPC_URL` in
`web/.env.local` to a compatible Paseo Asset Hub EVM RPC endpoint.

### Running the backend API

The backend service handles server-side IPFS pinning, audio encryption,
wallet-signed content-key delivery, and health checks.

```bash
cd services/api
npm install
cp .env.example .env
# Edit .env: set PINATA_JWT and CONTENT_KEY_MASTER_SECRET
npm run dev
```

**Environment variables** (see `services/api/.env.example`):

| Variable                    | Required         | Purpose                                                  |
| --------------------------- | ---------------- | -------------------------------------------------------- |
| `API_ORIGIN`                | Production       | Frontend origin allowed by API CORS                      |
| `PASEO_ASSET_HUB_RPC`       | Key requests     | Paseo Asset Hub EVM RPC used for access checks           |
| `DOTIFY_DIRECTORY_ADDRESS`  | Key requests     | ArtistDirectory address used to resolve artist runtimes  |
| `DOTIFY_CHAIN_ID`           | Key requests     | Chain ID expected in wallet-signed key requests          |
| `PINATA_JWT`                | For uploads      | Server-side Pinata token (never expose in frontend)      |
| `CONTENT_KEY_MASTER_SECRET` | For audio upload | 32-byte hex master secret for AES-256-GCM key derivation |

Set `VITE_DOTIFY_API_URL=http://localhost:8790` in `web/.env.local` to route
audio, cover, and metadata uploads through the backend. In this mode the
backend encrypts audio server-side and listeners obtain per-track keys through
wallet-signed key requests; the production content key never ships in the
frontend bundle.

**Demo/local mode** (no backend): set `VITE_PINATA_JWT` in `web/.env.local` with
a restricted upload-only Pinata token. Do not use an unrestricted token in demos.

### Running the signaling server (hosted rooms)

The signaling server coordinates room discovery and WebRTC SDP/ICE exchange.
It never carries audio: media flows host to listeners over WebRTC only.

```bash
cd web
npm run signal          # local dev (started automatically by npm run dev:listen)
npm run test:signal     # integration tests: create/join/cap/expiry/heartbeat
npm run test:e2e        # Playwright: deterministic Classic unlock and artist publish flows
```

`npm run test:e2e` starts Vite in deterministic e2e mode. It seeds one Classic
track, connects deterministic test wallets, verifies preview-only playback
before Classic payment, and covers artist runtime creation plus release
publication with mocked upload and transaction failure states.

For a public deployment, run `node server/signaling.mjs` on any Node 22 host
and point the frontend at it with `VITE_SIGNAL_URL`.

The repository includes `web/fly.signal.toml` and `web/Dockerfile.signal` for a
Fly.io signaling deployment. Keep `min_machines_running = 1` for this service:
rooms can be active while no HTTP traffic is flowing, and stopping the machine
would drop active WebSocket rooms without a clean `room:closed` broadcast.

**Environment variables**:

| Variable                 | Default   | Purpose                                                        |
| ------------------------ | --------- | -------------------------------------------------------------- |
| `SIGNAL_PORT`            | `8788`    | Listen port                                                    |
| `SIGNAL_HOST`            | `0.0.0.0` | Bind address                                                   |
| `SIGNAL_ORIGINS`         | `*`       | Comma-separated allowed origins (set explicitly in production) |
| `SIGNAL_ROOM_TTL_MS`     | 6 h       | Hard room lifetime before expiry                               |
| `SIGNAL_HOST_TIMEOUT_MS` | 120 s     | Close rooms whose host stops heartbeating                      |
| `SIGNAL_MAX_LISTENERS`   | 24        | Per-room listener cap                                          |

`GET /health` reports uptime plus room and listener counts; `GET /status`
exposes public room metadata (current track, playback mode, host-based access
flags, expiry).

**Host-based room access.** Rooms never become a wallet checkpoint:

- A host creates a room and shares a join link (`#/rooms/<roomId>`) or code.
- Guests join with the link alone: no wallet, no signature, no payment.
- Only the host must satisfy a protected track's access policy. An authorized
  host streams the full track; an unauthorized host streams the 42% preview,
  sees a discreet unlock CTA, and the playlist auto-advances.
- Guests receive only the ephemeral WebRTC stream, never content keys or
  encrypted source files. They can of course hear and record what is streamed;
  Dotify does not claim otherwise.

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

### Individual playback access

For individual full-track playback, Dotify checks access before loading the
registered track. In production mode, the frontend requests a backend-held
content key with a wallet signature; the backend verifies the signature, rejects
nonce replay, resolves the artist runtime, and calls `musicAccCanAccess` before
releasing a per-track key. If access is denied, the UI falls back to preview
mode and shows the action needed to unlock the whole track.

For registered artist tracks, users without a connected wallet are treated as
unauthorized individual listeners and receive preview-only playback. Dev-account
fallback must not grant full listener playback.

Current preview caveat: server-keyed production tracks still need a separate
preview asset. Demo/local tracks can slice a 42% preview from browser-decrypted
bytes, but production tracks encrypted with the backend-held key cannot be
previewed by an unauthorized browser unless a preview reference is published.
See `docs/backlog/18-production-preview-assets.md`.

### Room playback access

Room playback uses **host-based access**.

- If the host has access to a protected track, Dotify may deliver a temporary
  content key to the host only, and the host streams the full track through
  WebRTC.
- Room listeners do not need to connect a wallet, sign, pay, or prove access
  merely to listen inside a room.
- Room listeners never receive the encrypted source file or content key; they
  receive only the ephemeral WebRTC media stream.
- If the host lacks access to a protected track, Dotify should keep the room
  alive, stream the 42% preview, show a discreet host-facing unlock/personhood
  CTA, and auto-advance to the next playlist track when the preview ends.

This protects source-file distribution without turning the room into a wallet
checkpoint.

The same production preview caveat applies to rooms: unauthorized host preview
fallback needs a publish-time preview asset for server-keyed tracks.

### Security boundary

Current client-side protection is demo-grade. Production protection requires
server-side upload/key delivery and wallet-signed content-key requests.

Dotify protects distribution access to encrypted source files and keys. It does
not claim absolute DRM and does not prevent recording of an authorized WebRTC
stream.

See also:

- `docs/product/ux-signature-flows.md`
- `docs/product/room-access-policy.md`
- `docs/security/content-key-delivery-threat-model.md`

## What works

- WebRTC host-to-listener audio stream (tested with two local browser tabs and
  across LAN).
- Socket.IO signaling with open-room discovery and manual room codes.
- Artist portal: wallet-gated artist onboarding, audio upload, cover image
  upload, Pinata IPFS pinning, canonical IPFS metadata, blake2b hash, optional
  Bulletin Chain archival upload, artist runtime creation, and on-chain release
  registration.
- Backend upload/key service for server-side audio encryption and wallet-signed
  content-key requests, with demo/local browser encryption still available.
- 42% preview playback for demo/local protected tracks; production preview
  assets are still pending for server-keyed tracks.
- Seed catalog with five tracks browsable on the Home view.
- SmartRuntime music pallets: registration, NFT ownership, access checks, paid
  access, listen recording, royalty split storage, and transfer gating by
  personhood level.

## What doesn't work / known limitations

- **Draft audio is session-only**: blob URLs are revoked on unmount before the
  release is registered. Registered releases rely on Pinata IPFS refs.
- **Client-side protection is best-effort**: encrypted audio and preview gating
  improve the demo, but `VITE_CONTENT_SECRET` is still only a local/demo
  boundary. Production uploads and full-track playback should use
  `VITE_DOTIFY_API_URL` with the backend-held `CONTENT_KEY_MASTER_SECRET`.
- **Wallet scope**: Dotify treats the connected EVM account as the primary
  artist and listener identity. Artist registration and release publication
  require a connected wallet; dev EVM accounts are not used as public fallback
  signers. Bulletin archival still needs a Substrate signer when enabled.
- **Proof of Personhood is mocked**: `setPersonhoodLevel` is a dev-only admin
  call. Live Individuality chain reads are on the roadmap.
- **Browser-side Pinata JWT is demo/local only**: `VITE_PINATA_JWT` is used for
  direct browser uploads only when `VITE_DOTIFY_API_URL` is unset. Production
  uploads use the backend API; see `services/api/.env.example` for server-side
  `PINATA_JWT` and `CONTENT_KEY_MASTER_SECRET`.
- **Production preview asset gap**: production tracks encrypted with the
  backend-held key need a separate preview asset before unauthorized listeners
  and unauthorized room hosts can reliably hear the promised 42% preview.
  Tracked in `docs/backlog/18-production-preview-assets.md`.
- **Single-host rooms**: no multi-host or handoff logic. If the host closes the
  tab, the room ends.
- **Room stream capture limits**: room guests do not receive keys/source files,
  but WebRTC audio heard by guests can still be recorded outside Dotify.

## Architecture

```text
Browser (React + Vite)
  ├── WebRTC audio stream (captureStream → RTCPeerConnection per listener)
  ├── Socket.IO       →  Node signaling server  (SDP/ICE only)
  ├── Dotify API      →  backend service  (health, uploads, nonce, key delivery)
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

| Path               | Role                                                   |
| ------------------ | ------------------------------------------------------ |
| `web/`             | React app, signaling server, Bulletin deploy scripts   |
| `web/.papi/`       | PAPI descriptors for Bulletin Chain                    |
| `services/api/`    | Backend API: health, uploads, auth nonce, key delivery |
| `contracts/evm/`   | Hardhat + Solidity smart-runtime contracts             |
| `docs/product/`    | Product policy and UX flow documentation               |
| `docs/security/`   | Security boundaries and threat models                  |
| `deployments.json` | EVM factory, directory, initializer, pallet addresses  |

## Improvement Backlog

1. Harden wallet support: injected EVM providers, passkey recovery warnings,
   network mismatch handling, and clear transaction preflight states.
2. Harden and operate the backend upload/key service for public traffic:
   production CORS, secret rotation, monitoring, and rate limits.
3. Publish separate preview assets for server-keyed protected tracks so
   unauthorized previews do not depend on demo-mode decryption.
4. Keep demo-mode browser-exposed Pinata/content secrets out of public
   deployments.
5. Integrate live Proof of Personhood / Individuality data instead of manual
   registrar writes.
6. Add a production artist dashboard on `/artists`: release drafts, edit
   metadata, royalty analytics, and profile verification state.
7. Deploy and monitor a public signaling server for DotNS / Bulletin builds.
8. Add remaining frontend tests for listening rooms; Classic
   preview/payment/unlock and artist publish now have deterministic e2e
   coverage.
9. Split the large React app into catalog, player, artist portal, rooms, and
   chain modules.
10. Generate frontend ABI bindings from Hardhat artifacts.
11. Add deployment smoke tests for DotNS/Bulletin CIDs, IPFS gateway fallback,
   and contract address availability.
12. Improve room resilience with host handoff, reconnect recovery, and explicit
    room expiry.
