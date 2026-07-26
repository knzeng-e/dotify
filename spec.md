# Dotify Project Specification

Last updated: 2026-07-14

## 1. Purpose

Dotify is a decentralized music and shared-listening application. It lets
artists publish rights-managed tracks through artist-owned smart runtimes, and
lets listeners browse tracks, unlock access through policy rules, and host
real-time listening rooms.

The core product promise is:

- artists retain control over catalog, rights, royalties, and access policy;
- listeners can discover and play music through a familiar player experience;
- access rules are represented on-chain and enforced in the app before full
  playback;
- rooms allow one host to stream the current track to connected listeners in
  real time.

## 2. Product Areas

### 2.1 Music / Listen

The Music view provides:

- artist-grouped catalog browsing;
- track artwork, title, artist, description, price, and access mode badges;
- a local player for hosts;
- remote playback for room listeners;
- room-hosting controls;
- access warnings for restricted tracks.

### 2.2 Rooms

The Rooms view provides:

- open-room discovery through the signaling server;
- manual room-code entry;
- listener count and host information;
- WebRTC connection setup between host and listener.

### 2.3 Artist Portal

The dedicated `/artists` portal provides:

- wallet-first artist onboarding;
- artist runtime creation;
- audio upload;
- cover upload;
- title, description, access mode, price, personhood level, primary artist
  share, and additional rights-holder royalty inputs;
- server-side audio encryption and Pinata IPFS upload when the backend is configured;
- canonical IPFS metadata publication;
- optional advanced Bulletin Chain archival publication;
- on-chain release registration.

## 3. Users And Roles

### 3.1 Artist

An artist can:

- create one personal `SmartRuntime`;
- publish tracks to that runtime;
- define access mode and price/personhood requirements;
- define royalty recipients and basis-point splits;
- receive revenue through runtime payment distribution;
- own the initial track NFT.

### 3.2 Listener

A listener can:

- browse registered tracks;
- play Free or authorized tracks;
- receive a clear access gate and no protected audio when access is denied;
- pay for Classic tracks through `musicRoyPayAccess`;
- access Human free tracks if their on-chain personhood level satisfies the
  requirement;
- join listening rooms.

### 3.3 Host

A host is a listener running the local player in host mode. The host streams the
captured audio element to room listeners through WebRTC.

### 3.4 Registrar / Operator

The runtime personhood registrar writes personhood levels used by Human free
access checks. In the current prototype this is not integrated with live
Individuality data.

## 4. System Architecture

```text
Browser (React + Vite)
  ├── Player and catalog UI
  ├── WebRTC host-to-listener audio stream
  ├── Socket.IO signaling server for SDP/ICE and room discovery
  ├── Dotify API for production upload orchestration and key delivery
  ├── Pinata API for demo/local encrypted audio, cover, and metadata pinning
  ├── IPFS gateways for manifest and audio-byte reads
  ├── Paseo Bulletin Chain for optional archival metadata availability
  └── Paseo Asset Hub EVM contracts for artist runtimes and access policy
```

The frontend is a static React/Vite app. It can be served locally by Vite or
built as a single-file Bulletin/IPFS-friendly artifact.

Production-sensitive upload and content-key operations live behind
`services/api/`. Browser-side Pinata upload and `VITE_CONTENT_SECRET` key
derivation remain local/demo paths only.

Product SDK / Playground / Humanity integration is a progressive enhancement
track, not a hard dependency for first sound. The current verified SDK snapshot
(`@parity/product-sdk` 0.17.0 at
`2f359bba28ca72855207a0a519d4118b37b4438c`) must be treated as
prototype/reference/unaudited until Dotify proves Host capability detection,
Product account signing, resource allocation, contract portability, and
Statement Store constraints against the current app.

## 5. Repository Layout

