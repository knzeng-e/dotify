# Deployment Configuration Runbook

This runbook is the operator checklist for Dotify's hosted configuration across
Netlify, Product DevNet, and Fly.io. Use it when changing dashboard values, deploy contexts,
`*.toml` settings, hosted origins, secrets, catalog persistence, or production
smoke settings.

## Maintenance Rule

Every PR that changes deployment configuration must check this file.

Update this runbook, or state why no update is needed, when a change:

- adds, removes, renames, or changes the meaning of an environment variable;
- changes `netlify.toml`, `services/api/fly.toml`, `web/fly.signal.toml`, or any
  `.env.example` file;
- changes a public app URL, CORS origin, gateway, RPC endpoint, contract
  address, deploy context, storage mount, scaling setting, or health check;
- moves a value between frontend, backend, signaling, or contract deployment
  responsibility;
- changes the production safety guard, catalog read model, upload path, content
  key boundary, or room-signaling behavior.

Keep this document aligned with
`docs/reference/environment-variables.md`, `web/README.md`, the relevant
`docs/backlog/XX-*.md` ticket, and the hosted dashboard state.

## Playback synchronization verification

The [room clock fix](../explanation/room-playback-synchronization.md) changes
signaling behavior without new configuration or storage. Release the signaling
server and ordinary/Product frontend builds together for fresh late-join
snapshots and pause silencing; refresh host and guest clients. Rollback uses the
previous builds and requires no migration.

After release, join halfway through a track from a second device, seek in both
directions, and repeat pause/resume while comparing the two progress indicators.
Confirm silence during pause and continued sound after resume. Test foreground,
background, and relay-only paths: a missing playing update for 2.5 seconds now
silences guest output and shows "Syncing with host" until fresh state arrives.
A late join must show the same interrupted state, not "Host paused". Also seek
while paused with a busy signaling transport: the forced command must arrive
after the transport drains, without requiring playback to resume.
Record device/browser and drift; local Chromium coverage does not establish
physical-device acoustic synchronization.

Product candidate `[0, 1, 29]` adds local host-output gating, paused track
switching, source retirement, and mobile room color parity. These fixes need
only updated ordinary/Product frontend bundles; no additional signaling, API,
CDM, or contract deployment is needed. After publishing, reopen Dotify in the
mobile host, play A, pause, choose B, and confirm silence until Play starts B.
Repeat Previous/Next, background/foreground, and the same sequence with a room
guest. Compare the same room and track on desktop/mobile. Record the actual
build SHA, CID, Product/OS/device versions and results; automated WebKit tests
do not certify the physical host. Rollback republishes the prior frontend.

## Hosted Surfaces

| Surface          | Host                                  | App/project         | Source config                                                  | Purpose                                           |
| ---------------- | ------------------------------------- | ------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Frontend         | Netlify                               | `muzinga`           | `netlify.toml`                                                 | Static Vite web app                               |
| Product frontend | Bulletin + DotNS                      | `dotify-test01.dot` | `web/.env.product-devnet`, `web/polkadot-app-deploy.config.ts` | Product-host static app                           |
| Backend API      | Fly.io                                | `dotify-api`        | `services/api/fly.toml`                                        | Uploads, key delivery, catalog read model, health |
| Signaling        | Fly.io                                | `dotify-signal`     | `web/fly.signal.toml`                                          | Socket.IO room discovery and WebRTC signaling     |
| TURN relay       | Managed provider or self-hosted relay | TBD                 | Backend `TURN_*` env                                           | WebRTC media relay for restrictive networks       |

Production URLs currently assumed by the app and docs:

```txt
Standalone:          https://muzinga.netlify.app
Product public URL:  https://dotify-test01.dev-dot.li
Product Host origin: https://dotify-test01.app.dev-dot.li
Product Host dot.li: https://dotify-test01.app.dot.li
Product mobile origin: https://dotify-test01.dot
Product mobile native: polkadot://dotify-test01.dot
Backend API:         https://dotify-api.fly.dev
Signaling:           https://dotify-signal.fly.dev
Product IPFS:        https://devnet-ipfs.api.polkadotcommunity.foundation
Track asset IPFS:    https://gateway.pinata.cloud, https://ipfs.io, https://dweb.link
Asset Hub RPC:       https://eth-rpc-testnet.polkadot.io/
```

Use the exact current frontend origins for CORS and signaling values. Do not
include a trailing slash. The Product URL visible in the browser remains
`dotify-test01.dev-dot.li`, but the Host executes the Product inside an HTTPS
iframe whose requests carry `Origin: https://dotify-test01.app.dev-dot.li`.
Product host requests have also been observed from
`Origin: https://dotify-test01.app.dot.li`, and Product mobile host webviews can
carry `Origin: https://dotify-test01.dot` or
`Origin: polkadot://dotify-test01.dot`. Allow all observed exact Product
origins; keep `VITE_PUBLIC_APP_URL` on the public URL so shared room links do
not expose the internal execution origin.

## Security Boundary

The frontend is a public Vite bundle. Any `VITE_*` value can be read by users.

Set only browser-safe values in Netlify. Never set these in Netlify production
or deploy-preview contexts:

```txt
VITE_PINATA_JWT
VITE_CONTENT_SECRET
```

Keep production upload and key material server-side on Fly:

```txt
PINATA_JWT
CONTENT_KEY_MASTER_SECRET
CONTENT_KEY_MASTER_SECRETS
CONTENT_KEY_ACTIVE_VERSION
```

`CONTENT_KEY_MASTER_SECRET` is the compatibility secret for existing v1/v2 key
derivation. `CONTENT_KEY_MASTER_SECRETS` is the optional retained version map,
and `CONTENT_KEY_ACTIVE_VERSION` selects which version encrypts new backend
uploads. Do not remove an old version until every release encrypted with it has
been re-encrypted and republished; the API fails closed instead of guessing a
different secret.

## Netlify Frontend

Dashboard:

```txt
https://app.netlify.com/projects/muzinga/overview
```

Open the project, then use `Project configuration` -> `Environment variables`.
Netlify environment changes require a new build and deploy before the Vite app
uses them.

Build settings for the repo-root Netlify site:

| Setting           | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Base directory    | `web`                                                                 |
| Build command     | `npm run build`                                                       |
| Publish directory | `web/dist` in the UI, equivalent to `dist` relative to `base = "web"` |
| Node version      | `22`                                                                  |

Required production variables:

| Key                       | Value                                                                                                                            | Notes                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `VITE_DOTIFY_DEPLOYMENT`  | `production`                                                                                                                     | Enables fail-closed production env validation.                   |
| `VITE_DOTIFY_HOST_MODE`   | `off`                                                                                                                            | Prevents the standalone build from probing Product host APIs.    |
| `VITE_SIGNAL_URL`         | `https://dotify-signal.fly.dev`                                                                                                  | Public Socket.IO signaling origin.                               |
| `VITE_DOTIFY_API_URL`     | `https://dotify-api.fly.dev`                                                                                                     | Backend API for uploads, key delivery, and cached catalog reads. |
| `VITE_PINATA_GATEWAY`     | `https://gateway.pinata.cloud`                                                                                                   | Primary browser read gateway for Pinata-backed track assets.     |
| `VITE_IPFS_READ_GATEWAYS` | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation,https://bulletin-kubo.tservices.es:9443` | Ordered fallback gateway list.                                   |

Optional production variables:

| Key                            | When to set                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_DEBUG_PANEL=true` | Temporary operator smoke checks plus first-sound, Product CDM, and room evidence exports under `You -> Production readiness`; unset for ordinary listener deployments. |
| `VITE_TURN_URL`                | Browser-visible TURN fallback for DevNet/static credentials. Prefer API grants for production. Accepts comma-separated `turn:` / `turns:` URLs.    |
| `VITE_TURN_USERNAME`           | Static fallback only. Do not use long-lived production credentials here.                                                                           |
| `VITE_TURN_CREDENTIAL`         | Static fallback only. Do not use long-lived production credentials here.                                                                           |
| `VITE_ETH_RPC_URL`             | Override the default Paseo Asset Hub EVM RPC. Must be HTTPS in production.                                                                         |
| `VITE_WS_URL`                  | Override the default Polkadot WebSocket RPC. Must be WSS in production.                                                                            |
| `VITE_BULLETIN_WS_URL`         | Override the default Product DevNet Bulletin RPC. Must be WSS in production.                                                                       |
| `VITE_BLOCKSCOUT_BASE_URL`     | Override explorer links. Must be HTTPS in production.                                                                                              |

Deploy-preview note:

Netlify deploy previews usually have their own origin. The signaling service
and backend both allow multiple exact origins with `SIGNAL_ORIGINS` and
`API_ORIGINS`. Add only the specific preview origin needed for evidence, then
remove it after validation. Never use `*` on the backend.

## Product DevNet Frontend

The browser-safe Product build profile is tracked in
`web/.env.product-devnet`. The manifest is
`web/polkadot-app-deploy.config.ts`.

Required Product values:

| Key                             | Current value                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_DEPLOYMENT`        | `production`                                                                                                                     |
| `VITE_DOTIFY_HOST_MODE`         | `required`                                                                                                                       |
| `VITE_DOTIFY_PRODUCT_ID`        | `dotify-test01.dot`                                                                                                              |
| `VITE_PUBLIC_APP_URL`           | `https://dotify-test01.dev-dot.li`                                                                                               |
| `VITE_DOTIFY_API_URL`           | `https://dotify-api.fly.dev`                                                                                                     |
| `VITE_SIGNAL_URL`               | `https://dotify-signal.fly.dev`                                                                                                  |
| `VITE_DOTIFY_ROOM_BEACONS`      | `off`                                                                                                                            |
| `VITE_DOTIFY_ROOM_REALTIME`     | `off`; `observe` or `dual` only for an authorized Product measurement candidate                                                     |
| `VITE_BULLETIN_WS_URL`          | `wss://bulletin-paseo.tservices.es:8443`                                                                                         |
| `VITE_PINATA_GATEWAY`           | `https://gateway.pinata.cloud`                                                                                                   |
| `VITE_IPFS_READ_GATEWAYS`       | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation,https://bulletin-kubo.tservices.es:9443` |
| Product executable `appVersion` | `[0, 1, 43]` in `web/polkadot-app-deploy.config.ts`                                                                              |

The Product executable version is part of the published Product manifest. Bump
it whenever the Product bundle changes runtime behavior, host SDK integration,
permissions, metadata, or cache-sensitive assets. A new CID alone proves the
bundle changed on-chain, but the mobile host can still use executable metadata
when deciding whether to refresh a previously opened app.

