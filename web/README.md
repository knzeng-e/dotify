# Dotify Web

React frontend for Dotify, a decentralized shared-listening experience built
around real-time rooms, artist catalog management, encrypted IPFS audio, and
track NFT rights.

Visible product areas:

- `Home`: artist-grouped catalog browsing, track artwork, descriptions, access
  badges, policy-aware player, and room hosting.
- `Rooms`: open room discovery and room-code entry.
- `/artists`: dedicated artist onboarding and studio flow for artist runtime
  creation, audio upload, cover upload, royalty splits, Human free / Classic
  mode selection, Pinata IPFS pinning, optional Bulletin Chain metadata
  publication, and contract registration.

## Run Locally

Use Node 22 and npm 10+.

```bash
npm install
npm run dev:listen
```

The script starts Vite at `http://localhost:5273` and the Socket.IO signaling
server at `http://localhost:8788`. Open the listener app at `/` and the artist
portal at `/artists`.

Useful environment variables:

- `VITE_SIGNAL_URL`: Socket.IO signaling server for listening rooms.
- `VITE_DOTIFY_API_URL`: backend API for server-side uploads and
  wallet-signed content-key requests.
- `VITE_LOCAL_WS_URL` / `VITE_LOCAL_ETH_RPC_URL`: local development endpoints.
- `VITE_BULLETIN_WS_URL`: Paseo Bulletin Chain RPC.
- `VITE_PINATA_JWT`: restricted browser-exposed Pinata JWT for demo uploads
  when `VITE_DOTIFY_API_URL` is unset.
- `VITE_PINATA_GATEWAY`: primary gateway used when rendering IPFS assets.
- `VITE_IPFS_READ_GATEWAYS`: comma-separated read fallback gateways for IPFS
  manifests and encrypted audio.
- `VITE_CONTENT_SECRET`: optional 32-byte hex secret used for best-effort
  browser-side encrypted audio. It is bundled into the app, so it is not a
  production DRM boundary.
- `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`: optional TURN
  relay credentials for reliable room WebRTC across restrictive NATs.
- `VITE_BLOCKSCOUT_BASE_URL`: optional Blockscout explorer base URL.

See `.env.example` for local defaults and script-only variables.

## Audio And IPFS

Uploaded audio is always hashed locally with blake2b-256. When
`VITE_DOTIFY_API_URL` is configured, the browser sends the raw audio plus
content hash to the backend, and the backend encrypts with its
`CONTENT_KEY_MASTER_SECRET` before pinning to Pinata. In local demo mode, when
`VITE_DOTIFY_API_URL` is unset, the browser encrypts with `VITE_CONTENT_SECRET`
and pins directly with `VITE_PINATA_JWT`.

The on-chain `audioRef` stores a `dotify:enc:ipfs://CID` URI, so the raw IPFS
object is not directly playable by an HTML audio element.

Cover images and track manifests are also pinned through Pinata. Manifest reads
and encrypted audio downloads use `fetchIpfsCid`, which tries the configured
primary gateway first and then falls back to public IPFS gateways. This avoids
breaking playback when a custom Pinata gateway returns `401` for public files.

The production protection boundary is the backend API:

- Pinata credentials stay server-side.
- Content keys are derived from `CONTENT_KEY_MASTER_SECRET`.
- Full-track key delivery requires a wallet-signed request and an on-chain
  access check.
- Room guests never receive keys; only an authorized host may request a
  `room_host` key.

The fallback browser-only protection model is best-effort:

- the browser derives the content key from `VITE_CONTENT_SECRET` plus the track
  hash;
- the encrypted CID is public, but the bytes are not directly playable;
- the secret is still shipped to the browser, so production key release should
  use the backend path instead.

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

## Tests

```bash
npm run test:unit     # Vitest - pure domain logic (access policy, room state)
npm run test:signal   # node:test - signaling server lifecycle
npm run test:e2e      # Playwright - deterministic trust flows
```

`test:unit` runs Vitest over the extracted pure modules under `src/features/*`
(currently access policy and room state).

`test:e2e` runs Playwright against deterministic mock modes. It covers Classic
preview/payment/unlock, artist runtime creation plus release publication, and
the listening-room join + host-access playback flow, without requiring live
funds, Pinata, or a chain. Artist publish coverage also asserts missing wallet,
wrong network, upload failure, and transaction failure states.

