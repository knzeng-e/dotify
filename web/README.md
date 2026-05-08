# Dotify Web

React frontend for Dotify, a decentralized shared-listening experience built
around real-time rooms, artist catalog management, encrypted IPFS audio, and
track NFT rights.

Visible product areas:

- `Home`: artist-grouped catalog browsing, track artwork, descriptions, access
  badges, policy-aware player, and room hosting.
- `Rooms`: open room discovery and room-code entry.
- `Artist Studio`: artist runtime creation, audio upload, cover upload, artist
  contract PDF upload, royalty splits, Human free / Classic mode selection,
  Pinata IPFS pinning, optional Bulletin Chain metadata publication, and
  contract registration.

## Run Locally

Use Node 22 and npm 10+.

```bash
npm install
npm run dev:listen
```

The script starts Vite at `http://localhost:5273` and the Socket.IO signaling
server at `http://localhost:8788`.

Useful environment variables:

- `VITE_SIGNAL_URL`: Socket.IO signaling server for listening rooms.
- `VITE_LOCAL_WS_URL` / `VITE_LOCAL_ETH_RPC_URL`: local development endpoints.
- `VITE_BULLETIN_WS_URL`: Paseo Bulletin Chain RPC.
- `VITE_PINATA_JWT`: restricted browser-exposed Pinata JWT for demo uploads.
- `VITE_PINATA_GATEWAY`: primary gateway used when rendering IPFS assets.
- `VITE_IPFS_READ_GATEWAYS`: comma-separated read fallback gateways for IPFS
  manifests and encrypted audio.
- `VITE_CONTENT_SECRET`: optional 32-byte hex secret used for best-effort
  browser-side encrypted audio. It is bundled into the app, so it is not a
  production DRM boundary.

See `.env.example` for local defaults and script-only variables.

## Audio And IPFS

Uploaded audio is hashed locally with blake2b-256, encrypted with AES-256-GCM,
and uploaded to Pinata as encrypted bytes. The on-chain `audioRef` stores a
`dotify:enc:ipfs://CID` URI, so the raw IPFS object is not directly playable by
an HTML audio element.

Cover images and track manifests are also pinned through Pinata. Manifest reads
and encrypted audio downloads use `fetchIpfsCid`, which tries the configured
primary gateway first and then falls back to public IPFS gateways. This avoids
breaking playback when a custom Pinata gateway returns `401` for public files.

The current protection model is best-effort:

- the browser derives the content key from `VITE_CONTENT_SECRET` plus the track
  hash;
- the encrypted CID is public, but the bytes are not directly playable;
- the secret is still shipped to the browser, so production key release should
  move behind a wallet-gated backend or artist key service.

## Access Policy

Registered tracks use two access modes:

- `Human free`: available to accounts whose on-chain personhood level satisfies
  the track requirement (`DIM1` or `DIM2`).
- `Classic`: paid access in DOT through `musicRoyPayAccess`.

Before playback, the frontend calls `musicAccCanAccess(contentHash, listener)`.
If access is granted, the encrypted IPFS audio is decrypted and the full track is
loaded. If access is denied, the app creates a separate 42% preview audio object
and shows an unlock warning:

- Users without a connected wallet receive preview-only playback and are asked
  to sign in before full access can be checked.
- Human free tracks instruct the listener to verify personhood.
- Classic tracks show a payment action and retry playback after the transaction
  confirms.

This enforces the current product policy in the UI, but it is not a substitute
for server-side key delivery in production because all frontend code is public.

## Chain Integration

The app reads artist runtimes from `ArtistDirectory`, then aggregates releases
from each artist `SmartRuntime`. Artist registration calls
`ArtistRuntimeFactory.createRuntime`; release registration calls
`musicRegRegister` on the artist runtime.

Bulletin Chain interactions use the PAPI descriptors in `.papi/` and can publish
compact metadata JSON as an additional availability layer. Regenerate descriptors
with:

```bash
npm run update-types
npm run codegen
```

## Build And Deploy

```bash
npm run build
npm run build:bulletin
npm run deploy:bulletin
```

`build:bulletin` produces a single-file build via `vite-plugin-singlefile` so it
can be distributed from a flat IPFS CID / DotNS record.

## Current Limitations

- Uploads call Pinata directly from the browser. Use only restricted demo tokens;
  production should proxy pinning through a backend.
- Playback protection is client-side best-effort. A real release system needs
  wallet-gated key delivery instead of a bundled `VITE_CONTENT_SECRET`.
- Wallet selection still uses local dev account helpers; public testnet usage
  needs injected wallet support.
- Proof of Personhood levels are contract storage controlled by the runtime
  registrar; live Individuality integration is not implemented yet.
- The signaling server must be hosted separately for DotNS / Bulletin builds.
- Frontend test coverage is missing for payment, unlock, preview, and room flows.

## Improvement Backlog

- Add real wallet integration through injected EVM providers / Polkadot wallets.
- Move Pinata uploads and content-key release behind a backend or artist-run key
  service.
- Replace bundled-content-secret protection with per-track key custody and
  wallet-signed key requests.
- Add Playwright or Vitest coverage for register, pay, preview, unlock, and
  WebRTC room flows.
- Split `App.tsx` into focused modules for catalog, player, studio, rooms, and
  chain access.
- Add production monitoring for gateway fallback failures and signaling uptime.