Version `[0, 1, 43]` published the merged playback-continuity, scoped room-tip,
UX clarity and reusable listening-session changes on 2026-10-09 from clean
candidate `c394c2354b128f5bb71cc039142835450ae210f6`, based on tested `dev`
merge `3183de87d4ab90b74e889fae4c317c2b1dc97d2d`. This was a frontend-only
release; the API and signaling services were not redeployed. The executable CID
is `bafybeid6izin3sjhmeb7yrslf4snerngjmt4ttt5tsysazf7vju5h3gpkq`.
Bulletin finalized the stable upload at block `1147924` in transaction
`0x32d6f14c8fa24828341f2a4dac829a50cfb5270c4b30d0373934c823d58c132c`
and the full-CAR root at block `1147928` in transaction
`0x25a17aaaf896cd9a1f788ca4f7bdc6ace64582d3a3d094fde83e2cad906fc4db`.
Content linking finalized at Asset Hub block `14227528` in transaction
`0x0842921760de6896a1475ac90e914e3a4b807428949a1e48f18959e4eb29a56a`;
the atomic executable manifest update finalized in transaction
`0xadecfa8c78dbb042f6605588097b676523652bef83304947d5273af0290c2276`.

All 14 content nodes reached GRANDPA finality, the deployer's P2P retrieval
passed, and a separate public gateway read returned a 5,766,617-byte CAR. That
CAR contains the exact local `index.html` bytes and the full candidate source
SHA. The pre- and post-publication Product Remote Config checks matched the
pinned registry and resolver. An initial preflight stopped before upload because
the shared Bulletin pool authorization had expired; after the operator renewed
pool account `5DDa6Wx3AV7UNCF7rf7dvHuU29Q6scojoQMohpMnCUiQN7BJ`, the clean
candidate published successfully. Installed-host cache refresh, prompt counts
over real protected tracks, long-session audio continuity and host/guest room
behavior remain physical-device acceptance work.

Version `[0, 1, 42]` published the merged room-tip metadata recovery on
2026-10-07 from clean candidate
`42661dafe9740e19d46121e7de5f29c481904380`, based on tested `dev` merge
`ac9f05c75609113c3734d98ffde1b1629d894fd2`. This was a frontend-only release:
the API remains on its verified 0.1.41 candidate and its persistent contribution
ledger was not redeployed. The executable CID is
`bafybeie672slb6kaqlo7hydj3tvqdynvzkge2eg2kmy4q7wsess52wg3uq`; content linking
finalized at block `14155468` in transaction
`0x118f540e550821486f89e0f008e47900d065b6394cec2ceeeaba9aab8a977af3`, and the
atomic executable manifest update finalized in transaction
`0xbe0b46e2b8343f1f1d37dfb1448a109bacc809a8a3b625db667b3445837b897a`.
Independent read-back at 2026-10-07 22:59 Europe/Paris confirmed finalized
version `[0, 1, 42]` and matched the public CAR's `index.html` and entry bundle
to the local build, including the candidate source SHA. All 25 content nodes
reached GRANDPA finality and P2P retrieval passed. The Bulletin pool allowance
was reported as exhausted, so uploads ran in best-effort queue mode; inclusion,
content integrity, root finality and read-back all completed. Installed-host
cache refresh and a physical host/guest room-tip check remain separate live
acceptance evidence.

Version `[0, 1, 39]` moves historical native gift/tip receipt reads to the
Dotify API. The installed Product host SDK bridge accepts `chainHead_v1_*`,
`chainSpec_v1_*` and `transaction_v1_*`, but rejects the legacy historical RPC
methods used by the 0.1.38 reader. A direct archive test therefore did not prove
that reader usable inside the mobile host. The API now supplies
`POST /api/contributions/native-receipt` using a server-configured native archive
URL; the frontend uses the existing `VITE_DOTIFY_API_URL`. Writes still use the
Product signer, while receipt checks never create a signer.

The API pins the Paseo Asset Hub genesis, loads metadata at the requested block,
and verifies the canonical finalized block, exact Blake2-256 extrinsic hash,
phase-specific System dispatch outcome and `Revive.ContractEmitted` records.
The frontend binds the response to the expected network, transaction and block,
then checks runtime, work, intent ID, payer and amount. Archive errors keep the
journal pending; only a verified native dispatch failure may release it.
Technical details now show the latest check error alongside the original error.

Version `[0, 1, 39]` was published on 2026-10-06 from clean commit
`c698b1c7b9b83e813c68fb902de62696b67e25a6` with the `product-cdm` profile,
after deploying the API from that same commit. The public API `/version`,
`/health`, configured Product HTTPS CORS preflight and a known historical native
receipt were checked successfully. The published receipt logs matched the
independently verified historical native events, including the paid-share event.
The executable CID is
`bafybeiglfaqtudp27j3hwqv3qvgelknfrbt7melueuic4tqh7wrogvqlia`; its atomic
manifest update finalized in transaction
`0x463499d3e54d7046129ced609b1d6ad64a04e0e0bca38734d358236f7b871f0a`.
Read-back at 2026-10-06 23:08 Europe/Paris confirmed `[0, 1, 39]`, its CID and
the public CAR's index/entry bytes against the built artifact, including the
source SHA. Host configuration checks passed before and after publication.
Validation passed: 785 frontend unit tests, 160 API tests and 22 gift/tip browser
tests, including real HTTP-client recovery and archive-error display without
resubmission. Type checks, the Product build and lint passed; lint excluded
ignored local diagnostic archives and reported two pre-existing App hook
warnings. Recovery inside the installed mobile host still requires live-device
confirmation; no new funded tip was submitted during this investigation.

Version `[0, 1, 38]` introduced block-reference capture and manual recovery for
older journal entries, after native `Revive.call` events were found absent from
the EVM log index. Those journal and proof invariants remain, but its historical
host RPC transport is superseded by the API transport above.

Journal entries with a native hash but no usable SDK block reference can enter
the block number from `View transaction` under Technical details → `Receipt block
number` → `Check receipt block`. This is a locator, never trusted payment proof:
wrong blocks, wrong extrinsics, changed block hashes, missing dispatch outcomes
and mismatched receipts keep the intent pending. Proven finalized native dispatch
failures can release it. Entries lacking a native hash remain unresolved; do not
resubmit based on an absent Ethereum event. A valid finalized transaction hash
is preserved even when optional SDK block metadata is absent or malformed;
the receipt then remains pending until a verified block locator is supplied.
This PR #242 review fix requires a later frontend publication and is not included
in the previously published 0.1.39 artifact. New payments capture usable block
references automatically. Full cross-device native earnings/history indexing is
still separate work. Version `[0, 1, 38]` was published on 2026-10-06 from clean
commit `99d51aa42f9ac9acef93780773e9953e8474a492` with the `product-cdm` profile. Its executable CID
is `bafybeihydvxrlzv2d4kpnjrellwntsvt5ifo2fkfh7frlvq3ngrobxltwi`; the atomic executable update finalized in transaction
`0xae364b1b290b8815fc0771014cbb912080f79e20b5571b3927bb588c2cee2ea7`. Independent read-back at 2026-10-06 21:51 Europe/Paris confirmed
the finalized version/CID and compared the public CAR's index/entry bundle with
the built artifact, including its source SHA. Host configuration checks passed
before and after publication. Mobile replay and a new funded mobile submission
still need live-device evidence; the historical native receipt itself was
verified directly on-chain.

During diagnosis on 2026-10-06, an owner-supplied pending tip was independently
verified directly from historical Asset Hub native storage, with matching
contribution and paid-share events. The corrected reader was then run on that
same historical block and recovered the matching receipt. Explorer data was
used only to locate the block; the native chain verified its hash, extrinsic and
dispatch. User-specific references, amounts and raw proofs remain in ignored
local diagnostic artifacts. This receipt check does not establish full native
ledger indexing or receipt-verified room-chat broadcasts; the signaling verifier
still needs a native-event receipt path for those broadcasts.

Version `[0, 1, 37]` packages the bounded pending-contribution reconciliation
merged in PR #239, which did not increment the executable version. During the
subsequent timeout investigation, an installed Product Desktop session reported
`[0, 1, 36]` / build `9c2a476`, predating that fix. This observation does not
establish which build is loaded on mobile or why its payment timed out.

After an authorized CDM-profile deployment, check the loaded executable version
**and build SHA** under You → Production readiness on each device. A merge to
`dev`, a successful build, or an updated manifest is not proof that the host
loaded the new bundle. Preserve local pending-contribution storage, reopen the
same gift/tip with the paying account, and use `Check status again` without
resubmitting. If it remains pending, record whether host approval appeared,
the Technical details error, loaded version/SHA, and any transaction reference
before diagnosing submission versus finalized-event read-back. Do not treat a
timeout or an absent event as proof of a failed payment.

Version `[0, 1, 37]` was owner-authorized and published on 2026-10-06 from clean
commit `1193a73951edaa6d132e07625fcb6a8e4010395c`, with the `product-cdm` writer
profile. The executable CID is
`bafybeiab765lpxm344uokugwsvghjypv4i4h3eobinrylougzpi3orci3a`. The atomic
executable contenthash/manifest update finalized in transaction
`0xfd81a340aa79ba1dfa5dd0f300e25c767477808153bc4524d2edf51f9f5f7a0a`.
Independent read-back at 2026-10-06 21:22 Europe/Paris verified the finalized
`app.dotify-test01.dot` version/CID and compared `index.html` and the entry JS
byte-for-byte with the built artifact inside the 14,576,359-byte CAR served by
the configured gateway. The entry identifies the same source SHA. The host
Remote Config preflight and post-publication check both passed. This proves
publication and artifact availability; installed mobile cache refresh and a
funded mobile tip still require live validation. Preserve the existing pending
intent and reopen it after checking the loaded SHA/version; do not submit a
second tip to diagnose the first.

A subsequent mobile report stayed on `Checking network finality` after approval,
with no accessible Technical details. That label exists in PR #239, so the
Desktop stale-build observation cannot explain the mobile report on its own.
The `[0, 1, 37]` candidate also preserves the first uncertainty error in the
existing local contribution journal and exposes it, together with the intent
reference, during pending checks. Empty event reads and later RPC failures no
longer erase that diagnostic. Without a wallet transaction reference the label
is `Checking payment status`; a finalized Product extrinsic awaiting its EVM
contract event is `Checking contribution receipt`. These labels do not establish
submission, failure, or settlement. This correction makes the unresolved host
failure diagnosable; it does not constitute funded mobile payment evidence.

