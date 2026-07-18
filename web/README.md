# Dotify Web

React frontend for Dotify, a decentralized shared-listening experience built
around real-time rooms, artist catalog management, encrypted IPFS audio, and
track NFT rights.

Visible product areas:

- `Music`: artist-grouped catalog browsing, track artwork, descriptions, access
  badges, policy-aware player, and room hosting.
- `Rooms`: open room discovery and room-code entry.
- `/artists`: dedicated artist onboarding and studio flow for artist runtime
  creation, audio upload, cover upload, primary artist share plus additional
  rights-holder royalty splits, Human free / Classic mode selection, Pinata IPFS
  pinning, optional Bulletin Chain metadata publication, and contract
  registration.

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
- `VITE_DOTIFY_DEBUG_PANEL`: set to `true` to show the read-only Production
  readiness panel under the `You` tab.
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
- Full-track key delivery requires a signed-in session (one wallet signature
  per ~24h) or a wallet-signed request, plus an on-chain access check on
  every key request.
- Room guests never receive keys; only an authorized host may request a
  `room_host` key.

The fallback browser-only protection model is best-effort:

- the browser derives the content key from `VITE_CONTENT_SECRET` plus the track
  hash;
- the encrypted CID is public, but the bytes are not directly playable;
- the secret is still shipped to the browser, so production key release should
  use the backend path instead.

## Access Policy

Registered tracks use three artist-chosen access modes (changeable on-chain at
any time via `musicRegSetAccessMode`, without re-uploading the audio):

- `Free`: playable by everyone, wallet or not. The key service releases the
  content key without authentication after re-verifying the mode on-chain.
- `Human free`: available to accounts whose on-chain personhood level satisfies
  the track requirement (`DIM1` or `DIM2`).
- `Classic`: paid access in DOT through `musicRoyPayAccess`.

Before playback, the frontend calls `musicAccCanAccess(contentHash, listener)`
(guests probe with the zero address, which only Free tracks grant). If access
is granted, the encrypted IPFS audio is decrypted and the full track is loaded.
If access is denied, nothing plays: the app shows an honest unlock gate naming
the door (pay, verify humanity, or sign in). The 42% preview is retired
(access model v2, `docs/design/dotify-v2-access-and-streaming.md`).

Denial specifics:

- Users without a connected wallet can play Free tracks; for gated tracks they
  are asked to sign in before access can be checked.
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

Contract ABIs are generated from the Hardhat artifacts, not hand-maintained.
`src/generated/contracts/` holds one auto-generated module per contract
(`artistDirectoryAbi`, `artistRuntimeFactoryAbi`, `musicRegistryAbi`,
`musicRoyaltiesAbi`, `musicAccessAbi`, `musicNFTAbi`); `src/shared/config/contracts.ts`
re-exports them so callers import from one place. Regenerate after any contract
change:

```bash
cd ../contracts/evm
npm run generate:abis   # hardhat compile + write web/src/generated/contracts
```

The generated files are committed and excluded from lint/format (they are machine
output) but still typechecked, so a contract signature change that is not
regenerated surfaces as a TypeScript error. CI (`ci-evm`) regenerates and fails on
drift. `SmartRuntime` is a diamond: the app calls it through the facet ABIs above
at the runtime address, so it needs no separate binding.

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

### Production Deploy: Netlify + Fly

Dotify's production web app is a static Vite build, but listening rooms require
a separately hosted Socket.IO signaling server. Deploy the signaling server
first, then build the frontend with `VITE_SIGNAL_URL` pointing at that public
server.

#### 1. Deploy the signaling server on Fly

The signaling server lives in `server/signaling.mjs` and is packaged by
`Dockerfile.signal`.

```bash
flyctl deploy -c fly.signal.toml
flyctl status -c fly.signal.toml
curl -s https://dotify-signal.fly.dev/health
```

Keep the signaling service on one active machine unless a shared Socket.IO
adapter is added. Rooms, solo-presence aggregates, chat, reactions, and request
queues are in memory; with multiple active machines, two browsers can connect
to different presence and room maps.

```bash
flyctl scale count 1 -c fly.signal.toml --yes
```

Fly variables come from `fly.signal.toml`:

- `SIGNAL_PORT=8788`
- `SIGNAL_HOST=0.0.0.0`
- `SIGNAL_ROOM_TTL_MS=21600000`
- `SIGNAL_HOST_TIMEOUT_MS=120000`
- `SIGNAL_MAX_LISTENERS=24`
- `SIGNAL_ORIGINS`: set this explicitly for production frontend origins when
  the public URL is stable.

Health endpoints:

- `/health`: process health, uptime, room count, in-room listener count, and
  active solo-listener count.
- `/status`: public room metadata plus aggregate solo presence by track hash.
  It deliberately omits socket identities, chat history, and request text.

