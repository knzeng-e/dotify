# Environment Variables Reference

All environment variables for the Dotify web app, signaling server, backend API,
and EVM deployment scripts. Copy the relevant `.env.example` file and fill in
values for your environment.

For hosted Netlify/Fly dashboard placement, validation steps, and the checklist
for future env/config changes, see
[`docs/operations/deployment-configuration.md`](../operations/deployment-configuration.md).

---

## Operator deployment variables (shell only)

These variables are consumed by local deployment scripts. They are not bundled
into the web app and must not be stored in `.env` files, Netlify, Fly, or the
repository.

### `MNEMONIC`

| Property     | Value                    |
| ------------ | ------------------------ |
| **Type**     | BIP-39 mnemonic          |
| **Required** | Product DevNet publish   |
| **Default**  | None                     |
| **Example**  | `<dotns-owner-mnemonic>` |

DotNS owner mnemonic used by `npm run deploy:product-devnet`. The script
refuses to deploy when this value is empty, then passes it to
`polkadot-app-deploy` as `--mnemonic "$MNEMONIC"
--no-transfer-to-signedin-user`.

This is different from `pad login`: `pad login` and `pad whoami` describe the
mobile Product session, not the mnemonic-derived signer used for DotNS updates.
If the owner account uses a derivation path, keep that path aligned with the
deploy command before publishing.

### `CATALOG_API_URL`

| Property     | Value                                            |
| ------------ | ------------------------------------------------ |
| **Type**     | HTTPS URL                                        |
| **Required** | No                                               |
| **Default**  | `VITE_DOTIFY_API_URL` from `.env.product-devnet` |
| **Example**  | `https://dotify-api.fly.dev`                     |

Optional override used by
`npm run generate:product-catalog-bootstrap`. The generator refreshes the
Product DevNet bootstrap catalog from
`$CATALOG_API_URL/api/catalog?limit=100&includeInactive=true`, validates the
response, and writes `web/src/services/productDevnetCatalogBootstrap.ts`.

Use this only in the local operator shell when refreshing a Product build from a
non-default catalog API. It is not bundled into the browser and must not be set
in Netlify or Fly.

---

## Web app variables (`web/.env.local`)

Variables prefixed with `VITE_` are bundled into the browser. Do not put secrets
that must remain server-side here.

### `VITE_DOTIFY_DEPLOYMENT`

| Property     | Value                                       |
| ------------ | ------------------------------------------- |
| **Type**     | `local`, `demo`, `preview`, or `production` |
| **Required** | Production deployments                      |
| **Default**  | `demo`                                      |
| **Example**  | `production`                                |

Build-time deployment safety mode. Set `VITE_DOTIFY_DEPLOYMENT=production` for
public production builds. In that mode, `npm run build` fails if required
production URLs are missing, if production URLs point at loopback or insecure
origins, or if browser-bundled demo secrets such as `VITE_PINATA_JWT` or
`VITE_CONTENT_SECRET` are present.

Use `npm run smoke:production-env` from `web/` to verify the guard. The smoke
check runs one missing-env build, one unsafe-secret build, and one safe public
production build contract without printing real secret values.

---

### `VITE_DOTIFY_HOST_MODE`

| Property     | Value                        |
| ------------ | ---------------------------- |
| **Type**     | `off`, `auto`, or `required` |
| **Required** | Product builds               |
| **Default**  | `off`                        |
| **Example**  | `required`                   |

Controls Product host discovery. `off` keeps the standalone app independent
from the Product SDK. `auto` enables progressive host detection. `required`
marks a Product-targeted build but does not block catalog, Free playback, or
wallet-free room entry when opened outside the host.

Host detection does not request an account. The account is requested only when
the listener selects **Use Polkadot app**.

---

### `VITE_DOTIFY_RUNTIME_ADAPTER`

| Property     | Value                   |
| ------------ | ----------------------- |
| **Type**     | `viem` or `product-cdm` |
| **Required** | No                      |
| **Default**  | `viem`                  |
| **Example**  | `viem`                  |

Selects which adapter backs the runtime contract ports. `viem` is the only path
with production evidence. `product-cdm` routes reads and write submissions
through the Product SDK contract handles over the generated `cdm.json` snapshot.
The frontend now uses the same `RuntimeWritePort` for Classic unlock payments in
both modes, but Product CDM writes remain an operator opt-in until real
host-signed transaction evidence is captured. In a `product-cdm` build, Classic
unlock success also requires a bounded post-inclusion read-back where
`musicAccHasPaid(contentHash, listenerH160)` and
`musicAccCanAccess(contentHash, listenerH160)` both return `true` for the same
Product-derived H160 account. An included transaction whose read-back never
confirms access remains visible to the user with its transaction hash instead
of being reported as a generic payment failure.