Version `[0, 1, 36]` invalidates the Product host cache for finalized tip
read-back. It filters contribution logs by concrete indexed topics because the
DevNet EVM RPC rejects null topic placeholders; the matching intent must still
have a finalized on-chain event before Dotify reports success. Preserve any
pending contribution journal before clearing an older host cache.
Version `[0, 1, 34]` invalidates Product host caches for the verified room-tip
affordance introduced after `[0, 1, 33]`. Version `[0, 1, 33]` prepares the
artist earnings/workspace, native contributions, and Product CDM named-result
decoding correction. This is a package version, not evidence of deployment or
a real contribution. No existing Celerity or contribution activation default
changes with this correction.
Version `[0, 1, 32]` identifies the separately authorized W27 correction
candidate that retains observers after an uncertain publish and bounds later
private mirrors in a ten-second FIFO. Enable
`VITE_DOTIFY_ROOM_REALTIME=dual` and `VITE_DOTIFY_DEBUG_PANEL=true` only for
that measurement deployment; the tracked defaults remain off. This version is
not evidence of real Product delivery or approval of a transport migration.
Version `[0, 1, 31]` is the earlier mobile-panel candidate whose publish timeout
stopped the observer. Version `[0, 1, 30]` is the console-only W27 candidate; it
supports the observers and paired capture API but predates the mobile panel.
Version `[0, 1, 29]` fixes host pause/source ownership and restores the desktop
room palette on mobile. It retains `[0, 1, 28]` room-authorized TURN credential delivery and an
independent IPFS fallback for full encrypted-audio recovery. The version bump
gives Product hosts an explicit cache-refresh signal for these playback and
room reliability changes. It retains the `[0, 1, 27]` single-dialog Classic
support handoff and the `[0, 1, 26]` candidate-bound
first-sound evidence, independent exact-profile budgets, fresh warm-resume
attempts, and terminal autoplay failures, plus the `[0, 1, 25]` Product room
evidence capture and rejection of
hand-written room claims without current host transport telemetry, plus the
`[0, 1, 24]` bounded Web Worker for DAV2 AES-GCM chunk decryption and the
fail-closed main-thread Web Crypto path when a worker cannot start within 1.5
seconds. It also retains the `[0, 1, 23]` behavior that defers Product CDM chain
setup until an authoritative runtime read and uses the known DevNet PAS label
without an initial direct EVM
RPC lookup, so opening a shared room remains independent of Product Web's
current Host-protocol mismatch. It retains the `[0, 1, 22]` native extrinsic
proof links and the `[0, 1, 21]` Product CDM payment-unit fix by converting the
18-decimal Solidity amount into the connected chain's native `Revive.call`
Balance precision. It binds Product payment and room evidence to the same
deployed CID and carries the Product room guest audio recovery fix, the W05
royalty claim runtime writer path, the September 2026 Product DevNet
tooling/CDM registry refresh, the re-pinned Bulletin descriptor, and the viem
release-registration confirmation hardening for dropped or still-pending wallet
hashes, plus the W06 removal of passkey-only wallet routes from the public
Product and standalone account flows, W07 key-versioned protected audio refs,
and the W14 optional room galaxy renderer behind the 2D/list fallback. The 2D
renderer remains the default until supported-device performance evidence
justifies promoting 3D. The normal web and Product builds lazy-load the `three`
chunk on demand; the Bulletin single-file build inlines it.

Current Product host SDK dependencies:

| Package                                              | Current value | Latest checked 2026-09-12 |
| ---------------------------------------------------- | ------------- | ------------------------- |
| `@parity/product-sdk`                                | `0.27.0`      | `0.27.0`                  |
| `@parity/product-sdk-host`                           | `0.19.1`      | `0.19.1`                  |
| `@parity/product-sdk-statement-store`                | `0.6.9`       | `0.6.9`                   |
| `@parity/product-sdk-descriptors`                    | `0.11.0`      | `0.11.0`                  |
| `polkadot-api`                                       | `1.23.3`      | `3.0.0`                   |
| `@parity/polkadot-app-deploy`                        | `0.20.0`      | `0.20.0`                  |
| `engine.io-client`                                   | `6.6.6`       | `6.6.6`                   |

Keep the Product SDK packages pinned exactly during Product DevNet hardening.
Recheck npm and the official Product docs before changing them because the
mobile host API is still moving quickly. `polkadot-api` remains on `1.23.3` at
the Dotify root even though npm publishes `3.0.0`: Product SDK `0.27.0` brings
its own PAPI `2.2.x` tree, while `@polkadot-apps` chain-client/keys/signer still
depend on PAPI `1.23.x`. A direct root PAPI 3 trial failed type compatibility
for the `PolkadotSigner` export and `ChainDefinition` / `TypedApi` boundaries,
so PAPI 3 is tracked as a blocked compatibility migration rather than a
deployable dependency bump.

W27 adds `VITE_DOTIFY_ROOM_REALTIME`, default off. It requires a Product host
mode and observes aggregate room presence plus encrypted social mirrors;
Socket.IO remains authoritative. `dual` publishes presence from hosts and
server-accepted reactions, short chat and requests from Product participants.
It must not be enabled as a default
until two-client Product evidence is reviewed. Build an offline validation
artifact with `VITE_DOTIFY_ROOM_REALTIME=dual npm run build:product-devnet:frozen`;
this command does not publish it. Rollback is a build with the flag off. Stop
or reload active observation sessions; published presence expires after 30
seconds (private social mirrors: 10 seconds) and observer data is held in memory
only. The private path needs the updated signaling server for membership-bound
ephemeral public-key registration and revocation. No new server flag, production
secret, database or contract is required. Old clients ignore the new messages;
new clients on old servers time out only the private observer. A publish timeout
does not cancel a Host request already in flight; do not treat it as proof of no
publication or retry it. Corrected candidates keep the receive observer active
and process later distinct events from a bounded ten-second FIFO. Startup and
subscription failures still stop that observer.

For real Product captures, resolve Statement Submit permissions in a disposable
room first. Permission latency can exceed the eight-second publish deadline;
persistent access requires the owner's explicit consent and must not include
unrelated permissions. Follow the capture procedure rather than retrying an
uncertain publication. A full host-page reload loses its memory-only resume
token and may end the room; it is not equivalent to socket reconnection.

Public/private observers share local unexpired-write reservations and reserve
one full beacon only when the build enables beacons. Private pairwise fanout
may exhaust the budget; never enable automatic retries to compensate. It cannot preflight all users of a sponsored account,
other tabs or other applications; network rejection is an observed outcome.
See [W27 transport decisions](../explanation/room-realtime-transports.md) for
privacy, observation limits and the Product capture protocol.

The opt-in [paired capture procedure](../how-to/capture-celerity-room-realtime.md)
requires the new admitted-only `room:realtime-clock` event on signaling. It
calibrates with a random process clock ID, stores bounded in-memory fingerprints
and needs no secret or storage mount. Export is manual; the offline reporter
rejects incomplete exports or mismatched run/CID/SHA. A build or passing report
does not replace real Product/device acceptance. Do not enable the default or
remove Socket.IO based on a simulated run.

With `VITE_DOTIFY_DEBUG_PANEL=true`, the same recorder is available under
You > Production readiness > Celerity capture, including on mobile without
DevTools. The panel starts no capture or publication on mount. It exports only
on an explicit copy action, with selectable JSON when clipboard access fails;
no automatic upload or persistence is added. Both peers must use the 0.1.32
correction candidate for new acceptance runs. The earlier 0.1.31 candidate has
the panel but stops observation after a publish timeout; 0.1.30 lacks the panel.
A new local build is not a deployment or live acceptance result.

`VITE_DOTIFY_ROOM_BEACONS` is off in the tracked profile, so the standard
publication announces no rooms on the Statement Store. The capability ships
dormant on purpose: the reader is implemented, but the Product host
publish/discover/expiry round trip has no live evidence yet. Enabling also adds
about 24 KB to every publication, against a finite Bulletin quota.

To publish a build that does announce:

```bash
cd web
npm run deploy:product-devnet:beacons
```

Rolling back is a normal republication with the flag absent - the standard
`npm run deploy:product-devnet` produces the `off` build. Beacons already
published expire on their own within the statement TTL; there is no revocation
step, and none is needed.

`VITE_PINATA_JWT` and `VITE_CONTENT_SECRET` are explicitly empty in that
profile so a developer's generic local `.env` cannot leak demo credentials
into the Product bundle.

The Product IPFS gateway is the publication storage endpoint for the app bundle,
not the most reliable first read path for the public track assets Dotify
currently pins through Pinata. Keep `https://gateway.pinata.cloud` first, with
`ipfs.io` and `dweb.link` before Product storage gateways for artwork and
metadata fallback reads; otherwise cover images can hang in the browser without
firing an image error.

New API cover uploads require the `sharp` native dependency included in the API
image. The upload endpoint creates one public IPFS directory with
`cover/placeholder.webp`, 64/160/320/640 px WebP variants, and the untouched
`cover/original.<ext>`. The on-chain image ref points to `cover/640.webp`; the
web client derives the other paths for `srcset`. On the current 512 MB single
API machine, cover normalization is intentionally serialized process-wide; one
large source is decoded and attention-cropped into a 640 px canonical image,
then smaller variants are derived sequentially. Do not parallelize this stage
without load-testing the deployed memory limit. After changing the API image,
smoke both the primary and a thumbnail path before publishing a release:

```bash
curl -s -L -o /dev/null --max-time 12 \
  -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' \
  https://gateway.pinata.cloud/ipfs/<directory-cid>/cover/640.webp
curl -s -L -o /dev/null --max-time 12 \
  -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' \
  https://gateway.pinata.cloud/ipfs/<directory-cid>/cover/160.webp
```

Old single-file refs remain valid. Rolling the API/web code back does not
invalidate responsive refs because the 640 px path is itself a normal image
URL; older clients simply ignore the sibling variants.

Encrypted audio byte reads are stricter than image and metadata reads: the
browser fetch path requires CORS and range behavior that public gateways do not
provide consistently for Dotify's Pinata-pinned DAV2 files. The web app
therefore restricts DAV2 range reads and full-file recovery to Pinata gateways
(`gateway.pinata.cloud` or a configured `*.mypinata.cloud` gateway). Keep
generic `VITE_IPFS_READ_GATEWAYS` values for artwork/metadata fallback only.

The flat-CID Bulletin build uploads only `dist-bulletin/index.html`. Its DAV2
decrypt Worker is therefore compiled as an inline Blob Worker. The
`build:bulletin` artifact smoke fails if that HTML references an external
Worker or script asset; do not replace the inline path with a relative Worker
URL unless Bulletin publication also starts uploading the full asset tree.

The October 8 audio/session correction is a frontend-only change: no gateway,
secret, API schema, signaling protocol, or contract migration is required.
See [W08 continuity evidence](../backlog/implementation/evidence/W08-audio-continuity-2026-10-08.md).
After publishing a candidate, verify a failed segment resumes at the same time,
Pause survives recovery, A → B → A plays, and a valid protected session does not
prompt between tracks with persistent storage blocked. Record the exact build,
Host/browser, role, network profile, and failures. Chromium/WebKit synthetic
tests do not replace iPhone/Product or two-device room acceptance.

The session cache now includes API, chain and signing identity. The old
address-only cache cannot establish those boundaries, so an upgrade may require
one sign-in for protected playback. When storage is unavailable, the new token
lasts only for the current page lifetime (and never beyond its server expiry).
Free playback and room guests require no sign-in. Generic 503 responses stop
protected preparation without wallet prompts; the next attempt probes again.
Do not clear storage or ask the user to pay again to troubleshoot this state.
Rollback is the prior frontend artifact; existing ciphertext, purchases and
backend tokens remain compatible, though the older client may ask to sign in.