| Path                              | Responsibility                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `README.md`                       | project overview, current deployment, run instructions                         |
| `web/`                            | React frontend, signaling server, Bulletin deploy scripts                      |
| `web/src/App.tsx`                 | main app shell and current product workflows                                   |
| `web/src/services/pinata.ts`      | backend-mediated uploads, demo Pinata uploads, and IPFS gateway fallback reads |
| `web/src/services/keyService.ts`  | wallet-signed nonce and content-key request client                             |
| `web/src/utils/crypto.ts`         | AES-256-GCM helpers                                                            |
| `web/src/utils/protectedAudio.ts` | demo/local encrypted audio refs and deterministic browser key derivation       |
| `web/server/signaling.mjs`        | Socket.IO signaling server                                                     |
| `services/api/`                   | Fastify backend for health, uploads, nonces, key delivery, and access checks   |
| `contracts/evm/`                  | Hardhat project for smart-runtime contracts                                    |
| `contracts/evm/contracts/`        | Solidity contracts, pallets, libraries                                         |
| `contracts/evm/scripts/deploy.ts` | local/testnet deployment script                                                |
| `deployments.json`                | current deployed factory, directory, initializer, and pallet addresses         |

## 6. Smart Contract Specification

### 6.1 Deployment Model

Dotify uses an EVM smart-runtime system on Paseo Asset Hub.

- `ArtistRuntimeFactory` deploys one personal `SmartRuntime` per artist.
- `ArtistDirectory` maps each artist address to its runtime.
- `SmartRuntime` is assembled from shared pallets.
- `DotifyRuntimeInitializer` initializes runtime music state during deployment.

Current testnet deployment:

- factory: `0x9337287a194dfd8b53939eee1890b3f4ec0f8b0d`
- directory: `0xda2761fea6f0871ed44ec719860fddb51b115be8`
- chain: Paseo Asset Hub, chainId `420420417`

Security status: these configured addresses point to a fresh factory/directory
whose registry facet matches the source-level owner-only `musicRegRegister`
implementation. Read-only audit at finalized block `10904607` verified the
factory/directory pairing, the corrected registry code hash
`0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788`, zero
finalized runtimes, and zero pending runtimes. New artist runtime creation and
release registration are therefore enabled for this deployment. The legacy
quarantined deployment and its remediation procedure remain documented in
[`docs/operations/registry-facet-remediation.md`](docs/operations/registry-facet-remediation.md).

### 6.2 Runtime Pallets

The runtime includes:

- `DiamondCutPallet`: runtime pallet update mechanics.
- `DiamondLoupePallet`: runtime introspection.
- `OwnershipPallet`: runtime ownership.
- `MusicRegistryPallet`: track registration, reads, and deactivation.
- `MusicNFTPallet`: per-track NFT ownership and transfer state.
- `MusicRoyaltiesPallet`: Classic access payment and royalty distribution.
- `MusicAccessPallet`: access checks and personhood-level state.

### 6.3 Track Record

A registered track stores:

- artist address;
- token ID;
- title;
- artist display name;
- description;
- cover image reference;
- audio reference;
- metadata reference;
- artist contract reference;
- royalty basis points;
- access mode;
- Classic price;
- required personhood level;
- registration block;
- active flag.

### 6.4 Access Modes

`Human free`:

- requires `personhoodLevelOf(listener) >= requiredPersonhood`;
- also gates NFT transfer to recipients with the required personhood level;
- is intended for integration with Polkadot Proof of Personhood / Individuality.

`Classic`:

- requires payment through `musicRoyPayAccess(contentHash)`;
- records paid access for the listener;
- distributes payment according to royalty splits.

Artists and track NFT owners are expected to have access to their own tracks.

### 6.5 Contract Tests

The active runtime tests cover:

- runtime factory deployment;
- artist runtime creation;
- track registration and deactivation;
- paid access and royalty distribution;
- personhood-gated access;
- NFT transfer gating;
- isolation between artist runtimes.

Legacy `MusicRightsRegistry.sol` remains in the repository but is not the active
frontend integration path.

## 7. Audio And Metadata Specification

### 7.1 Upload Pipeline

For a production uploaded track when `VITE_DOTIFY_API_URL` is configured:

1. The browser reads the audio file.
2. The browser computes a blake2b-256 content hash.
3. The browser sends the raw audio file and content hash to the backend upload
   endpoint.