Any unrecognised value falls back to `viem`, so a typo cannot silently disable
contract reads. `product-cdm` additionally requires `VITE_DOTIFY_HOST_MODE` to
be `auto` or `required`: the Product chain client connects only through a host
container and has no direct-WebSocket fallback. The production guard rejects
that combination rather than shipping a frontend that cannot read the catalog.

**Build size.** This flag is read at build time, not runtime. A `viem` build
tree-shakes the entire Product contract graph away; opting in pulls it back in
along with `@parity/product-sdk-descriptors`, whose shared descriptors module
references every chain's metadata. Measured on this branch:

| Build                                         | Output size |
| --------------------------------------------- | ----------- |
| `VITE_DOTIFY_RUNTIME_ADAPTER` unset or `viem` | 4.4 MB      |
| `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`     | 10 MB       |

Only one metadata chunk is ever fetched at runtime, but all of them are
published. Weigh that against the Bulletin storage quota before enabling this
for a `.dot` deployment.

---

### `VITE_DOTIFY_ROOM_BEACONS`

| Property     | Value         |
| ------------ | ------------- |
| **Type**     | `on` or `off` |
| **Required** | No            |
| **Default**  | `off`         |
| **Example**  | `off`         |

Publishes a small beacon to the Statement Store while hosting a room, so the
room can be discovered without Dotify's signaling server.

This is **discovery only**. A beacon never carries SDP, ICE, chat, or audio, and
is never required to join: a share link still works with no wallet, no account,
and no chain. Joining cannot move here - a WebRTC offer is 1.5-4 KB against a
512-byte statement ceiling, and a guest would have to publish an answer, which
needs an identity and an allowance. That would turn every listener into a
registered person.

Only a host publishes, and only while hosting. Requires `VITE_DOTIFY_HOST_MODE`
to be `auto` or `required`: the statement store client runs only inside the
Product host container, so enabling beacons without it would ship chain code
that can never connect. The production guard rejects that combination.

A beacon carries the room code, host display name, and an aggregate listener
count - never listener identities. Now-playing is opt-in per host, because a
beacon is globally readable and outlives the room by up to the retention window,
which is a different exposure than sharing a link.

**Build size.** Enabling this adds about 24 KB. A build with it `off` still
carries a ~69 KB statement-store chunk that is never fetched at runtime: Rollup
emits a chunk for the nested dynamic import before it can prove the build-time
guard makes it unreachable. That is ~1.5% of the bundle, and the code never
executes, but it is published weight against the Bulletin quota.

---

### `VITE_DOTIFY_PRODUCT_CHAIN`

| Property     | Value    |
| ------------ | -------- |
| **Type**     | `devnet` |
| **Required** | No       |
| **Default**  | `devnet` |
| **Example**  | `devnet` |

Product chain preset used only when `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm`.

`devnet` is the only accepted value, and that is a correctness constraint.
Product DevNet is a preset over the Paseo system parachains - Asset Hub (1000),
People (1004), Bulletin (1010) - at EVM chain `420420417`, which is exactly
where Dotify's contracts are deployed.

The SDK's `paseo` preset is _not_ an alternative: it targets Paseo Next
(Asset Hub Next 1500 / People Next 1502), which the Product documentation calls
a different network. Selecting it would resolve every manifest address to an
account with no code - indistinguishable from artists with no releases.
`verifyDeployment()` turns that into an explicit error at startup, and the
config layer refuses the value outright.

Regenerate the manifest with `npm run generate:cdm` after any contract
redeploy, or the addresses in `cdm.json` go stale.

---

### `VITE_DOTIFY_PRODUCT_ID`

| Property     | Value                  |
| ------------ | ---------------------- |
| **Type**     | Lowercase `.dot` name  |
| **Required** | Host mode is not `off` |
| **Default**  | `dotify-test01.dot`    |
| **Example**  | `dotify-test01.dot`    |

DotNS identifier used by the Product host to derive Dotify's app-scoped
account. Changing it changes the Product account boundary and requires an
identity/access migration review.

---

