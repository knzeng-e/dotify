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
Track asset IPFS:    https://ipfs.io, https://dweb.link
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
```

`CONTENT_KEY_MASTER_SECRET` derives per-track keys. Do not rotate it casually:
rotating it changes the key derivation boundary for existing tracks.

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

| Key                       | Value                                                              | Notes                                                            |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `VITE_DOTIFY_DEPLOYMENT`  | `production`                                                       | Enables fail-closed production env validation.                   |
| `VITE_DOTIFY_HOST_MODE`   | `off`                                                              | Prevents the standalone build from probing Product host APIs.    |
| `VITE_SIGNAL_URL`         | `https://dotify-signal.fly.dev`                                    | Public Socket.IO signaling origin.                               |
| `VITE_DOTIFY_API_URL`     | `https://dotify-api.fly.dev`                                       | Backend API for uploads, key delivery, and cached catalog reads. |
| `VITE_PINATA_GATEWAY`     | `https://paseo-ipfs.polkadot.io`                                   | Primary browser read gateway.                                    |
| `VITE_IPFS_READ_GATEWAYS` | `https://paseo-ipfs.polkadot.io,https://ipfs.io,https://dweb.link` | Ordered fallback gateway list.                                   |

Optional production variables:

| Key                            | When to set                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOTIFY_DEBUG_PANEL=true` | Temporary operator smoke checks under `You -> Production readiness`; unset for ordinary listener deployments.                                   |
| `VITE_TURN_URL`                | Browser-visible TURN fallback for DevNet/static credentials. Prefer API grants for production. Accepts comma-separated `turn:` / `turns:` URLs. |
| `VITE_TURN_USERNAME`           | Static fallback only. Do not use long-lived production credentials here.                                                                        |
| `VITE_TURN_CREDENTIAL`         | Static fallback only. Do not use long-lived production credentials here.                                                                        |
| `VITE_ETH_RPC_URL`             | Override the default Paseo Asset Hub EVM RPC. Must be HTTPS in production.                                                                      |
| `VITE_WS_URL`                  | Override the default Polkadot WebSocket RPC. Must be WSS in production.                                                                         |
| `VITE_BULLETIN_WS_URL`         | Override the default Paseo Bulletin RPC. Must be WSS in production.                                                                             |
| `VITE_BLOCKSCOUT_BASE_URL`     | Override explorer links. Must be HTTPS in production.                                                                                           |

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
| `VITE_PINATA_GATEWAY`           | `https://ipfs.io`                                                                                                                |
| `VITE_IPFS_READ_GATEWAYS`       | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation,https://bulletin-kubo.tservices.es:9443` |
| Product executable `appVersion` | `[0, 1, 12]` in `web/polkadot-app-deploy.config.ts`                                                                              |

The Product executable version is part of the published Product manifest. Bump
it whenever the Product bundle changes runtime behavior, host SDK integration,
permissions, metadata, or cache-sensitive assets. A new CID alone proves the
bundle changed on-chain, but the mobile host can still use executable metadata
when deciding whether to refresh a previously opened app.

Current Product host SDK dependencies:

| Package                                      | Current value | Latest checked 2026-08-30 |
| -------------------------------------------- | ------------- | ------------------------- |
| `@parity/product-sdk`                        | `0.23.0`      | `0.25.0`                  |
| `@parity/product-sdk-host`                   | `0.16.0`      | `0.18.0`                  |
| `@parity/product-sdk-statement-store`        | `0.6.5`       | `0.6.7`                   |
| `@parity/product-sdk-descriptors`            | `0.10.0`      | `0.11.0`                  |
| `polkadot-api`                              | `1.23.3`      | `3.0.0`                   |
| `@polkadot-community-foundation/polkadot-app-deploy` | `0.13.1` | `0.13.1`                  |
| `engine.io-client`                           | `6.6.6`       | `6.6.6`                   |

Keep the Product SDK packages pinned exactly during Product DevNet hardening.
Recheck npm and the official Product docs before changing them because the
mobile host API is still moving quickly. The 2026-08-30 check found a newer
Product SDK line; upgrade it in a dedicated compatibility PR rather than mixing
it into Product write-signer mapping work. `polkadot-api` remains on `1.23.3` at
the Dotify root even though npm publishes `3.0.0`: the current official Product
SDK packages bring their own PAPI `2.2.x` tree, while `@polkadot-apps`
chain-client/keys/signer still depend on PAPI `1.23.x`. A direct root PAPI 3
trial failed type compatibility for the `PolkadotSigner` export and
`ChainDefinition` / `TypedApi` boundaries, so PAPI 3 is tracked as a blocked
compatibility migration rather than a deployable dependency bump.

`VITE_DOTIFY_ROOM_BEACONS` is off in the tracked profile, so the standard
publication announces no rooms on the Statement Store. The capability ships
dormant on purpose: nothing reads beacons yet, so publishing room records to a
public chain would be exposure with no consumer, and the publish path has no
live host evidence. Enabling also adds about 24 KB to every publication, against
a finite Bulletin quota.

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
currently pins through Pinata. Keep `ipfs.io` and `dweb.link` before Product
storage gateways for `VITE_PINATA_GATEWAY` and `VITE_IPFS_READ_GATEWAYS`;
otherwise cover images can hang in the browser without firing an image error.

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