4. The backend derives the per-track content key from
   `CONTENT_KEY_MASTER_SECRET`, encrypts the full audio with AES-256-GCM, and
   pins the encrypted bytes to Pinata.
5. The cover image is uploaded through the backend.
6. A canonical Dotify metadata manifest is validated and uploaded through the
   backend.
7. The manifest can also be archived to Paseo Bulletin Chain when the advanced
   Bulletin option is enabled and a Substrate signer is available.
8. The artist registers the track on their runtime.

For a local/demo uploaded track when `VITE_DOTIFY_API_URL` is unset:

1. The browser reads the audio file.
2. The browser computes a blake2b-256 content hash.
3. The browser encrypts the audio bytes with AES-256-GCM.
4. The encrypted bytes are uploaded to Pinata.
5. The cover image is uploaded to Pinata.
6. A Dotify metadata manifest is uploaded to Pinata and becomes the canonical
   `metadataRef`.
7. The manifest can also be archived to Paseo Bulletin Chain when the advanced
   Bulletin option is enabled and a Substrate signer is available.
8. The artist registers the track on their runtime.

### 7.2 Audio References

Encrypted audio uses:

```text
dotify:enc:ipfs://<CID>
dotify:enc:v2:ipfs://<CID>
```

The first form is the legacy whole-file encrypted object. New production
uploads use the DAV2 chunked container in the second form. Plain
`ipfs://<CID>` audio references may still be handled by the frontend, but
registered Dotify uploads should use encrypted refs.

### 7.3 Encryption Model

Production audio protection uses the backend as the key boundary:

- full audio is encrypted with AES-256-GCM server-side;
- per-track keys are derived from backend-only `CONTENT_KEY_MASTER_SECRET`;
- a wallet signature opens a short-lived session, with a legacy signed
  per-request fallback for older backends;
- the frontend requests keys through `POST /api/tracks/:contentHash/key-request`;
- the backend verifies the session or signature, resolves the artist runtime,
  and calls `musicAccCanAccess` before releasing a key;
- Free-key requests need no wallet, but the backend still verifies the current
  zero-address access decision on-chain;
- denials return no content key and no degraded audio.

Demo/local audio protection is still best-effort and browser-side:

- encrypted audio is produced with AES-256-GCM;
- the app derives a deterministic content key from `VITE_CONTENT_SECRET` and
  the content hash;
- the encrypted IPFS object is not directly playable by an HTML audio element;
- `VITE_CONTENT_SECRET` is bundled into the frontend, so this is not a
  production key boundary.

Dotify protects distribution access. It does not promise absolute DRM or prevent
recording after authorized playback.

The access-v2 model deliberately retired the production preview path. An artist
may define a Free, paid/Classic, or human-free door; unauthorized protected
playback is an honest gate. A future artist-chosen excerpt would be a distinct
asset and policy, not a key leak or client-generated slice.

### 7.4 IPFS Gateway Reads

The frontend reads manifests and encrypted audio through gateway fallback logic:

- primary gateway: `VITE_PINATA_GATEWAY`;
- optional configured fallbacks: `VITE_IPFS_READ_GATEWAYS`;
- built-in public fallbacks include Paseo IPFS, `ipfs.io`, and `dweb.link`.

This protects the app from custom gateway authorization failures such as `401`
responses on otherwise public files.

## 8. Playback And Access Enforcement

### 8.1 Full Playback

When a registered track is selected:

1. The app resolves the track from the runtime catalog.
2. Free tracks continue without a wallet; gated tracks require a listener
   identity before individual access can be checked.
3. The app checks `musicAccCanAccess(contentHash, listener)` for local UI state.
4. For production encrypted tracks, the app requests a content key from the
   backend with a short-lived signed session (or legacy signed request) and
   purpose `individual`; Free tracks use the separately verified free-key path.
5. The backend performs the authoritative access check before returning a key.
6. If access is allowed, the app fetches encrypted bytes from IPFS.
7. The app decrypts the full audio in the browser using the backend-delivered
   key (or the demo/local derived key for demo-published tracks).