### `VITE_PUBLIC_APP_URL`

| Property     | Value                              |
| ------------ | ---------------------------------- |
| **Type**     | HTTPS URL                          |
| **Required** | Product production builds          |
| **Default**  | Current browser URL                |
| **Example**  | `https://dotify-test01.dev-dot.li` |

Canonical public origin used when copying room links and when a Product runtime
needs to continue a room in the external browser. Product builds must set this
so invitations and browser fallbacks never expose an internal host/container or
raw gateway URL.

---

### `VITE_DOTIFY_DEBUG_PANEL`

| Property     | Value          |
| ------------ | -------------- |
| **Type**     | Boolean string |
| **Required** | No             |
| **Default**  | `false`        |
| **Example**  | `true`         |

Enables the optional Production readiness panel under the `You` tab. The panel
performs read-only checks for the backend readiness endpoint, signaling health,
chain RPC, configured factory/directory contract code, wallet-chain mismatch,
catalog status, and IPFS gateway reads. In an explicit Product CDM write smoke
build, it also exposes the Product CDM host evidence collector for payment
read-back, native `amountPlanck`, Product sr25519 key/session outcomes, and the
operator-marked host approval observation. Leave this unset for ordinary
listener deployments unless operators need in-app diagnostics.

---

### `VITE_SIGNAL_URL`

| Property     | Value                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| **Type**     | URL string                                                                       |
| **Required** | No                                                                               |
| **Default**  | `http://localhost:8788` in local development, otherwise same host on port `8788` |
| **Example**  | `https://dotify-signal.fly.dev`                                                  |

Socket.IO signaling server used for room discovery and WebRTC handshake relay.
Production deployments must use a publicly reachable HTTPS endpoint.

---

### `VITE_DOTIFY_API_URL`

| Property     | Value                           |
| ------------ | ------------------------------- |
| **Type**     | URL string                      |
| **Required** | Production uploads/key delivery |
| **Default**  | None                            |
| **Example**  | `https://dotify-api.fly.dev`    |

Backend API base URL. When set, audio, cover, and metadata uploads go through
the backend. Full-track playback can request content keys with wallet-signed
requests. The backend accepts the default `eip191` signature scheme and the
Product-host `product-sr25519-v1` scheme without an additional env flag. When
unset, the web app falls back to local/demo browser-side Pinata upload and
`VITE_CONTENT_SECRET` encryption.

---

### `VITE_BULLETIN_WS_URL`

| Property     | Value                                  |
| ------------ | -------------------------------------- |
| **Type**     | WebSocket URL                          |
| **Required** | No                                     |
| **Default**  | `wss://paseo-bulletin-rpc.polkadot.io` |

Paseo Bulletin Chain RPC used when an artist enables Bulletin archival.

---

### `VITE_LOCAL_WS_URL`

| Property     | Value                 |
| ------------ | --------------------- |
| **Type**     | WebSocket URL         |
| **Required** | No                    |
| **Default**  | `ws://localhost:9944` |

Local Substrate node endpoint for development.

---

### `VITE_WS_URL`

| Property     | Value                                             |
| ------------ | ------------------------------------------------- |
| **Type**     | WebSocket URL                                     |
| **Required** | No                                                |
| **Default**  | Local/testnet preset from `src/config/network.ts` |

Optional global Polkadot WS override.

---

### `VITE_LOCAL_ETH_RPC_URL`

| Property     | Value                   |
| ------------ | ----------------------- |
| **Type**     | HTTP URL                |
| **Required** | No                      |
| **Default**  | `http://localhost:8545` |

Local EVM JSON-RPC endpoint used by the local network preset.

---

### `VITE_PINATA_JWT`

| Property     | Value                           |
| ------------ | ------------------------------- |
| **Type**     | JWT string                      |
| **Required** | Demo/local browser uploads only |
| **Default**  | None                            |
| **Security** | Exposed in the browser bundle   |

Restricted browser-exposed Pinata token used only when `VITE_DOTIFY_API_URL` is
unset. Do not use an unrestricted Pinata JWT here. Production uploads should set
`VITE_DOTIFY_API_URL` and keep `PINATA_JWT` in the backend environment.

---

### `VITE_PINATA_GATEWAY`

| Property     | Value                            |
| ------------ | -------------------------------- |
| **Type**     | URL string                       |
| **Required** | No                               |
| **Default**  | `https://paseo-ipfs.polkadot.io` |