#### 2. Deploy the frontend on Netlify

For a repo-root Netlify site, set:

- Base directory: `web`
- Build command: `npm run build`
- Publish directory: `web/dist`
- Node version: `22`

Required production environment variables:

- `VITE_DOTIFY_DEPLOYMENT=production`
- `VITE_SIGNAL_URL=https://dotify-signal.fly.dev`
- `VITE_DOTIFY_API_URL=<public backend API URL>` for server-side uploads and
  wallet-signed key delivery.
- `VITE_PINATA_GATEWAY=<public IPFS gateway>`
- `VITE_IPFS_READ_GATEWAYS=<comma-separated gateway list>`

Recommended for reliable rooms:

- `VITE_TURN_URL`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

Do not set unrestricted Pinata credentials in Netlify. `VITE_PINATA_JWT` is
browser-exposed and is for restricted local/demo uploads only. Do not treat
`VITE_CONTENT_SECRET` as a production content-key boundary; production playback
should use the backend key service.

With `VITE_DOTIFY_DEPLOYMENT=production`, the frontend build fails before
deployment if the required production URLs are missing, point at loopback or
insecure origins, or if `VITE_PINATA_JWT` / `VITE_CONTENT_SECRET` are present
in the browser environment.

Before changing Netlify/Fly production variables, run:

```bash
npm run smoke:production-env
```

The command exercises the build guard against missing production URLs,
browser-exposed demo secrets, and a safe public production env. CI runs the
same check for Project 5 issue #37.

#### 3. Production smoke checks

After deploying both services:

```bash
curl -s https://dotify-signal.fly.dev/health
curl -s https://dotify-signal.fly.dev/status
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://<netlify-app>
```

When `SIGNAL_ORIGINS` is explicit, also check that an unrelated browser origin
is rejected at both the HTTP CORS and Socket.IO handshake layers:

```bash
npm run smoke:signal -- \
  --url https://dotify-signal.fly.dev \
  --origin https://<netlify-app> \
  --denied-origin https://not-dotify.example
```

To validate the room create/join path without opening browsers, add `--room`.
The command creates a temporary room, joins it as a guest, confirms
`listenersNeedWalletAccess=false`, and disconnects both sockets. Paste the
output into Project 5 issue #36 as hosted-signaling evidence after each public
deployment.

Then verify the user flow in two browser contexts or devices:

1. Open the Netlify app and create a room from a playable track.
2. Copy the `#/rooms/<roomId>` link and open it as a guest.
3. Confirm the guest joins without wallet/signature prompts.
4. Send one chat message and one reaction; both browsers should receive the
   server echo.
5. Start playback; if audio negotiation fails across networks, configure TURN.

For operator smoke checks, temporarily set `VITE_DOTIFY_DEBUG_PANEL=true` and
open `You -> Production readiness`. The panel checks backend readiness,
signaling health, chain RPC, factory/directory contract code, wallet-chain
mismatch, catalog status, and IPFS gateway reads without exposing secrets or
starting write flows.

### Production Troubleshooting

| Symptom                                                                      | Likely cause                                                                                                                        | Check                                                                                                                    | Fix                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend shows `Signal server unavailable`                                   | `VITE_SIGNAL_URL` points to the wrong host, the Fly app is down, or `SIGNAL_ORIGINS` blocks the frontend origin.                    | Browser console, Netlify env vars, `curl -s <signal-url>/health`, `flyctl status -c fly.signal.toml`.                    | Set `VITE_SIGNAL_URL` to the HTTPS Fly URL, redeploy Netlify, start/redeploy Fly, and add the Netlify origin to `SIGNAL_ORIGINS`.                 |
| Room creation works locally but not in production                            | Netlify was built without the production signaling URL.                                                                             | Inspect the deployed JS env by trying to create a room; the UI error includes the signal URL.                            | Set `VITE_SIGNAL_URL` in Netlify and trigger a fresh frontend deploy.                                                                             |
| Guests can join, but chat, reactions, or requests do not appear for everyone | The Fly signaling image is stale, or more than one active Fly machine is serving separate in-memory room maps.                      | `flyctl status -c fly.signal.toml`; compare image name and active machine count.                                         | Run `flyctl deploy -c fly.signal.toml`, then `flyctl scale count 1 -c fly.signal.toml --yes` until a shared Socket.IO adapter exists.             |
| `/health` works but `/status` shows rooms split or missing                   | Multiple signaling instances are active without shared state.                                                                       | `flyctl status -c fly.signal.toml`.                                                                                      | Keep one active machine for the current in-memory signaling design.                                                                               |
| Listener joins but audio never starts                                        | WebRTC cannot establish a media path across the host/listener networks. Signaling can be healthy while audio still fails.           | Chat/reactions work, but the listener stays in a connecting/no-audio state.                                              | Configure a TURN relay with `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL`, then redeploy Netlify.                             |
| Mobile host sees `captureStream()` unsupported                               | Safari/iOS does not expose `HTMLMediaElement.captureStream()` for host audio capture.                                               | Host card shows the capture error before any guest can hear the room.                                                    | Use the Web Audio fallback path; if both media capture APIs are unavailable, host from desktop/Android Chrome and join as a listener on iOS.      |
| Production upload or full-track playback fails                               | Backend API is missing or cannot release keys.                                                                                      | Check `VITE_DOTIFY_API_URL`, backend `/health`, and browser network requests to key/upload endpoints.                    | Deploy/fix the backend API and keep `PINATA_JWT` plus `CONTENT_KEY_MASTER_SECRET` server-side.                                                    |
| Protected track takes too long to start                                      | The IPFS gateway cannot serve DAV2 Range requests quickly, MSE is unsupported for the media type, or the backend key route is slow. | Listen for `dotify:dav2-startup` and `dotify:host-audio-startup` in the browser and inspect key/upload network requests. | Compare selected gateway, hedged header/first-chunk timing, and first-audio timing; then decide whether a backend read-through gateway is needed. |
| A room disappears while the host tab is open                                 | Host heartbeat stopped, the host disconnected, or the room TTL expired.                                                             | Fly logs and `/status`; defaults are 120 seconds heartbeat timeout and 6 hours TTL.                                      | Keep the host tab awake/reconnected, or adjust `SIGNAL_HOST_TIMEOUT_MS` / `SIGNAL_ROOM_TTL_MS` deliberately.                                      |