8. The app creates a local object URL and assigns it to the audio element.

If no listener identity is available, the app must fail closed for gated
tracks. Free tracks remain wallet-free. Artist registration and release
publication require an explicit artist account; dev EVM accounts must not sign
public user or artist flows.

### 8.2 Restricted Playback Gate

If access is denied:

1. The app assigns no protected audio source and delivers no key.
2. The player shows the exact missing condition: sign in, support/pay, or verify
   personhood.
3. A room remains open if its host lacks access, but it streams no protected
   audio until the host unlocks, verifies, or selects a playable track.
4. Room guests are never asked to satisfy the host's access policy.

Warning behavior:

- No connected wallet: prompts the listener to sign in before access can be
  checked.
- Human free restriction: explains required DIM level and personhood action.
- Classic restriction: explains required payment and shows a payment action.

### 8.3 Classic Unlock

For Classic tracks:

1. The listener clicks the payment action.
2. The app calls `musicRoyPayAccess(contentHash)` with the track price.
3. The app waits for transaction confirmation.
4. The app reselects the track.
5. `musicAccCanAccess` should return true and full playback loads.

## 9. Listening Room Specification

### 9.1 Signaling

The signaling server is a Node/Socket.IO process. It handles:

- room creation;
- room discovery;
- room join;
- room track metadata updates;
- player state updates;
- WebRTC offer/answer relay;
- ICE candidate relay;
- disconnect cleanup.

The server does not stream media. It only coordinates peers.

### 9.2 Media Transport

The host browser:

- plays the selected audio source locally;
- captures the audio element through `captureStream`;
- creates one `RTCPeerConnection` per listener;
- sends audio tracks to listeners.

The listener browser:

- receives the remote media stream;
- plays it through a remote audio element;
- follows host player state.

### 9.3 Room Limitations

- A room has one host.
- If the host leaves, the room ends.
- There is no host handoff.
- Room playback is intentionally host-access based; room listeners are not
  independently gated for the default public-room policy.
- Public deployments require a hosted signaling server.

## 10. Frontend Runtime Configuration

Important browser-exposed variables:

| Variable                  | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_DOTIFY_DEPLOYMENT`  | build-time deployment safety mode; set `production` for public production builds            |
| `VITE_DOTIFY_DEBUG_PANEL` | optional flag that shows the read-only Production readiness panel under `You`                |
| `VITE_SIGNAL_URL`         | Socket.IO signaling server URL                                                             |
| `VITE_LOCAL_WS_URL`       | local Substrate websocket URL                                                              |
| `VITE_LOCAL_ETH_RPC_URL`  | local EVM RPC URL                                                                          |
| `VITE_BULLETIN_WS_URL`    | Paseo Bulletin Chain RPC                                                                   |
| `VITE_PINATA_JWT`         | restricted Pinata JWT for browser demo uploads                                             |
| `VITE_PINATA_GATEWAY`     | primary IPFS gateway                                                                       |
| `VITE_IPFS_READ_GATEWAYS` | comma-separated IPFS read fallbacks                                                        |
| `VITE_DOTIFY_API_URL`     | backend API URL for production uploads and wallet-signed key requests                      |
| `VITE_CONTENT_SECRET`     | optional demo/local 32-byte hex content-key derivation secret; never a production boundary |

Server/script variables:

| Variable                    | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `SIGNAL_PORT`               | local signaling server port                        |
| `SIGNAL_ORIGINS`            | allowed frontend origins for signaling             |
| `API_PORT`                  | backend API port                                   |
| `API_ORIGIN`                | frontend origin allowed by backend CORS            |
| `PASEO_ASSET_HUB_RPC`       | backend RPC endpoint for access checks             |
| `DOTIFY_DIRECTORY_ADDRESS`  | backend ArtistDirectory address for runtime lookup |
| `DOTIFY_CHAIN_ID`           | chain ID expected in signed key requests           |
| `PINATA_JWT`                | backend-only Pinata credential                     |
| `CONTENT_KEY_MASTER_SECRET` | backend-only content-key derivation secret         |
| `BULLETIN_ACCOUNT`          | dev account used by Bulletin deploy script         |

## 11. Wallet And Passkey Design

Dotify supports two wallet paths in the frontend design:

- passkey-backed local key derivation through WebAuthn PRF;
- browser wallet extension signing through Polkadot/EVM wallet providers.

### 11.1 Passkey Credential ID

When a passkey is created, the browser returns a WebAuthn credential whose
`rawId` is stored by the app as a base64 string. This value is the WebAuthn
credential ID.

The credential ID is an opaque lookup identifier. It tells the browser and
authenticator which passkey credential should be used during a future
authentication request.

The credential ID is not:

- an EVM private key;
- a Substrate private key;
- the WebAuthn PRF output;
- the passkey private key;
- a signing secret;
- enough information to sign transactions.

Because of that, storing the credential ID in `localStorage` is acceptable for a
prototype. Storing it in a dedicated backend database can also be safe and is
normal in a full WebAuthn design.

### 11.2 Data That May Be Stored Server-Side

A backend-backed passkey design may store:

- application user ID;
- WebAuthn credential ID;
- WebAuthn public key;
- sign counter and backup eligibility metadata;
- creation and last-used timestamps;
- display metadata such as device label.

The backend must not store:

- WebAuthn PRF output;
- EVM private keys;
- Substrate private keys;
- raw `KeyManager` seed material;
- derived symmetric content keys.

### 11.3 LocalStorage Loss Behavior

If browser cache or site storage is cleared, the app loses the stored credential
ID. This does not necessarily delete the passkey itself, because the passkey
usually lives in the OS password manager, browser passkey store, or hardware
security key.

However, if the app only supports login by replaying the locally stored
credential ID, clearing `localStorage` can make the app unable to locate the
existing passkey. The user may then create a new passkey, which produces a new
PRF output and therefore a different derived EVM/Substrate wallet.

The current design requests a resident/discoverable credential, so a future
improvement should add a discoverable passkey login flow that does not depend on
`localStorage` having the credential ID.

### 11.4 Key Loss Risks

The derived wallet can be lost or changed if:

- the actual passkey is deleted from the OS password manager, browser passkey
  store, or hardware security key;
- the WebAuthn credential is not synced to the user's other devices and the
  original device is lost;
- the WebAuthn PRF extension is unavailable on the browser/authenticator used
  for recovery;
- `PRF_SALT` changes after users have created wallets;
- the app treats a missing local credential ID as a new-user flow and creates a
  replacement passkey.

The `PRF_SALT` must be treated as permanent once real users exist. Rotating it
rotates all derived accounts.

### 11.5 Recommended Production Direction

For production, Dotify should implement a standard WebAuthn backend flow:

- register and verify WebAuthn credentials server-side;
- store credential IDs and public keys in the backend;
- support discoverable credential login;
- keep PRF outputs strictly client-side;
- show explicit recovery warnings before users rely on passkey-derived wallets;
- provide an account migration or backup story before real funds or valuable
  rights are managed by passkey-derived accounts.

## 12. Build And Deployment

### 12.1 Web App

Local development:

```bash
cd web
npm install
npm run dev:listen
```

Production build:

```bash
cd web
VITE_DOTIFY_DEPLOYMENT=production \
VITE_SIGNAL_URL=https://dotify-signal.example \
VITE_DOTIFY_API_URL=https://dotify-api.example \
VITE_PINATA_GATEWAY=https://gateway.example \
VITE_IPFS_READ_GATEWAYS=https://paseo-ipfs.example,https://dweb.example \
npm run build
```

When `VITE_DOTIFY_DEPLOYMENT=production` is set, the build fails if required
production URLs are missing, use loopback/insecure origins, or if
`VITE_PINATA_JWT` / `VITE_CONTENT_SECRET` are present in the browser bundle.

Bulletin/IPFS single-file build:

```bash
cd web
npm run build:bulletin
npm run deploy:bulletin
```

### 12.2 Contracts

Local deployment:

```bash
cd contracts/evm
npm install
npm run deploy:local
```

Paseo Asset Hub testnet deployment:

```bash
cd contracts/evm
npm run deploy:testnet
```

Verification:

```bash
cd contracts/evm
npm run verify:testnet
```

Tests:

```bash
cd contracts/evm
npm test
```

## 13. Non-Functional Requirements

### 13.1 Security

- Do not use unrestricted Pinata JWTs in frontend environments.
- Treat browser-side encryption as demo protection.
- Move production pinning and key delivery behind authenticated services.
- Keep runtime contract access checks as the source of truth for policy.
- Keep WebAuthn PRF outputs and derived private keys client-side only.
- Treat `PRF_SALT` as permanent once passkey-derived wallets are in use.

### 13.2 Availability

- IPFS reads must use gateway fallback.
- Public listening rooms require a hosted signaling server.
- IPFS metadata is the canonical release metadata source.
- Bulletin metadata should be treated as optional archival availability, not the
  default publish path.

### 13.3 Compatibility

- Development requires Node 22 and npm 10+.
- WebRTC host mode requires browser support for audio element `captureStream`.
- Passkey wallet mode requires a secure origin and WebAuthn PRF support.

## 14. Current Limitations

- Browser-side Pinata upload and `VITE_CONTENT_SECRET` are still available for
  local/demo mode and must not be used as public production boundaries.
- DAV2 Range/MSE playback still needs a documented real-browser, media-container,
  and gateway validation matrix before P3 is release-ready.
- Passkey credential discovery currently depends on locally stored credential
  metadata.
- Proof of Personhood is not connected to live Individuality data.
- Frontend e2e coverage exists for Classic unlock, artist publish, and room
  join/host-access behavior.
- Production catalog browsing now uses the backend read model when
  `VITE_DOTIFY_API_URL` is configured. Its durable baseline is an atomic
  single-writer JSON snapshot; horizontal API replicas require shared storage.
- `App.tsx` is now a thin shell, but `useCatalog`, `useSession`,
  `useArtistConsole`, `PlayerView`, and the historical stylesheet remain large.
- Frontend contract bindings are generated from Hardhat artifacts; keep the
  generation check in the contract workflow.
- Legacy monolithic registry contracts remain in the repository.

## 15. Improvement Backlog

Priority improvements:

1. Reconcile the local backlog with GitHub Project 5 and keep drift visible in
   PR checks.
2. Complete real-browser DAV2 Range/MSE and two-device room validation.
3. Operate and monitor public backend and signaling infrastructure for DotNS /
   Bulletin builds.
4. Finish security hardening for publish intents, auth chain binding, durable
   revocation, realtime reconnect, and short-lived TURN credentials.
5. Run Product SDK feasibility spikes for Host capability detection, Product
   account signing, resource allocation, Playground/Bulletin/DotNS deployment,
   Statement Store presence, and PolkaVM/CDM contract portability.
6. Move the large catalog, session, artist, and player workflows behind domain
   ports and application use cases.
7. Validate the cacheable catalog API's warm/cold p75 budgets under public seed
   traffic, then move its single-writer snapshot to shared storage before
   horizontal scaling.
8. Harden production wallet support and passkey recovery across public flows.
9. Add backend-backed WebAuthn registration, credential storage, and
   discoverable passkey recovery.
10. Integrate live Humanity / Individuality data only after the research ticket
    proves source, proof shape, privacy, and address binding.
11. Archive or remove the legacy monolithic registry path.
12. Add deployment smoke tests and finish frontend health surfaces.

## 16. Acceptance Criteria For MVP

The project reaches a coherent public testnet MVP when:

- an external artist can connect a real wallet and create a runtime;
- the artist can upload, encrypt, pin, and register a track;
- an external listener can browse the registered catalog;
- a Free track reaches first sound without a wallet;
- a Classic listener can pay and unlock full playback;
- a Human free listener can unlock based on a live personhood source;
- unauthorized listeners receive no protected audio and see the exact access
  action;
- a host can open a room from an authorized track;
- listeners can join through a shared link without a wallet and never receive a
  content key or protected source reference;
- critical flows have automated test coverage.