The Product build also embeds a non-secret `dotify-test01.dot` bootstrap catalog
snapshot. It prevents first-run mobile hosts from staying on `Loading registry
catalog` when the Fly catalog request hangs; the Fly API remains the source of
truth once reachable. `npm run build:product-devnet` refreshes
`web/src/services/productDevnetCatalogBootstrap.ts` from
`VITE_DOTIFY_API_URL` before building. Set shell-only `CATALOG_API_URL` only
when deliberately generating the snapshot from a different catalog API. The
default generator keeps the existing snapshot if the API is unavailable; use
`npm run generate:product-catalog-bootstrap:strict` before releases or after
contract address changes so a stale API fails visibly.

Release preparation and publication are deliberately separate. Refresh with
the strict generator, review and commit the generated snapshot, then build the
exact candidate with `npm run build:product-devnet:frozen`. The frozen command
does not contact the catalog API. Signer-free CI and `deploy:product-devnet`
both use it, preventing live catalog drift between the validated commit and the
locally signed publication.

Build and publication:

Before publication, `npm run verify:product-deploy-environment` checks the
pinned CLI API and `web/product-devnet-host.environments.json`, then fetches
Product Desktop's public Firebase Remote Config with the `environment=paseo`
signal. This is the Product channel corresponding to the CLI's `devnet` profile.
It compares the registry, resolver/content resolver and IPFS gateway. Missing
configuration, malformed replies, HTTP failures and timeouts all fail closed;
the operator must not bypass the check or automatically adopt changed addresses.

Configure `PRODUCT_HOST_FIREBASE_API_KEY` in the operator shell, or put
`{"apiKey":"<Product Firebase client API key>"}` in the ignored local file
`web/.product-host-check.local.json` (mode 600). Use the Firebase **client** key
from the Product distribution matching the pinned project/app/channel in
`web/scripts/product-host-config-check.mjs`, never a wallet seed, service-account
key or Product session token. This setting has no `VITE_` prefix and is not
included in the Dotify frontend. The checker creates a fresh anonymous client ID
in memory; it reads only public Remote Config and persists no Firebase identity.

The deploy wrapper checks again immediately before publication and after the
CLI publishes the content and manifest. A failed post-check means publication
may already have completed: inspect the printed CID and transaction receipts,
do not retry writes blindly. CLI read-back and matching Remote Config do **not**
prove that an installed Product host has refreshed its local cache. Record the
candidate SHA/version/CID, reload the host, and compare its Production readiness
build identity before accepting a release. Never use cache deletion as a
substitute for checking the registry/resolver first.

`.github/workflows/product-host-drift.yml` performs the same signer-free check
on relevant `dev` pushes, manual dispatch and daily at 06:23 UTC. Set repository
Actions secret `PRODUCT_HOST_FIREBASE_API_KEY` to the same client key. There is
no mnemonic, deployment or automatic configuration update in this workflow.
The scheduled workflow must exist on GitHub's default branch (`main`) to run;
merging it into `dev` alone enables the push check, **not** the daily schedule.
Action failures are the alert; configure GitHub Actions notifications for the
maintainer. A green check proves a fresh observation at that time, not perpetual
host compatibility or that Web/Mobile/Desktop all have the same active config.

When drift is detected, compare Product's current distribution and channel,
review registry/resolver ownership and domain state, then update the pinned
profile/override together in a tested PR. Repeat the live check and a real host
SHA/version observation. A changed client project or channel also requires
review of the source profile; never silently fall back to a different channel.

```bash
cd web
read -rs MNEMONIC
export MNEMONIC
npm run generate:product-catalog-bootstrap:strict
npm run build:product-devnet:frozen
npm run deploy:product-devnet
unset MNEMONIC
```

`deploy:product-devnet` requires `MNEMONIC` and passes it to
`polkadot-app-deploy` through the local child-process environment, without
placing the phrase in command arguments. It also passes
`--no-transfer-to-signedin-user`. This intentionally avoids the mobile
`pad login` session for DotNS updates. `pad whoami` reports the mobile Product
session, not the mnemonic-derived owner signer.

The manual GitHub Actions workflow `.github/workflows/deploy-frontend.yml`
validates an exact candidate SHA but cannot publish it. It receives no mnemonic
or signer and performs no Product write. Validation builds enable the Product
CDM adapter and operator readiness panel; release builds use the checked-in
viem profile. Both profiles consume the committed catalog snapshot through the
same frozen build used by local publication. DotNS publication remains a local
operator action from the same clean SHA.

Use
[`docs/operations/product-devnet-deployment.md`](product-devnet-deployment.md)
for authentication, publication, validation, and rollback.

## Fly Backend API

Dashboard:

```txt
https://fly.io/dashboard
```

Open app `dotify-api`.

Non-secret runtime values are tracked in `services/api/fly.toml`:

| Key                        | Current value                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_PORT`                 | `8790`                                                                                                                                                                                                                       |
| `NODE_ENV`                 | `production`                                                                                                                                                                                                                 |
| `API_ORIGINS`              | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |
| `PASEO_ASSET_HUB_NATIVE_RPC` | `https://asset-hub-paseo-rpc.n.dwellir.com` (HTTPS historical native receipts; no signing) |
| `PASEO_ASSET_HUB_RPC`      | `https://eth-rpc-testnet.polkadot.io/`                                                                                                                                                                                       |
| `DOTIFY_FACTORY_ADDRESS`   | `0x835a626a9a6965b197d079ae56b1ec94033c2699`                                                                                                                                                                                 |
| `DOTIFY_DIRECTORY_ADDRESS` | `0x4e883827d61e573094c7b777bae323070ea9f954`                                                                                                                                                                                 |
| `DOTIFY_CHAIN_ID`          | `420420417`                                                                                                                                                                                                                  |

<a id="shared-native-contribution-ledger-product-0140"></a>

### Shared native contribution ledger (Product 0.1.40–0.1.41)

Product 0.1.41 published the PR #242/#243 review follow-ups on 2026-10-07 from
candidate `30bd5912c0cb4f7e85c03e30657037a1eb0127a4`. The API and Product bundle use
that same candidate. The finalized executable CID is
`bafybeidv2yvrqemk6bacqq63ovnso4to3oce265uq5ysv35gcfkfla32ci`; independent
read-back matched the public CAR to the local build. The existing persistent
volume retained the known verified contribution across the API update, and a
managed pre-deploy snapshot has 14-day retention. Physical-device cache refresh
and dashboard confirmation remain separate acceptance checks.

The published 0.1.40 evidence below predates the review follow-ups and used the
60-request history limit.

Published on 2026-10-07 (Paris): Product source `0aef57670c71a60d46f67f7d5f62d008561afcb8`,
API source `48e3bda9af3ba26ec65b2f794ee96dd169956857`, executable CID
`bafybeia4lm3ybgkqod3majkgu52xvbpnmlrtpnogjjutkxtxhfqbroyjzu`. The finalized manifest and gateway bundle
were verified. A real API restart preserved the recovered contribution; a managed
volume snapshot completed with 14-day retention. Full rollout evidence and
remaining physical-device/historical coverage gates are recorded in
[the dashboard evidence](../backlog/implementation/evidence/artist-dashboard-2026-10-07.md).

`NATIVE_CONTRIBUTION_SNAPSHOT_PATH` is `/data/contributions/receipts.json` in
Fly and defaults to `.data/native-contributions.json` locally. The `contribution_data`
volume mounts at `/data/contributions`. Keep exactly one API machine/writer;
independent volume replicas would diverge. Use `--ha=false` on deploy and do not
add a spare API machine until there is a shared transactional store. Other
catalog/key storage and CORS settings are unchanged.

The verified receipt route saves successful contribution events before replying.
It rejects incomplete recipient totals, wrong networks and conflicting blocks.
Repeated verification is idempotent. Atomic replacement publishes the new
snapshot only after saving succeeds; corrupt or unwritable storage returns an
explicit error rather than an empty history. Limits: 10,000 receipts / 64 MiB,
no silent eviction, 100 receipts/page, 100 runtimes/query, and 600 history
queries/minute/IP. This permits four full 100-page scheduled refreshes and two
full manual refreshes within one minute from an IP while preserving an abuse
bound. Catalog runtime lists are deduplicated and split into batches of at most
100; every page and batch binds to the same snapshot revision. The browser uses
one 25-second total budget for the whole refresh, and rejects partial results
if a later batch fails or the revision changes. Outstanding contribution
claims are reconciled against finalized contract state.

`POST /api/contributions/history` accepts `{ runtimes, offset?, revision? }`
and returns verified native receipts with `coverage: verified-receipts`. It is
public, like the underlying events, and never accepts submitted logs. It is not
an exhaustive native chain indexer. Earlier receipts can be recovered by calling
the existing native-receipt endpoint with their transaction hash/block, which
re-verifies before saving; do not edit the ledger to add a payment.