Primary IPFS gateway for fetching audio, cover images, and metadata.

For Product DevNet builds, keep a public gateway such as `https://ipfs.io` here
while track assets are pinned through the API/Pinata path. The Product IPFS
gateway is still used to publish the app bundle, but it may not resolve those
public track CIDs quickly enough for browser image rendering.

---

### `VITE_IPFS_READ_GATEWAYS`

| Property     | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| **Type**     | Comma-separated URL list                                           |
| **Required** | No                                                                 |
| **Default**  | `https://paseo-ipfs.polkadot.io,https://ipfs.io,https://dweb.link` |

Fallback IPFS gateways tried after `VITE_PINATA_GATEWAY`. Put gateways that
resolve the current catalog's public track CIDs before Product storage gateways;
otherwise image elements can sit pending without an `error` event and delay the
fallback path.

---

### `VITE_CONTENT_SECRET`

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| **Type**     | 32-byte hex string                         |
| **Required** | Demo/local browser encryption only         |
| **Default**  | Empty, which falls back to a fixed dev key |
| **Security** | Exposed in the browser bundle              |

Best-effort browser-side encryption secret used only in demo/local mode. Do not
use this as a production key boundary; production should use the backend
`CONTENT_KEY_MASTER_SECRET`.

---

### `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| **Type**     | Comma-separated TURN URL list and optional credentials |
| **Required** | No                                                     |
| **Default**  | None                                                   |

Optional browser-visible TURN relay fallback for WebRTC rooms. `VITE_TURN_URL`
accepts one or more comma-separated `turn:` / `turns:` URLs, for example
`turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp`.

Prefer the backend `/api/turn/grant` path for production so the shared TURN
REST secret stays server-side. These `VITE_*` values are readable from the
published bundle and should be limited to rotated DevNet/static credentials.
Without any TURN relay, STUN-only connections can fail behind symmetric NATs,
carrier NAT, VPNs, and some corporate firewalls.

---

### `VITE_BLOCKSCOUT_BASE_URL`

| Property     | Value                                    |
| ------------ | ---------------------------------------- |
| **Type**     | URL string                               |
| **Required** | No                                       |
| **Default**  | `https://blockscout-testnet.polkadot.io` |

Explorer base URL used for address, transaction, and block links.

---

## Signaling server variables (`web/server/signaling.mjs`)

These variables are read by the signaling server process and are never sent to
the browser.

### `SIGNAL_PORT`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | Integer |
| **Required** | No      |
| **Default**  | `8788`  |

TCP port the Socket.IO server listens on.

---

### `SIGNAL_HOST`

| Property     | Value     |
| ------------ | --------- |
| **Type**     | String    |
| **Required** | No        |
| **Default**  | `0.0.0.0` |

Network interface to bind.

---

### `SIGNAL_ORIGINS`

| Property     | Value                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type**     | Comma-separated URL list or `*`                                                                                                                                                                                              |
| **Required** | No                                                                                                                                                                                                                           |
| **Default**  | `*`                                                                                                                                                                                                                          |
| **Example**  | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |

CORS allowed origins for Socket.IO and status endpoints. Set explicit frontend
origins in production. `SIGNAL_ORIGIN` is still accepted as a backwards-compatible
singular alias.

Product deployments need every observed exact HTTPS origin:
`dotify-test01.dev-dot.li` is the public top-level gateway and canonical
room-link origin, desktop host iframe requests originate from
`dotify-test01.app.dev-dot.li`, Product host requests have also been observed
from `dotify-test01.app.dot.li`, and Product mobile host webviews can originate
from `dotify-test01.dot` or `polkadot://dotify-test01.dot`.

On Fly, keep this value in `web/fly.signal.toml`. Do not define
`SIGNAL_ORIGINS` as a Fly secret: secrets override `[env]` values and can leave
the live service using a stale origin list after redeploy.

---

### `SIGNAL_ALLOW_MISSING_ORIGIN`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | Boolean |
| **Required** | No      |
| **Default**  | `false` |
| **Example**  | `true`  |

Allows Socket.IO handshakes with no `Origin` header. This is for
Polkadot Desktop/native hosts that do not send browser-style CORS origins on
the signaling connection.

This does not allow the literal `Origin: null` header. Keep `null` rejected:
sandboxed iframes and `file://` pages can use it. Do not mirror this behavior
to the backend API, which serves authenticated upload and content-key routes.

---