Build and publication:

```bash
cd web
read -rs MNEMONIC
export MNEMONIC
npm run generate:product-catalog-bootstrap:strict
npm run build:product-devnet
npm run deploy:product-devnet
```

`deploy:product-devnet` requires `MNEMONIC` and passes it to
`polkadot-app-deploy` with `--mnemonic "$MNEMONIC"
--no-transfer-to-signedin-user`. This intentionally avoids the mobile
`pad login` session for DotNS updates. `pad whoami` reports the mobile Product
session, not the mnemonic-derived owner signer.

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
| `PASEO_ASSET_HUB_RPC`      | `https://eth-rpc-testnet.polkadot.io/`                                                                                                                                                                                       |
| `DOTIFY_FACTORY_ADDRESS`   | `0xbd1a11cfce8b5ef7a37e507bc5109895f8f42a72`                                                                                                                                                                                 |
| `DOTIFY_DIRECTORY_ADDRESS` | `0xcf1534c6e2b0e43b9436c1e86a076466dc0f2108`                                                                                                                                                                                 |
| `DOTIFY_CHAIN_ID`          | `420420417`                                                                                                                                                                                                                  |

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

| Secret                      | Required                      | Notes                                                                                               |
| --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `PINATA_JWT`                | Uploads                       | Backend-only Pinata token. Never expose in Netlify.                                                 |
| `CONTENT_KEY_MASTER_SECRET` | Audio upload and key delivery | 64+ hex chars, at least 32 random bytes. Do not rotate casually.                                    |
| `GIT_COMMIT_SHA`            | Optional                      | Set by CI/build automation when available; `/version` can fall back in dev checkouts.               |
| `TURN_REST_SECRET`          | Reliable rooms                | Backend-only HMAC secret shared with the TURN relay REST auth mechanism. Preferred production path. |
| `TURN_USERNAME`             | Optional fallback             | Static DevNet TURN username when REST auth is unavailable.                                          |
| `TURN_CREDENTIAL`           | Optional fallback             | Static DevNet TURN password when REST auth is unavailable.                                          |

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

TURN relay variables:

| Key                                 | Default | When to set                                                                                                                                                                   |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURN_URLS`                         | unset   | Set to comma-separated public relay URLs when deploying reliable room audio, for example `turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp`. |
| `TURN_REST_SECRET`                  | unset   | Preferred production credential path. Store as a Fly secret only.                                                                                                             |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | unset   | Rotated DevNet/static fallback only when the relay cannot mint REST credentials. Store as Fly secrets.                                                                        |
| `TURN_TTL_SECONDS`                  | `3600`  | Adjust only with relay policy. REST credentials embed this expiry in the username.                                                                                            |

The API exposes `GET /api/turn/grant` for the frontend room code. If `TURN_URLS`
and either `TURN_REST_SECRET` or static credentials are configured, the response
contains browser-safe `RTCIceServer` credentials. If not, the route returns
`TURN_NOT_CONFIGURED` and the room client falls back to STUN plus any
browser-visible `VITE_TURN_*` values.

For production, prefer TURN REST credentials because the shared relay secret
stays on Fly. `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` are public bundle
values and should be limited to rotated DevNet/static tests.
The grant endpoint is intentionally walletless so room guests can join from a
link; protect the relay with short TTLs, API rate limits, relay quotas, and
secret rotation rather than listener authentication.

### Backend Signature Schemes

No Netlify or Fly dashboard variable enables Product signatures. The API
accepts two explicit schemes on session sign-in and protected key requests:

| Scheme               | Client                               | Required proof fields           | Backend binding                                                                                                              |
| -------------------- | ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `eip191`             | Standalone EVM/passkey wallet path   | `signature`                     | `viem.verifyMessage` against the requester H160                                                                              |
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
**Payment included, access not verified** error.
Validate Product protected playback through host smoke tests after each Product
publication before treating Product identity as production-ready for gated
listening.

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
| `SIGNAL_ALLOW_MISSING_ORIGIN` | `true`                                                                                                                                                                                                                       |
| `SIGNAL_ORIGINS`              | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |

The production origins are public configuration tracked in
`web/fly.signal.toml`; they are not secrets. Temporary preview origins may be
set through Fly configuration, but the tracked production allowlist must be
restored after validation.

`SIGNAL_ALLOW_MISSING_ORIGIN=true` exists for Polkadot Desktop/native hosts
whose Socket.IO handshakes omit the `Origin` header. It does not allow the
literal `Origin: null` value from sandboxed iframes or `file://` pages. Keep it
scoped to signaling only; the backend API still requires explicit CORS origins
because it serves authenticated upload and key-delivery routes.

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
npm run build:product-devnet
```

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