Before publishing this frontend, provision its volume in the API machine's
region, configure the mount, and deploy the API first. Preserve any existing
unrelated volumes. Follow [Fly's volume attachment procedure](https://docs.fly.io/launch/volume-storage).
Verify a known receipt through the public endpoint, read it through history from
a separate client, restart the API process, and confirm the same record remains.
Enable automatic volume snapshots and retain an independent export of the ledger
before migration or rollback. A rollback must retain the volume; never replace
a saved history with an empty file. This bounded read model has no replication
or zero-downtime failover claim.

Native receipts use a separate read-only archive boundary. The endpoint accepts
only a 32-byte transaction hash and a block reference, never a caller-selected
RPC URL. It verifies chain ID `420420417` and genesis
`0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2`.
The endpoint is limited to 20 requests/minute/IP, four concurrent archive reads,
a 20-second total read budget and 8 MiB per RPC response. It retains at most
128 immutable verified receipts for 30 minutes and two historical metadata
codecs in process memory. The verifier itself has no durable cache; verified
contributions are persisted by the ledger described above. Missing configuration,
wrong genesis, an unavailable archive or an unverified proof returns an explicit
error with a request ID, never a failed-payment verdict. The browser read budget
is 25 seconds. CORS origins, secrets and content-key authorization are unchanged;
the contribution ledger adds the persistent mount and single-writer requirement
described above.

Deploy the API before the Product executable that depends on this endpoint:

```bash
cd services/api
flyctl deploy --ha=false --env GIT_COMMIT_SHA="$(git rev-parse HEAD)"
```

Verify `/health`, `/version`, a known finalized native receipt and preflight
CORS for the configured Product HTTPS origins. Then publish the `product-cdm`
frontend and verify its finalized manifest, public CAR and embedded source SHA.
Keep the device's pending journal and paying account when testing recovery.
Live mobile host execution remains a separate acceptance check.

Do not store `API_ORIGINS` as a Fly secret. Fly secrets override `[env]` values
from `fly.toml`, so a stale secret can keep CORS broken after a clean deploy.
Audit before origin changes:

```bash
cd services/api
flyctl secrets list
flyctl secrets unset API_ORIGINS
flyctl deploy
```

Set server-side values in the app's Secrets area:

| Secret                      | Required                      | Notes                                                                                                                                                      |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PINATA_JWT`                | Uploads                       | Backend-only Pinata token. Never expose in Netlify.                                                                                                        |
| `CONTENT_KEY_MASTER_SECRET` | Audio upload and key delivery | 64+ hex chars, at least 32 random bytes. Compatibility source for v1/v2 when the explicit version map omits them. Never expose or rely on Fly as a backup. |
| `CONTENT_KEY_MASTER_SECRETS` | Key rotation                 | Optional JSON object from `dotify-content-key-vN` to 64+ hex chars. Keep every retained version needed by existing releases.                               |
| `CONTENT_KEY_ACTIVE_VERSION` | New encrypted uploads        | Optional active version for new backend uploads. Default is `dotify-content-key-v2`; change only after backing up and configuring the matching secret.       |
| `GIT_COMMIT_SHA`            | Optional                      | Set by CI/build automation when available; `/version` can fall back in dev checkouts.                                                                      |
| `TURN_REST_SECRET`          | Reliable rooms                | Backend-only HMAC secret shared with the TURN relay REST auth mechanism. Preferred production path.                                                        |
| `TURN_CAPABILITY_SECRET`    | Reliable rooms                | 32+ character secret shared only with signaling; verifies that TURN grant callers are current room participants. Keep distinct from `TURN_REST_SECRET`.     |
| `TURN_USERNAME`             | Optional fallback             | Static DevNet TURN username when REST auth is unavailable.                                                                                                 |
| `TURN_CREDENTIAL`           | Optional fallback             | Static DevNet TURN password when REST auth is unavailable.                                                                                                 |

Content-key rotation procedure:

1. Export the current key material from the operator's secret manager, not from
   Fly. Fly secrets are write-only from the app operator perspective.
2. Create a new 32-byte hex secret locally with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Build a retained JSON map containing every version that still has published
   ciphertext, for example v1, v2, and a new v3. Store that JSON in the secret
   manager before deploying.
4. Set `CONTENT_KEY_MASTER_SECRETS` and `CONTENT_KEY_ACTIVE_VERSION` on Fly,
   then deploy the API. Existing v1/v2 releases should still decrypt; new
   uploads should return an audio ref shaped like
   `dotify:enc:v2:key-v3:ipfs://<CID>`.
5. Run `npm --prefix services/api run key-custody:rehearse` locally. The script
   uses synthetic secrets and writes only a synthetic backup under `/tmp`; it is
   a rehearsal of the operator process, not a production export.
6. Smoke one existing protected release and one newly uploaded release through
   the deployed API before depending on the rotation for the pilot catalog.

Changing the active version cannot revoke keys already delivered to browsers or
room hosts. If a secret is compromised, plan a re-encryption and release-update
operation for affected tracks; config rotation alone is not a revocation tool.

Catalog read-model variables:

| Key                             | Default              | When to override                                                                                                             |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CATALOG_SNAPSHOT_PATH`         | `.data/catalog.json` | Not required to boot. Set to a durable Fly volume path, such as `/data/catalog.json`, for production-grade catalog evidence. |
| `CATALOG_POLL_INTERVAL_MS`      | `10000`              | Change only when deliberately tuning chain polling.                                                                          |
| `CATALOG_RECONCILE_INTERVAL_MS` | `300000`             | Change only when deliberately tuning full reconciliation.                                                                    |
| `CATALOG_STALE_AFTER_MS`        | `60000`              | Change only with an updated freshness expectation.                                                                           |
| `CATALOG_CONFIRMATIONS`         | `2`                  | Change only with an explicit reorg/finality tradeoff.                                                                        |

`CATALOG_SNAPSHOT_PATH` is optional because the API creates the default
`.data/catalog.json` path automatically. On Fly, that default is not durable
across deploys or machine replacement. Use it for PR previews if no volume
exists, but document that limitation in PR evidence.

For production-grade catalog evidence:

- mount a Fly volume at a path such as `/data`;
- set `CATALOG_SNAPSHOT_PATH=/data/catalog.json`;
- keep the API single-writer until the JSON snapshot is replaced by a shared
  transactional store;
- keep only one active API machine writing the catalog snapshot;
- keep at least one machine warm while measuring catalog p75 performance, then
  record whether the trace was warm or cold.

Artist upload and session-boundary variables:

Session-only frontend releases require `/api/auth/session` GET and POST plus
token-based key requests. Verify session auth and `CONTENT_KEY_MASTER_SECRET`
before rollout; older APIs without sessions now fail closed for protected
listening. There is no per-track signing fallback. Established tokens survive
network/503 failures; typed expiry/revocation/process-restart renews once.
An interrupted exchange after approval requires explicit sign-in or account
disconnect/reconnect. HTTP requests time out after 15 seconds. This does not
change the 24-hour TTL or the API's process-epoch invalidation on restart, and
adds no new environment setting. Free tracks and room guests stay walletless.

The W29 frontend bounds session capability, nonce, session exchange, key and
logout HTTP requests to 15 seconds each. A capability timeout fails without a
wallet signature and can be retried; wallet approval itself is not interrupted
by that HTTP budget. Failed startup key requests retry twice (900 ms and
2,200 ms delays), then expose a recovery action in the player. Operators should
check API/RPC health when that state persists. No new environment setting is
required; validate the purposeful connect/sign-in flow in the deployed browser
and Product host after publishing the frontend.

| Key                                 | Default      | Meaning                                                                    |
| ----------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `UPLOAD_AUTH_TTL_SECONDS`           | `300`        | Lifetime of a one-use capability for one audio, cover, or metadata upload. |
| `UPLOAD_QUOTA_WINDOW_SECONDS`       | `3600`       | Rolling window for completed upload bytes.                                 |
| `UPLOAD_PRINCIPAL_BYTES_PER_WINDOW` | `209715200`  | Reserved plus completed bytes allowed per artist address.                  |
| `UPLOAD_GLOBAL_BYTES_PER_WINDOW`    | `2147483648` | Reserved plus completed bytes allowed across the API.                      |
| `UPLOAD_PRINCIPAL_CONCURRENCY`      | `2`          | Outstanding upload grants allowed for one artist address.                  |
| `UPLOAD_GLOBAL_CONCURRENCY`         | `8`          | Outstanding upload grants allowed across the API process.                  |

Production uploads require this sequence: signed EIP-191 or Product sr25519
session, on-chain `ArtistDirectory.runtimeOf(requester)` verification, a
short-lived capability bound to asset purpose and byte budget, then byte-level
media validation before Pinata receives anything. Cover bytes additionally
pass a bounded server-side decode before any variant is pinned; decode failure
releases the upload lease and returns a plain invalid-media error. Free key
delivery and room guest entry remain unauthenticated.

Quota reservations, completed-byte counters, revoked session JTIs, and upload
capabilities are process-local. `services/api/fly.toml` therefore enforces
`max_machines_running = 1`; do not scale the API horizontally until those
records use one shared transactional store. A restart clears quota counters and
changes the process epoch, which invalidates every earlier session and upload
capability. This is the deliberate durable logout policy: an old token cannot
become valid again after restart, but all still-connected users must sign in
again. If chain RPC is unavailable, artist verification and capability issuance
fail closed. If Pinata fails or the client interrupts the request, the reserved
quota and concurrency lease are released.

When `DOTIFY_FACTORY_ADDRESS` or `DOTIFY_DIRECTORY_ADDRESS` changes, clear the
old catalog snapshot or force a reindex before using the public API as release
evidence. A clean redeploy to the September 2026 factory
`0x835a626a9a6965b197d079ae56b1ec94033c2699` and directory
`0x4e883827d61e573094c7b777bae323070ea9f954` starts with zero registered
artists and zero releases. If `GET /api/catalog` still returns runtime
`0x84D5062F2195758E42100845151c3f80BfAA5482` or blocks near `11269xxx`, the
hosted API is still serving the previous environment.

W05 changes the `MusicRoyaltiesPallet` ABI and appends claimable-recipient
storage under the existing namespaced Diamond storage slot. New factory
deployments install the claim selectors automatically. Existing artist runtimes
need a royalties facet cut that replaces `musicRoyPayAccess` and adds
`musicRoyClaimable(address)` plus `musicRoyClaim(address)` before native
Classic payments are enabled on that runtime. There is no new environment
variable for this behavior. Rollback before any W05 payment can reinstall the
previous royalties facet; rollback after W05 payments may have created
claimable balances must keep a claim-capable facet available until those
balances are settled or explicitly migrated.

TURN relay variables:

| Key                                 | Default | When to set                                                                                                                                                                   |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURN_URLS`                         | unset   | Set to comma-separated public relay URLs when deploying reliable room audio, for example `turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp`. |
| `TURN_REST_SECRET`                  | unset   | Preferred production credential path. Store as a Fly secret only.                                                                                                             |
| `TURN_CAPABILITY_SECRET`            | unset   | Required with TURN. Store as a Fly secret and set the same value as `SIGNAL_TURN_CAPABILITY_SECRET` on signaling. Keep it distinct from `TURN_REST_SECRET`.                      |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | unset   | Rotated DevNet/static fallback only when the relay cannot mint REST credentials. Store as Fly secrets.                                                                        |
| `TURN_TTL_SECONDS`                  | `3600`  | Adjust only with relay policy. REST credentials embed this expiry in the username.                                                                                            |

The API exposes `GET /api/turn/grant` for the frontend room code. The signaling
service first issues a two-minute room-membership capability to the connected
host or listener; the frontend sends it as a bearer token. The API verifies it
with `TURN_CAPABILITY_SECRET` before returning any relay credential. Missing,
expired, or forged proof fails closed. Without relay config the room client
falls back to STUN plus any browser-visible `VITE_TURN_*` values.

For production, prefer TURN REST credentials because the shared relay secret
stays on Fly. `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` are public bundle
values and should be limited to rotated DevNet/static tests.
The grant endpoint remains walletless so room guests can join from a link, but
it is no longer public: only a socket currently joined as host or listener can
obtain the short-lived proof. Keep API rate limits, relay quotas, and secret
rotation as additional boundaries.

On the 2026-09-28 DevNet W13 rollout, `TURN_CAPABILITY_SECRET` on `dotify-api`
and `SIGNAL_TURN_CAPABILITY_SECRET` on `dotify-signal` were installed as matching
Fly secrets without recording their values. The deployed API returns 401 for
an anonymous grant, 403 for a forged capability, and 200 for a current room
member's signal-issued capability. This checks authorization and grant wiring;
it does not prove that a physical WebRTC session used relay packets under
adverse NAT. See the [0.1.29 W13 live evidence](../backlog/implementation/evidence/W13-candidate-0-1-29-live-2026-09-28.md).

### Backend Signature Schemes

No Netlify or Fly dashboard variable enables Product signatures. The API
accepts two explicit schemes on session sign-in and protected key requests:

| Scheme               | Client                               | Required proof fields           | Backend binding                                                                                                              |
| -------------------- | ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `eip191`             | Standalone EVM wallet path           | `signature`                     | `viem.verifyMessage` against the requester H160                                                                              |
| `product-sr25519-v1` | Product-host app-scoped account path | `signature`, `productPublicKey` | sr25519 signature over the canonical Dotify message bytes, then Product public-key-to-H160 derivation matching the requester |

Unknown schemes fail at the API schema boundary. Product requests must still
pass the same nonce, chain, purpose, expiry, and `musicAccCanAccess` checks as
standalone requests. The Product frontend submits this proof shape only after
an explicit Product-host account connection.

`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` also routes runtime write submissions,
including Classic unlock payments, through the Product CDM contract adapter. The
tracked Product profile does not enable that flag yet. Keep `viem` as the
production default until Product-host transaction evidence proves account
mapping, fees/native value handling, and user approval for real writes. Product
CDM writes now fail closed unless the host signer public key maps to the same
pallet-revive H160 address that Dotify connected for key/session requests, and
Classic unlocks in a `product-cdm` build must poll `musicAccHasPaid` plus
`musicAccCanAccess` for that H160 before showing success. If the transaction is
included but verification fails, Dotify preserves the transaction hash in a
**Payment included, access not verified** error. Royalty claim writes use the
same adapter boundary through `musicRoyClaim(activeEvmAddress)`. Artist earnings
now use public EVM event history from `VITE_ETH_RPC_URL`, explicitly read-only
even in a Product CDM build. Its chain ID must match the configured network.
The endpoint must permit `eth_chainId`, `eth_getLogs`, `eth_getBlockByNumber`
and `eth_call`, and be allowed by Product Web-domain permissions. No secret or
new flag is needed. Visible-page polling runs every 15 seconds after completion;
failed/incomplete history retains the last complete reading or displays
Unavailable, never a fabricated zero. Recipient balances can be independently
unavailable. This scans known runtimes, not all historical collaborations or
direct gifts. Large histories may require a bounded indexer; there is no new
server, persistent index or finality guarantee in this patch. See
[royalty settlement](../explanation/royalty-settlement.md).

Before releasing, inspect Overview and Earnings in Product with an already-paid
artist account, compare per-work/gross/recipient amounts with existing receipts,
and verify unavailable/stale feedback without submitting a payment. Test the
gift recipient preview separately, stopping before signing. Rollback is the
previous reviewed bundle; no contract or data migration is involved. Enable
`VITE_DOTIFY_DEBUG_PANEL=true` only on that smoke build to export the safe
browser-side evidence bundle with `amountPlanck`, payment read-back, Product
sr25519 key/session outcomes, and the operator-marked host approval observation.
For W13, first bind the deployed candidate and open an already-paid Classic
track. A separate `access-readback` event captures current paid/playable access
without submitting another transaction. Backend-key evidence must follow a
read for the same account, network, runtime and content hash. Existing access
does not satisfy host approval, native transfer or transaction read-back gates.
No new configuration is needed. Capture remains bounded session storage;
reset it after use and keep account-linked diagnostic exports separate from
aggregate pilot evidence. See the Product deployment runbook for the sequence.
Validate Product protected playback through host smoke tests after each Product
publication before treating Product identity as production-ready for gated
listening.

### First-sound candidate evidence

Every ordinary Vite build now embeds its exact git SHA in
`VITE_DOTIFY_BUILD_SHA`, matching the Product build identity behavior. A smoke
build with `VITE_DOTIFY_DEBUG_PANEL=true` exposes **First-sound evidence** under
`You -> Production readiness`. Evidence builds fail when `git status` is dirty;
commit the exact candidate first so the embedded SHA identifies the bytes being
measured. Production builds derive this identity from the checked-out commit and
reject a mismatched `VITE_DOTIFY_BUILD_SHA`; that override is reserved for the
explicit Playwright readiness-panel dev server.

The bundle also embeds `VITE_DOTIFY_BUILD_CONFIG_DIGEST`, a SHA-256 digest of
the public `VITE_*` inputs used to build it. The digest excludes the build
identity variables themselves and never exposes input values. Standalone and
Product exports may have different digests because they are different build
families, but exports within each family must agree before the report can call
the candidate ready.

1. Bind the exact build. Add the deployment CID for Product Desktop or Product
   Web gateway samples.
2. Record and bind one test profile using only the provided coarse device, OS,
   browser, and connection categories. Product surfaces also require the
   numeric host version. Do not enter device names, account names, hostnames, or
   serial numbers; the UI and schema do not accept free-form profile fields.
3. Choose the listening flow, explicit cold or warm cache condition, and the
   scenario being exercised, then select **Start sample**. Use **Ordinary
   playback** for release-latency measurements; use the named controlled
   scenarios only while deliberately exercising their corresponding failure or
   recovery path.
4. Start the track. Dotify records the real selection/playback intent as the
   timing origin, including access, key, gateway, decrypt, and media startup.
   Press **I hear the music** at the first sound you actually hear. If playback
   fails, use the same action after Dotify shows the error; an automatic
   terminal failure is recorded without an audible confirmation.
5. Repeat cold and warm attempts, then download the candidate-bound JSON.

Schema v5 keeps first-sound duration, its `human-confirmed` or `automatic-error`
measurement method, the sanitized test profile, the declared scenario with its
fixed expected outcome, a bounded host terminal reason, and coarse DAV2 path
facts only. It
omits wallet addresses, listener identity, exact
location, audio refs/CIDs, gateway URLs, media source URLs, keys, signatures,
and per-listener history. Changing the SHA, public build-configuration digest,
Product app version, deployment CID, device profile, or network type starts a
new evidence set instead of mixing candidates or materially different test
conditions.
The report combines ordinary-web and Product exports when their git SHA
matches. Product samples must still carry one consistent Product app version
and deployed CID; those Product-only fields do not invalidate ordinary-web
exports where they are intentionally absent. A final key or gateway failure is
recorded even when no playable media source was created. Ordinary playback
alone supplies the surface-success, p75, and fallback-rate gates. Denied
protected access, broken-gateway recovery, slow-key recovery, interrupted
navigation, and corrupted DAV2 each have a separate gate against their declared
expected outcome, so an intentional controlled error cannot be mistaken for a
normal-playback regression. The label alone is insufficient: those gates also
require, respectively, an `access-denied` host reason, a successful failover to
a later DAV2 gateway, at least
1,000 ms before DAV2 key authorization, a `selection-interrupted` host reason,
or a DAV2 authentication failure.

Combine exports from physical surfaces and produce the release report with:

```bash
cd web
npm run smoke:first-sound -- \
  --evidence-json /path/to/chrome.json \
  --evidence-json /path/to/safari.json \
  --evidence-json /path/to/product-desktop.json \
  --expected-commit <40-character-candidate-sha> \
  --md-out /tmp/dotify-first-sound.md \
  --json-out /tmp/dotify-first-sound.json \
  --strict
```

The strict gate requires evidence for desktop Chrome, Firefox, Safari, iOS
Safari, Android Chrome, Product Desktop, and Product Web gateway, plus evidence
for every controlled scenario listed above. Every exact
device, OS, browser, connection, and Product-host profile supplied for a required
surface needs at least four successful samples in each cold/warm p75 flow cell;
exports with different profiles never pool their sample floor or latency budget.
Aggregate p75 remains visible but cannot compensate for a slow or undersampled
profile. The report prints every profile beside its surface. A blocked autoplay
attempt is recorded as a terminal error, and a later explicit Play starts a
fresh measurement. Reaching `canplay` only releases the loading affordance; the
attempt remains cancellable until `playing` or a terminal error. Asynchronous
play results are correlated to the concrete playback-attempt object that
initiated them. Each resolved source also receives a distinct host media-element
generation, so a delayed native error from a retired element cannot reach its
replacement, including when a URL is reused. Capture-stream reuse requires the
same media element as well as the same URL and a live track; a replacement
element is always recaptured and republished to room listeners. Repeat is a
declarative property of every generated host element, so a source replacement
cannot silently reset an enabled loop. Once every listener sender has moved to
the replacement stream, Dotify removes the retired element's volume listener,
disconnects its Web Audio nodes, stops its destination track, and closes its
AudioContext. A muted or zero-volume `playing` event is recorded as an error. An
unmuted `playing` event only proves that the media clock advanced; the operator
confirmation supplies the evidence that sound reached the actual output route.
The DAV2 fallback-rate target remains unproven until at least 100 DAV2 attempts
are present; fewer attempts are reported as `not-run`, never rounded into a claim.
Synthetic Chromium evidence validates the capture mechanism but does not count
as physical Safari, mobile, or Product-host evidence.

Closing a room tears down peers but retains ownership of the current real audio
capture while that track continues in solo playback. If the listener then
chooses another track, the replacement element retires the retained listener,
graph, destination track, and AudioContext even though no room is active. If the
host instead opens another room on the same element and source, Dotify restores
the ready state from the retained live capture without waiting for another
`loadedmetadata`, `play`, or `playing` event.

## Fly Signaling

Open app `dotify-signal`.

Non-secret runtime values are tracked in `web/fly.signal.toml`:

| Key                           | Current value                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIGNAL_PORT`                 | `8788`                                                                                                                                                                                                                       |
| `SIGNAL_HOST`                 | `0.0.0.0`                                                                                                                                                                                                                    |
| `SIGNAL_ROOM_TTL_MS`          | `21600000`                                                                                                                                                                                                                   |
| `SIGNAL_HOST_TIMEOUT_MS`      | `120000`                                                                                                                                                                                                                     |
| `SIGNAL_MAX_LISTENERS`        | `24`                                                                                                                                                                                                                         |
| `SIGNAL_TURN_CAPABILITY_TTL_MS` | `120000`                                                                                                                                                                                                                   |
| `SIGNAL_CONTRIBUTION_RPC_URL` | `https://eth-rpc-testnet.polkadot.io/`                                                                                                                                                                                       |
| `SIGNAL_CONTRIBUTION_CHAIN_ID` | `420420417`                                                                                                                                                                                                                 |
| `SIGNAL_CONTRIBUTION_DIRECTORY` | `0x4e883827d61e573094c7b777bae323070ea9f954`                                                                                                                                                                               |
| `SIGNAL_CONTRIBUTION_API_URL` | `https://dotify-api.fly.dev/api`                                                                                                                                                                                             |
| `SIGNAL_ALLOW_MISSING_ORIGIN` | `true`                                                                                                                                                                                                                       |
| `SIGNAL_ORIGINS`              | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |

The production origins are public configuration tracked in
`web/fly.signal.toml`; they are not secrets. Temporary preview origins may be
set through Fly configuration, but the tracked production allowlist must be
restored after validation.

Set `SIGNAL_TURN_CAPABILITY_SECRET` as a Fly secret on `dotify-signal`, using
the exact same 32+ character random value stored as `TURN_CAPABILITY_SECRET` on
`dotify-api`. Rotate both services together. A mismatch disables TURN relay
access while leaving room signaling and direct/STUN WebRTC available.

`SIGNAL_ALLOW_MISSING_ORIGIN=true` exists for Polkadot Desktop/native hosts
whose Socket.IO handshakes omit the `Origin` header. It does not allow the
literal `Origin: null` value from sandboxed iframes or `file://` pages. Keep it
scoped to signaling only; the backend API still requires explicit CORS origins
because it serves authenticated upload and key-delivery routes.

`/status` exposes each visible room's `listenerCount`, `maxListeners`, and
`isFull` values. When changing `SIGNAL_MAX_LISTENERS`, capture this metadata in
room smoke evidence so the frontend capacity labels and server-enforced
`ROOM_FULL` boundary stay aligned.

When a room track has a valid content hash but no runtime address, signaling
uses `SIGNAL_CONTRIBUTION_API_URL` to request the catalog release by hash. It
repairs the ephemeral room metadata only when the API snapshot is fresh and the
hash has one active release, then independently verifies the release, artist
runtime and directory registration through `SIGNAL_CONTRIBUTION_RPC_URL` before
rebroadcasting it. Concurrent joins share one recovery attempt, and a track
change during verification cannot be overwritten. API/RPC outages, stale
catalogs, ambiguous hashes, inactive releases and runtime conflicts fail closed:
the Tip action remains unavailable. Deploy signaling for this behavior. Its
existing contribution API/RPC settings must be configured; creating an attestor
and approving its address in an artist policy are separate owner-authorized
activation steps. No frontend, API or storage migration is required.

### Room contribution activation (2026-10-08)

Following explicit owner approval, signaling candidate
`fa3b6d88e1ff4c897cb36e4ce225684d12198fc6` was deployed as
`registry.fly.io/dotify-signal:deployment-01M4CRA7K6GEAWZRCGAN3S3E1E`, image
digest `sha256:03c072d68118e1dd5e73232cdec88b5519f04e53d8aeaf0448aab6afc398e562`.
Machine `d8d5205f929e28` remains the only writer/process in AMS (version 27).
The four public contribution settings above and dedicated
`SIGNAL_CONTRIBUTION_ATTESTOR_KEY` are active; the existing TURN secret remains
deployed. No private key was printed or saved to a local file.

The active attestor's public address is
`0xFa4A67C1b4f1E6fC6d39b0A0df4f4a4a7343aE19`. The runtime owner approved this
address for the profile policy of
`0xB60e91CcAcD08B6cb0Ddb2E678F90791901e9338` in transaction
`0x95fc6d47c147b52b5b33ee78c0537603b9c18d29d39c3d15b1a3d3e8dc684601`,
canonically finalized at block `14164663`. Read-back at
`2026-10-08T03:18:24.112Z` verified the policy's automatic version change from
1 to 2 and that only `roomAttestor` changed. All existing destinations, shares,
dates, campaign and description were retained; the work policy for Mon cerveau
was unchanged and inherits the profile authority.

Live checks passed: service health, origin allow/deny behavior, temporary
walletless join, and recovery of Mon cerveau's missing runtime from a Product
Fetch-polling host. Host and guest received the verified runtime and public
`/status` contained it at `2026-10-08T03:22:08.026Z`. Source-bearing fields
remained absent. A separate isolated server-local signature check recovered the
configured attestor and matched the contract's finalized quote; it did not
exercise a real signed-in host session or send a payment. The deployed server
file hashes match the tested candidate. All temporary rooms were closed.

The restart cleared the in-memory rooms; recreate them. If a connected host has
no current Dotify session, People > Receive room tips starts the usual sign-in.
Physical-device contribution-sheet/quote confirmation, funded settlement and
native room-chat notification remain acceptance gates under #229. The API and
Product 0.1.42 executable were not redeployed. A rollback restores the previous
signaling image; revoking the artist's authority requires a separately approved
policy update preserving all other current fields. Retain the dedicated secret
for recovery/rollback until policy and deployment no longer refer to it.

For a candidate build with `VITE_DOTIFY_DEBUG_PANEL=true`, the Product room
smoke panel exports the host-side evidence accepted by the Product journey
harness. It derives room creation, stream readiness, peer connection, listener
count, and canonical room URL from current room state and bounded telemetry.
The operator must still confirm the ordinary browser guest was walletless,
heard audio, and displayed `In sync`; those facts cannot be inferred honestly
from the host. The export rejects cross-candidate CIDs and contains no wallet
address, SDP, ICE candidate, IP address, key, signature, token, or audio.

Do not store `SIGNAL_ORIGINS` as a Fly secret. If `/health` reports an old
`allowedOrigins` list after deploy, the secret is probably overriding
`web/fly.signal.toml`. Remove it and redeploy or let Fly restart the machine:

```bash
cd web
flyctl secrets list -c fly.signal.toml
flyctl secrets unset SIGNAL_ORIGINS -c fly.signal.toml
flyctl deploy -c fly.signal.toml
```

The `app.dev-dot.li`, `app.dot.li`, `.dot`, and `polkadot://...` Product host
origins are required for both services when observed in the host logs or mobile
diagnostics. If an active host origin is missing, the Host shell can still
render the static app, but catalog requests lose their CORS response header and
Socket.IO polling is rejected with `403`, producing an empty music view or
preventing room creation.

Polkadot mobile host room creation also has a runtime host-permission preflight,
not only Fly CORS. Product executable `[0, 1, 6]` and later requests `WebRtc` before the
domain-scoped `Remote` permission. This order matters because the current
Product Mobile bridge can fail while encoding `Remote`, while signaling fetches
still work and `WebRtc` may still be grantable. Explicit host denials stop room
creation with a user-facing message. The known internal permission-preflight
exception (`... is not a function ... undefined`) is treated as unsupported for
that individual permission, and Dotify still checks the other permission before
opening signaling. The Product build uses
Engine.IO's fetch-based polling transport because the failing Product Mobile
runtime reached `/health` through `fetch` while its Socket.IO XHR polling did
not connect. Product host containers remain on Fetch polling for the whole
room; they do not attempt a WebSocket upgrade. Standalone browsers may still
upgrade to WebSocket. If mobile still shows `Room service unavailable` and Fly
logs show no new `/health` or `/socket.io` request, debug the Product host
remote-network layer before changing Fly origins again. If `/health` appears
but `/socket.io` does not, confirm the deployed Product executable is version
`[0, 1, 6]` or later before investigating Fly.
Product executable `[0, 1, 9]` requests `Remote` for both
`dotify-signal.fly.dev` and `dotify-api.fly.dev`, because room WebRTC startup
uses signaling plus the API TURN grant route before creating peer offers.

Product executable `[0, 1, 6]` and later also retries host audio capture when a listener
arrives before Product Mobile has produced a local WebRTC audio track. This
prevents the listener from staying on `Connecting...` merely because the host's
first capture attempt happened before the mobile media element was ready. It
also preserves trickled ICE candidates delivered before the SDP offer, retries
one failed listener negotiation, and replaces an unbounded `Joining live audio`
state with a permission, missing-offer, or TURN-specific diagnostic.
Product executable `[0, 1, 8]` also sends a near-silent placeholder offer while
the real host capture finishes, then replaces that sender track once the media
element exposes live audio. This makes a listener retry observable at the
WebRTC layer instead of timing out as "host sent no offer".
Product executable `[0, 1, 9]` closes the remaining room-open race by carrying
the resolved playable `audioSource` directly from catalog selection into
session creation. A host that has just resolved a playable track can therefore
prepare a placeholder offer even before React has propagated the new audio
source through provider props.
Product executable `[0, 1, 10]` normalizes API TURN grants to the smallest
widely compatible `RTCIceServer` shape before handing them to WebKit, wraps the
entire listener answer path in an explicit phase error, and emits metadata-only
`webrtc:diagnostic` events. The diagnostic contains no SDP, ICE candidate, IP
address, media identifier, content key, or user-agent string.

Product executable `[0, 1, 11]` and later handle the current iOS Product
sandbox boundary explicitly. The upstream Product container freezes and removes
[`window.RTCPeerConnection` during container lockdown](https://github.com/Polkadot-Community-Foundation/polkadot-ios-community/blob/main/Packages/Products/product-container/src/index.ts#L79-L81);
granting the `WebRtc` remote permission does not
restore that JavaScript API. Dotify therefore blocks mobile in-container room
hosting before creating a room and replaces futile listener retries with a
**Continue in browser** action. The action uses the Product SDK `navigateTo`
host bridge and only accepts the configured HTTPS `VITE_PUBLIC_APP_URL`. A
listener keeps the current `#/rooms/<id>` route; a would-be host opens the
canonical Dotify browser app and creates the room there.

This boundary occurs before ICE gathering. When diagnostics show
`listener:create-peer-failed`, `peerConnectionAvailable=false`, and
`protocol=polkadot:`, no TURN allocation is expected in coturn logs. Do not
change relay ports, credentials, or firewall rules for that failure. Coturn is
relevant only after peer construction, when diagnostics show a later ICE or
connection-timeout phase with `peerConnectionAvailable=true`.

The tracked Product profile currently has no `VITE_TURN_URL`,
`VITE_TURN_USERNAME`, or `VITE_TURN_CREDENTIAL`. Product builds should normally
receive TURN through the API grant endpoint instead of embedding static
credentials. Without `TURN_URLS` plus relay credentials on `dotify-api`, rooms
use direct ICE with public STUN only. This works on permissive networks but
does not guarantee a web or mobile host can reach a listener behind a different
carrier, VPN, corporate firewall, or symmetric NAT. For that topology, provide
a TURN relay, configure the API `TURN_*` variables, redeploy `dotify-api`, and
then redeploy Netlify / republish Product only if browser-visible `VITE_TURN_*`
fallback values changed.
Product executable `[0, 1, 7]` is the first Product version that fetches the
API TURN grant before opening WebRTC peers.

An open room now survives a transient host signaling disconnect for up to
`SIGNAL_HOST_TIMEOUT_MS` (currently 120 seconds). The server removes the room
from public discovery while the host is offline, retains connected listeners,
and accepts `room:resume` only with the random resume token returned privately
at room creation. The browser keeps that token in memory only; Fly stores only
its SHA-256 hash in the in-memory room record. A successful reconnect republishes
the room and rebuilds host-to-listener offers. An explicit **Leave room** still
closes immediately, and an unrecovered room closes at the existing host timeout.
This behavior requires both the updated `dotify-signal` deployment and Product
executable `[0, 1, 10]` or later.

`dotify-signal` logs room lifecycle events plus coarse peer-signaling events:
`listener:ready`, `peer:route` for `webrtc:offer` / `webrtc:answer`, and
`peer:route-dropped` when a role, target, or room check rejects an SDP route.
Executable `[0, 1, 10]` and later also report `webrtc:diagnostic` on answer creation,
ICE gathering, or connection timeout failures. ICE candidates are intentionally
not logged per message. If an offer is present with no answer, read the next
`webrtc:diagnostic.phase`: `create-peer` points to the Product host WebRTC
runtime/permission boundary; `set-remote-description` points to SDP/runtime
compatibility; and a later connection timeout or ICE candidate error points to
the TURN/network path.

Keep `dotify-signal` on one active machine until a shared Socket.IO adapter is
added. Rooms, chat, reactions, request queues, and solo-presence aggregates are
currently in memory.

## Validation Checklist

After changing Netlify or Fly dashboard values:

1. Trigger a new Netlify deploy for frontend `VITE_*` changes.
2. Check Fly secret overrides before debugging stale CORS. `API_ORIGINS` and
   `SIGNAL_ORIGINS` should not appear in `flyctl secrets list`; they are
   tracked non-secret config.
3. Restart or redeploy the affected Fly app after secret/runtime changes if the
   platform did not already restart machines.
4. Confirm the backend:

```bash
curl -s https://dotify-api.fly.dev/health
curl -s https://dotify-api.fly.dev/health/ready
curl -s https://dotify-api.fly.dev/api/catalog
curl -s https://dotify-api.fly.dev/api/turn/grant
```

5. Confirm signaling:

```bash
curl -s https://dotify-signal.fly.dev/health
curl -s https://dotify-signal.fly.dev/status
```

6. Run local smoke checks when the repo is available:

```bash
cd web
npm run smoke:production-env
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.app.dev-dot.li
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.app.dot.li
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.dot
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin polkadot://dotify-test01.dot
npm run smoke:pilot-release -- --md-out /tmp/dotify-pilot-release-readiness.md --json-out /tmp/dotify-pilot-release-readiness.json
npm run build:product-devnet
```

`smoke:pilot-release` is read-only. It reconciles W01-W12 evidence, Product
static gates, the reversible W13 release plan, optional Product/room smoke
exports, and optional aggregate pilot evidence. Missing live Product or
participant evidence remains `blocked` or `not-run`; it is never counted as a
passing pilot. If `--pilot-json` is supplied, it must use schema v2 and bind the
decision to the candidate git SHA, Product appVersion, deployed CID, capture
time, outcome metrics, privacy flags, rollback, and join-count invariants.

7. For a Product release, complete the cross-origin room, mobile host
   permission, and host-account
   checks in
   [`docs/operations/product-devnet-deployment.md`](product-devnet-deployment.md).

8. For explicit origin rejection evidence, include a denied origin:

```bash
cd web
npm run smoke:signal -- \
  --url https://dotify-signal.fly.dev \
  --origin https://<frontend-origin> \
  --denied-origin https://not-dotify.example
```

9. Attach evidence to the PR when the active ticket requires public validation.
   For ticket #86, include `GET /api/catalog` state, block lag, and warm/cold
   catalog timing evidence.

## Update Checklist For Future PRs

When implementation changes env or hosted settings, update all applicable
places in the same PR:

| If the change affects                                                             | Check/update                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any env var contract                                                              | `docs/reference/environment-variables.md`, relevant `.env.example`, this runbook      |
| Netlify build or browser env                                                      | `netlify.toml`, `web/README.md`, this runbook                                         |
| Backend API env, secrets, CORS, uploads, keys, catalog                            | `services/api/.env.example`, `services/api/fly.toml`, this runbook                    |
| Signaling env, room limits, origin policy, scaling                                | `web/.env.example`, `web/fly.signal.toml`, `web/README.md`, this runbook              |
| Public URLs, contract addresses, production priorities, or architecture narrative | `README.md`; update `docs/index.html` only when the public project page should change |
| Security boundary                                                                 | relevant threat model or explanation doc plus this runbook                            |
| PR validation process                                                             | `.github/pull_request_template.md` if the checklist itself changes                    |

## References

- `docs/reference/environment-variables.md` is the complete variable reference.
- `web/README.md` contains local frontend and production deploy commands.
- `services/api/.env.example` is the local backend API template.
- `web/.env.example` is the local frontend/signaling template.
- Netlify project environment variables:
  <https://docs.netlify.com/build/environment-variables/get-started/>
- Fly app secrets:
  <https://fly.io/docs/apps/secrets/>
- Fly app configuration:
  <https://www.fly.io/docs/reference/configuration/>


## Shared-presence room rollout

`VITE_DOTIFY_ROOM_GALAXY=on` enables the existing optional 3D selector. It is
absent/off by default in both ordinary and Product builds; 2D/list remains the
complete discovery path. The room lineup is part of the normal room protocol:
the host publishes a bounded metadata-only order through signaling and every
participant receives the same ephemeral snapshot. It needs no frontend flag,
key, permission, CORS origin, or storage mount. Changing the galaxy flag still
requires rebuilding; it cannot be enabled by URL or local storage.

For the reliable composer, release the signaling `room:chat` / `room:request`
acknowledgement support before or together with the frontend. Old clients remain
compatible. New clients retain drafts and warn if an old server cannot confirm
acceptance within five seconds. Check the room before resending an unconfirmed
message; there is no automatic retry or exactly-once guarantee. Request capacity
and social rate limits remain server-enforced. Reactions are not buffered during
transport loss.

Rollback the galaxy experiment by rebuilding without its `on` value. The room
lineup requires a coordinated frontend/signaling rollback because old signaling
servers ignore its events while the current frontend keeps playback functional.
Nearby and
community memory remain documentation only: no new endpoint or location
permission is configured by this pass. See
[shared-presence pass](../design/dotify-shared-presence-pass.md).

## Product artist-support validation profile

`npm --prefix web run build:product-devnet:support` selects the existing explicit
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` profile for native Polkadot App support.
It builds only; it does not deploy or alter the default tracked Product profile.
The API/key authority, CORS and contract addresses remain unchanged. Product
payments request finalization before returning. Classic support recovery now
uses a durable browser journal scoped by network/adapter endpoint, payer,
runtime and content hash, migrating the matching old tab-local reference.
See [current payment recovery boundaries](../../web/README.md#native-artist-support-validation-build)
and [the original support recovery design](../design/product-host-support-recovery-2026-09-15.md).
Before promotion, verify balance/fee availability and SDK lifecycle on a real
Product host, close/reopen pending feedback, and reopen an uncertain payment
after closing the tab. None of those recovery checks should request a second
payment. Test on the intended deployment origin: host storage isolation or a
changed origin/RPC endpoint can prevent earlier references being found.

Promote only after the existing W11 host approval/value-forwarding/access smoke
has real device evidence. Check native transaction-reference explorer support.
No real signing or funded transaction was performed as part of implementation
checks. Roll back the frontend to the previous profile; no contract or backend
migration is required. Preserve/check unresolved payment references before
clearing host/browser storage.

Gifts and tips are native UI; `VITE_DOTIFY_ARTIST_DONATIONS` is retired.
Gifts use the artist's profile allocation; work tips preserve collaborator
splits after an optional host percentage is deducted from the whole room tip. Both require an
upgraded contribution runtime and keep listening access unchanged. Product
signing still requires the CDM writer profile. Live host validation and
owner-approved upgrades are separate release gates. See
[native contributions](../design/native-contributions.md).

### Native contributions activation (2026-10-01)

This section describes a release procedure, not an executed deployment. Keep
the same chain/runtime addresses: encrypted keys and previous purchases are
bound to them. Do not replace artist runtimes to obtain the new functions.

1. Review and test `MusicContributionsPallet`/`MusicRoyaltiesPallet`, regenerate
   frontend ABIs and the merged CDM ABI with `npm run generate:abis` in
   `contracts/evm` and `npm run generate:cdm` in `web`.
2. Use the existing `runtime:deploy-royalties-facet` dry run and explicit
   code-hash confirmation for a separately authorized facet deployment. For
   each runtime, use `runtime:royalties-upgrade` dry run, review its Add/Replace
   selectors and snapshot, then obtain the owner's confirmation before execute.
   Existing factory contracts are immutable: their old bootstrap will not
   install new selectors. Upgrade newly created runtimes too, or separately
   review deployment of an updated factory against the existing directory.
3. Deploy the API exposing `/api/auth/identity`, then signaling and the frontend.
   Product writes need `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`; no donation
   feature flag is needed. The viem build continues to use browser-wallet writes.
4. Configure the signaling-only settings below. Verify the chain and directory
   against the deployment manifest; never put the attestor key in a Vite value.
5. In Artist > Rights, approve the attestor's public address under Campaign and
   room verification, and choose the profile/work allocations, schedule and
   optional host share. A work can inherit the profile's room authority.
6. A connected host with a valid Dotify sign-in session is bound automatically.
   Otherwise use Receive room tips to perform the normal sign-in. A listener
   never needs that session merely to hear the room. Current clients publish the
   work runtime directly. For older/cached clients, signaling may recover a
   missing runtime only from one fresh catalog match that also passes on-chain
   runtime and directory verification; otherwise tips stay unavailable.
7. With separately authorized test funds, inspect and confirm one gift, one
   direct tip and one room tip on the intended Product device. Verify exact
   recipient amounts, canonical dated receipts, host allocation, a single chat
   notification, earnings refresh and pending/reload recovery without repayment.
   Repeat outside the scheduled interval and after a policy change.

| Server-only setting | Purpose |
| --- | --- |
| `SIGNAL_CONTRIBUTION_ATTESTOR_KEY` | Dedicated unfunded EVM signing key for room context proofs; use the host secret store. No fallback key exists. |
| `SIGNAL_CONTRIBUTION_RPC_URL` | Public EVM RPC for the deployed artist runtimes. |
| `SIGNAL_CONTRIBUTION_CHAIN_ID` | Exact EVM chain ID, checked against the RPC. |
| `SIGNAL_CONTRIBUTION_DIRECTORY` | ArtistDirectory address from the manifest. |
| `SIGNAL_CONTRIBUTION_API_URL` | Trusted API base including `/api`, e.g. `https://dotify-api.fly.dev/api`; validates host bearer sessions. |

No new storage mount is required. Contribution ledgers are on-chain; browser
storage holds recovery references and rooms hold only ephemeral context/chat.
Keep bearer authorization headers out of proxy logs. Server-to-server identity
verification does not require widening browser CORS. The artist-approved
attestor is a centralized trust boundary for room attribution; rotation also
requires updating artist policies. Already issued proofs live at most ten
minutes and are bound to one payer/intent/amount.

On rollback, retain contribution claim selectors and storage so rejected
recipients can still recover their funds. Stop new room proofs if needed and
revert the frontend while preserving local recovery records. Do not blindly
replace the upgraded facet with an old one that omits contribution claims.
The former claimable-royalty balance and contribution claim balances are
separate; legacy receipts and old direct wallet gifts cannot be reclassified.