### `SIGNAL_ROOM_TTL_MS`

| Property     | Value                |
| ------------ | -------------------- |
| **Type**     | Integer milliseconds |
| **Required** | No                   |
| **Default**  | `21600000` (6 hours) |

Hard room lifetime before the signaling server expires it.

---

### `SIGNAL_HOST_TIMEOUT_MS`

| Property     | Value                |
| ------------ | -------------------- |
| **Type**     | Integer milliseconds |
| **Required** | No                   |
| **Default**  | `120000`             |

Closes rooms whose host stops sending events or heartbeats.

---

### `SIGNAL_MAX_LISTENERS`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | Integer |
| **Required** | No      |
| **Default**  | `24`    |

Maximum listeners allowed in one room.

---

### `BULLETIN_ACCOUNT`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | String  |
| **Required** | No      |
| **Default**  | `Alice` |

Dev account used by web Bulletin scripts in local development or CI. Never use
this as a production user fallback.

---

## Backend API variables (`services/api/.env`)

These variables are server-side only.

### `API_PORT`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | Integer |
| **Required** | No      |
| **Default**  | `8790`  |

Port the backend API listens on.

---

### `API_ORIGIN`

| Property     | Value                   |
| ------------ | ----------------------- |
| **Type**     | URL string              |
| **Required** | Production              |
| **Default**  | `http://localhost:5273` |

Singular frontend origin allowed by backend CORS. This remains as a
backwards-compatible fallback when `API_ORIGINS` is not set.

---

### `API_ORIGINS`

| Property     | Value                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type**     | Comma-separated URL origin list                                                                                                                                                                                              |
| **Required** | Multiple hosted frontends                                                                                                                                                                                                    |
| **Default**  | The single `API_ORIGIN` value                                                                                                                                                                                                |
| **Example**  | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,https://dotify-test01.app.dot.li,https://dotify-test01.dot,polkadot://dotify-test01.dot,polkadot://app.dotify-test01.dot` |

Exact frontend origins accepted by backend CORS. When set, it takes precedence
over `API_ORIGIN`. Do not use `*`: the API carries authenticated upload and
content-key routes.

The Product Host execution origins are distinct from the public DotNS URL, so
`https://dotify-test01.dev-dot.li`, `https://dotify-test01.app.dev-dot.li`,
`https://dotify-test01.app.dot.li`, `https://dotify-test01.dot`, and
`polkadot://dotify-test01.dot` must be present when observed. Do not replace
the canonical `VITE_PUBLIC_APP_URL` with a host
execution origin.

On Fly, keep this value in `services/api/fly.toml`. Do not define
`API_ORIGINS` as a Fly secret: secrets override `[env]` values and can leave
the live API using a stale origin list after redeploy.

---

### `PASEO_ASSET_HUB_RPC`

| Property     | Value        |
| ------------ | ------------ |
| **Type**     | HTTP URL     |
| **Required** | Key requests |
| **Default**  | None         |

Paseo Asset Hub EVM RPC used by the backend to verify track access before
delivering content keys and to advance the catalog read model. If unavailable,
key delivery fails closed and the catalog API reports `rpc-outage` while serving
its last snapshot when available.

---

### `DOTIFY_FACTORY_ADDRESS`

| Property     | Value       |
| ------------ | ----------- |
| **Type**     | EVM address |
| **Required** | No          |
| **Default**  | None        |

Deployed `ArtistRuntimeFactory` address. Stored for deployment context.

---

### `DOTIFY_DIRECTORY_ADDRESS`

| Property     | Value        |
| ------------ | ------------ |
| **Type**     | EVM address  |
| **Required** | Key requests |
| **Default**  | None         |

Deployed `ArtistDirectory` address used to resolve artist runtimes.

---

### `DOTIFY_CHAIN_ID`

| Property     | Value       |
| ------------ | ----------- |
| **Type**     | Integer     |
| **Required** | No          |
| **Default**  | `420420417` |

Expected chain ID in wallet-signed content-key requests.

---

### `CATALOG_SNAPSHOT_PATH`

| Property     | Value                  |
| ------------ | ---------------------- |
| **Type**     | File path              |
| **Required** | Catalog API production |
| **Default**  | `.data/catalog.json`   |

Atomic catalog snapshot path. Mount it on durable storage in production. It is
a single-writer file and must not be shared by concurrent API writers.

---

### `CATALOG_POLL_INTERVAL_MS`