## Tests

```bash
npm run test:unit     # Vitest - pure domain logic (access policy, room state)
npm run test:signal   # node:test - signaling server lifecycle
npm run smoke:production-env # production env guard evidence
npm run smoke:signal  # operator smoke check for a local or hosted signal URL
npm run test:e2e      # Playwright - deterministic trust flows
```

`test:unit` runs Vitest over the extracted pure modules under `src/features/*`
(currently access policy and room state).

`test:e2e` runs Playwright against deterministic mock modes. It covers Classic
locked/access/payment behavior, artist runtime creation plus release
publication, and the listening-room join + host-access playback flow, without requiring live
funds, Pinata, or a chain. Artist publish coverage also asserts missing wallet,
wrong network, upload failure, and transaction failure states.

## Frontend Structure

The frontend is migrating from an `App.tsx`-centric shell toward feature modules
so logic can be unit-tested and evolved in isolation (backlog ticket 08). The
target shape is:

```txt
src/
  app/        # app-level routing/history + navigation model (pure, unit-tested)
    providers/  # React context stack: UI feedback, wallet identity, ... (composition root)
  features/   # domain logic grouped by product surface
    access/   # track access policy predicates (pure, unit-tested)
    rooms/    # room share-link + presence helpers (pure, unit-tested)
    catalog/  # track model: TrackInfo mapping, runtime-id parsing (pure, unit-tested)
    player/   # playback status labels + transport progress (pure, unit-tested)
    wallet/   # EIP-1193 chain helpers + chain-mismatch message (pure, unit-tested)
    uploads/  # draft track model + upload status transitions (pure, unit-tested)
    runtime/  # access-policy encode/decode between app model and chain (pure, unit-tested)
    artist-studio/  # release wizard step machine + studio-state derivations (pure, unit-tested)
  components/ # presentational UI (shells, modals, dock, nav)
  views/      # page-level compositions
  hooks/      # stateful orchestration (useCatalog, useSession, ...)
  services/   # IPFS, key service
  shared/     # cross-cutting building blocks
    ui/       # presentational primitives (Metric, StatusPill, ...)
    config/   # chain + deployment config
    utils/    # framework-agnostic helpers
    types.ts  # shared domain types
```