## Frontend Structure

The frontend is migrating from an `App.tsx`-centric shell toward feature modules
so logic can be unit-tested and evolved in isolation (backlog ticket 08). The
target shape is:

```txt
src/
  features/   # domain logic grouped by product surface
    access/   # track access policy predicates (pure, unit-tested)
    rooms/    # room share-link + presence helpers (pure, unit-tested)
    catalog/  # track model: TrackInfo mapping, runtime-id parsing (pure, unit-tested)
    player/   # playback status labels + transport progress (pure, unit-tested)
    wallet/   # EIP-1193 chain helpers + chain-mismatch message (pure, unit-tested)
    uploads/  # draft track model + upload status transitions (pure, unit-tested)
    runtime/  # access-policy encode/decode between app model and chain (pure, unit-tested)
    ...       # artist-studio (incremental)
  components/ # presentational UI
  views/      # page-level compositions
  hooks/      # stateful orchestration (useCatalog, useSession, ...)
  services/   # IPFS, key service
  config/     # chain + deployment config
  utils/      # framework-agnostic helpers
```

Pure domain logic lives in `features/*` with co-located `*.test.ts` files and no
DOM or chain dependencies; helpers that read `window.location` accept an explicit
argument so they stay testable. Extraction is incremental and behavior-preserving:
each module is wired back into the existing hooks/views without changing product
behavior. So far the extracted, tested modules are `features/access/accessPolicy.ts`
(the policy-managed-track predicate, previously duplicated across `App.tsx`,
`useCatalog.ts`, and `PlayerView.tsx`), `features/rooms/roomState.ts` (share-link
parsing/building and room presence count), and `features/catalog/trackModel.ts`
(`TrackInfo` mapping and runtime-id parsing, previously inline in `App.tsx` and
duplicated across `useCatalog.ts` and `ReleasesTab.tsx`), and
`features/player/playbackStatus.ts` (the `AudioStatus` model, status labels, and
transport progress math, previously in `usePlayback.ts` and `PlayerView.tsx`), and
`features/wallet/network.ts` (EIP-1193 chain-id parsing/encoding, provider error
codes, and the chain-mismatch message previously duplicated in `App.tsx` and
`useArtistConsole.ts`), and `features/uploads/uploadModel.ts` (the draft-track
builder, title-from-filename rule, and upload-status transitions pulled out of
`App.tsx`, plus `priceDotForAccessMode`/`localAudioRef` in `trackModel.ts` that
de-duplicate the price and local-ref logic shared with `useArtistConsole.ts`),
and `features/runtime/accessEncoding.ts` (bidirectional access-mode / personhood
codecs between the app model and the on-chain uint8s, previously inline in
`useArtistConsole.ts` (encode) and `useCatalog.ts` (decode)).

## Current Limitations

- Browser-side Pinata uploads are demo/local mode only. Production should set
  `VITE_DOTIFY_API_URL` and configure `PINATA_JWT` on the backend.
- Playback protection is client-side best-effort only when the backend API is
  not configured. Production key delivery uses wallet-signed backend requests.
- Artist registration and release publication require a connected wallet. Local
  EVM dev accounts are no longer exposed as public artist fallbacks.
- Proof of Personhood levels are contract storage controlled by the runtime
  registrar; live Individuality integration is not implemented yet.
- The signaling server must be hosted separately for DotNS / Bulletin builds.
- Frontend e2e coverage exists for the Classic preview/payment/unlock, artist
  publish, and room join trust flows. Broader wallet/provider coverage is still
  open.

## Improvement Backlog

1. Harden injected EVM provider and passkey wallet support for production usage.
2. Move Pinata uploads and content-key release behind a backend or artist-run key
   service.
3. Replace bundled-content-secret protection with per-track key custody and
   wallet-signed key requests.
4. Add Playwright or Vitest coverage for WebRTC room flows.
5. Split `App.tsx` into focused modules for catalog, player, artist portal,
   rooms, and chain access.
6. Add release draft persistence and edit flows for the `/artists` portal.
7. Add production monitoring for gateway fallback failures and signaling uptime.