| Property     | Value      |
| ------------ | ---------- |
| **Type**     | Integer ms |
| **Required** | No         |
| **Default**  | `10000`    |

Interval for polling confirmed ArtistDirectory and SmartRuntime catalog events.

---

### `CATALOG_RECONCILE_INTERVAL_MS`

| Property     | Value      |
| ------------ | ---------- |
| **Type**     | Integer ms |
| **Required** | No         |
| **Default**  | `300000`   |

Interval for deterministic full-state reconciliation against the directory,
track records, and royalty splits.

---

### `CATALOG_STALE_AFTER_MS`

| Property     | Value      |
| ------------ | ---------- |
| **Type**     | Integer ms |
| **Required** | No         |
| **Default**  | `60000`    |

Snapshot age after which the API reports `stale-cache`.

---

### `CATALOG_CONFIRMATIONS`

| Property     | Value   |
| ------------ | ------- |
| **Type**     | Integer |
| **Required** | No      |
| **Default**  | `2`     |

Number of chain-head blocks held back before catalog events are indexed.

---

### `CONTENT_KEY_MASTER_SECRET`

| Property     | Value                                         |
| ------------ | --------------------------------------------- |
| **Type**     | 32+ byte hex string                           |
| **Required** | Server-side audio encryption and key delivery |
| **Default**  | None                                          |

Backend-only master secret used to derive per-track AES-256-GCM content keys.
Never expose this value to the frontend.

---

### `PINATA_JWT`

| Property     | Value               |
| ------------ | ------------------- |
| **Type**     | JWT string          |
| **Required** | Server-side uploads |
| **Default**  | None                |

Backend-only Pinata token for IPFS uploads.

---

### `TURN_URLS`

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| **Type**     | Comma-separated `turn:` / `turns:` list |
| **Required** | Reliable production rooms               |
| **Default**  | None                                    |

Public TURN relay URLs returned by `GET /api/turn/grant`, for example
`turn:turn.example.org:3478?transport=udp,turns:turn.example.org:443?transport=tcp`.
This value is not secret, but it belongs on the API because the recommended
credential path is server-minted.

---

### `TURN_REST_SECRET`

| Property     | Value              |
| ------------ | ------------------ |
| **Type**     | Shared HMAC secret |
| **Required** | Production TURN    |
| **Default**  | None               |

Backend-only secret shared with the TURN relay's REST authentication mechanism
such as Coturn `static-auth-secret`. Dotify returns a short-lived username and
HMAC-SHA1 credential from `/api/turn/grant`; it never returns this secret.

---

### `TURN_USERNAME`, `TURN_CREDENTIAL`

| Property     | Value                         |
| ------------ | ----------------------------- |
| **Type**     | Static TURN username/password |
| **Required** | No                            |
| **Default**  | None                          |

Fallback for rotated DevNet/static TURN credentials when `TURN_REST_SECRET` is
not available. Prefer `TURN_REST_SECRET` for production because static
credentials are replayable until rotated.

---

### `TURN_TTL_SECONDS`

| Property     | Value           |
| ------------ | --------------- |
| **Type**     | Integer seconds |
| **Required** | No              |
| **Default**  | `3600`          |

Lifetime used for `/api/turn/grant` responses. REST-mode credentials are
embedded with this expiry in the username; static-mode credentials use it only
as the client cache lifetime.

---

## Contract deployment variables

Set `PRIVATE_KEY` via Hardhat vars, not in `.env`. `ETH_RPC_HTTP` and
`SKIP_VERIFY` are read from `contracts/evm/.env`.

### `PRIVATE_KEY`

| Property     | Value                              |
| ------------ | ---------------------------------- |
| **Type**     | Hex private key                    |
| **Required** | Testnet/mainnet deployment         |
| **Set via**  | `npx hardhat vars set PRIVATE_KEY` |

EVM private key for the deployer account. Never commit this value.

---

### `ETH_RPC_HTTP`

| Property     | Value                   |
| ------------ | ----------------------- |
| **Type**     | HTTP URL                |
| **Required** | No                      |
| **Default**  | `http://127.0.0.1:8545` |

EVM RPC endpoint used by Hardhat.

---

### `SKIP_VERIFY`

| Property     | Value      |
| ------------ | ---------- |
| **Type**     | `0` or `1` |
| **Required** | No         |
| **Default**  | `0`        |

Set to `1` to skip Blockscout verification after deployment.