The `shared/` tree is in place (`ui`, `config`, `utils`, `types.ts` relocated
from `components/ui`, `config`, `utils`, and `types.ts`). Its `errors/` and
`hooks/` subfolders from the original target are not created yet; the stateful
hooks remain under `hooks/` as orchestration, and a dedicated `errors/` module
is introduced when there is shared error handling to hold.

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
`features/runtime/accessEncoding.ts` (bidirectional access-mode / personhood
codecs between the app model and the on-chain uint8s, previously inline in
`useArtistConsole.ts` (encode) and `useCatalog.ts` (decode)), and
`features/artist-studio/releaseForm.ts` (the release wizard step machine,
`canReviewRelease`, and the artist setup/lock derivations, pulled out of `App.tsx`
and de-duplicated with `NewReleaseTab.tsx`'s local step list), and
`app/routing.ts` (the view enum guard, initial-view, artist-portal-path, and
history/popstate resolution helpers, pulled out of `App.tsx`), and
`app/navigation.ts` (the static `VIEW_COPY` and `NAV_ITEMS` nav model, with
handlers still attached in `App.tsx`).

Alongside the pure modules, `App.tsx` is being decomposed behind a React context
stack under `app/providers/` (backlog `08b-providers-design.md`), so the shell
becomes composition-only rather than the state container. The first providers
own UI feedback (`UiFeedbackProvider`: the transaction modal + wallet-modal
visibility) and wallet identity (`WalletProvider`: `useWallet` plus the derived
active EVM/Substrate identity, the frozen RPC endpoint, `getActiveWalletClient`,
and the network-switch flow); `AppProviders` composes them in `main.tsx`. Each
accessor (`useUiFeedback`, `useWalletContext`) fails closed by throwing outside
its provider. `TopBar`, `WalletModal`, and `TransactionModal` read this state
from context instead of prop drilling. `NavigationProvider` (`useNavigation`)
then owns the shell's route/view state (active view, artist-portal open, public
artist profile, rail collapse) plus `navigateToView`, `openArtistStudio`, and the
popstate/history integration, so route state is no longer threaded into
`useCatalog`/`useSession` and the views. `ReleaseFormProvider` (`useReleaseForm`)
then owns the artist release draft and shared identity fields (title, description,
artist name, price, primary artist share, additional rights-holder royalty
splits, access mode, personhood level, cover file,
Bulletin toggle, upload action, studio tab, wizard step) plus the Bulletin manifest
ref, which retires the write-only `artistConsoleBulletinRef` hack that App.tsx
carried "to break a circular dependency". `CatalogProvider` (`useCatalogContext`)
and `SessionProvider` (`useSessionContext`) then wrap the `useCatalog` and
`useSession` hooks: the hooks keep their dependency-injection signatures, the
wiring App.tsx used to do moves into the providers, and the catalog-owned effects
(load the on-chain catalog, sync per-track access) and the one-link room-join
effect move with them. This removes the catalog/session prop drilling into the
views. Finally `ArtistStudioProvider` (`useArtistStudio`) wraps `useArtistConsole`
plus the royalty summary, and `PlaybackProvider` (`usePlaybackContext`) wraps
`usePlayback` and owns the cross-domain open-track / prepare-stream / host-startup
handlers. With that, `App.tsx` calls no feature hooks and owns no business state:
it reads from the contexts and composes the render tree.

The render tree is then split by shell. `views/ListenerShell.tsx` holds the entire
listener-facing tree (top bar, nav rail, page views, player dock, room modals) plus
the listener-only UI state and handlers. `views/ArtistShell.tsx` holds the artist
portal content (the release studio or onboarding) plus the artist upload handlers,
wizard-step navigation, studio-state derivations, and the two artist-portal-gated
effects (royalty refresh, stored-name sync on entry), rendered inside
`views/ArtistPortalView.tsx`. Both shells are self-contained, consuming the provider
stack directly. `App.tsx` is now a thin switch between them (`isArtistPortal ?
<ArtistShell /> : <ListenerShell />`) plus the handful of effects that span both
shells: cleanup, the living-light body classes, the aura engine, and the
artist-identity seeds (initial name sync, runtime resolution) that also feed the
listener account view. It is under 80 lines, down from ~990 at the start of ticket 08.

Two cross-shell pieces are shared, not duplicated: the "artists backed / tracks
unlocked" rollup is a pure, tested helper (`features/wallet/supportSummary.ts`), and
the wallet + transaction modals both shells show are rendered through
`components/AccountWalletModal.tsx` (the context adapter for the presentational
`WalletModal`).

Page-level views then consume context directly rather than taking large prop
lists. `views/PlayerView.tsx` reads its track/session/playback state from
`useCatalogContext`/`useSessionContext`/`usePlaybackContext` (plus navigation, UI
feedback, and the release-form draft), so `ListenerShell` renders it with just the
two room-modal triggers whose open state it owns (down from ~30 props to 2).
`views/artist/ArtistConsole.tsx` and `views/artist/ArtistOnboarding.tsx` do the
same: the console reads context and owns the upload handlers + studio derivations,
distributing to its presentational studio tabs (OverviewTab, NewReleaseTab, ...)
which keep their prop interfaces. As a result `ArtistShell` collapses to the two
portal-gated effects plus a prop-free `<ArtistConsole /> | <ArtistOnboarding />`
switch (~34 lines).

Remaining follow-up, intentionally deferred: split `PlaybackProvider` into a
separate fast-ticking transport context. That is an optimization to make only if
profiling shows the transport updates re-render the tree wastefully. The studio
tabs beneath `ArtistConsole` remain presentational (fed by the console), which is
appropriate component composition rather than shell-level prop drilling.

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
- Frontend e2e coverage exists for the Classic locked/access/payment, artist
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
