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

| Surface | Host | App/project | Source config | Purpose |
| --- | --- | --- | --- | --- |
| Frontend | Netlify | `muzinga` | `netlify.toml` | Static Vite web app |
| Product frontend | Bulletin + DotNS | `dotify-test01.dot` | `web/.env.product-devnet`, `web/polkadot-app-deploy.config.ts` | Product-host static app |
| Backend API | Fly.io | `dotify-api` | `services/api/fly.toml` | Uploads, key delivery, catalog read model, health |
| Signaling | Fly.io | `dotify-signal` | `web/fly.signal.toml` | Socket.IO room discovery and WebRTC signaling |

Production URLs currently assumed by the app and docs:

```txt
Standalone:          https://muzinga.netlify.app
Product public URL:  https://dotify-test01.dev-dot.li
Product Host origin: https://dotify-test01.app.dev-dot.li
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
Allow both; keep `VITE_PUBLIC_APP_URL` on the public URL so shared room links do
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

| Setting | Value |
| --- | --- |
| Base directory | `web` |
| Build command | `npm run build` |
| Publish directory | `web/dist` in the UI, equivalent to `dist` relative to `base = "web"` |
| Node version | `22` |

Required production variables:

| Key | Value | Notes |
| --- | --- | --- |
| `VITE_DOTIFY_DEPLOYMENT` | `production` | Enables fail-closed production env validation. |
| `VITE_DOTIFY_HOST_MODE` | `off` | Prevents the standalone build from probing Product host APIs. |
| `VITE_SIGNAL_URL` | `https://dotify-signal.fly.dev` | Public Socket.IO signaling origin. |
| `VITE_DOTIFY_API_URL` | `https://dotify-api.fly.dev` | Backend API for uploads, key delivery, and cached catalog reads. |
| `VITE_PINATA_GATEWAY` | `https://paseo-ipfs.polkadot.io` | Primary browser read gateway. |
| `VITE_IPFS_READ_GATEWAYS` | `https://paseo-ipfs.polkadot.io,https://ipfs.io,https://dweb.link` | Ordered fallback gateway list. |

Optional production variables:

| Key | When to set |
| --- | --- |
| `VITE_DOTIFY_DEBUG_PANEL=true` | Temporary operator smoke checks under `You -> Production readiness`; unset for ordinary listener deployments. |
| `VITE_TURN_URL` | Reliable WebRTC rooms across restrictive NATs. |
| `VITE_TURN_USERNAME` | Required with TURN credentials. |
| `VITE_TURN_CREDENTIAL` | Required with TURN credentials. |
| `VITE_ETH_RPC_URL` | Override the default Paseo Asset Hub EVM RPC. Must be HTTPS in production. |
| `VITE_WS_URL` | Override the default Polkadot WebSocket RPC. Must be WSS in production. |
| `VITE_BULLETIN_WS_URL` | Override the default Paseo Bulletin RPC. Must be WSS in production. |
| `VITE_BLOCKSCOUT_BASE_URL` | Override explorer links. Must be HTTPS in production. |

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

| Key | Current value |
| --- | --- |
| `VITE_DOTIFY_DEPLOYMENT` | `production` |
| `VITE_DOTIFY_HOST_MODE` | `required` |
| `VITE_DOTIFY_PRODUCT_ID` | `dotify-test01.dot` |
| `VITE_PUBLIC_APP_URL` | `https://dotify-test01.dev-dot.li` |
| `VITE_DOTIFY_API_URL` | `https://dotify-api.fly.dev` |
| `VITE_SIGNAL_URL` | `https://dotify-signal.fly.dev` |
| `VITE_DOTIFY_ROOM_BEACONS` | `off` |
| `VITE_PINATA_GATEWAY` | `https://ipfs.io` |
| `VITE_IPFS_READ_GATEWAYS` | `https://ipfs.io,https://dweb.link,https://devnet-ipfs.api.polkadotcommunity.foundation,https://bulletin-kubo.tservices.es:9443` |

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

Build and publication:

```bash
cd web
read -rs MNEMONIC
export MNEMONIC
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

| Key | Current value |
| --- | --- |
| `API_PORT` | `8790` |
| `NODE_ENV` | `production` |
| `API_ORIGINS` | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,polkadot://app.dotify-test01.dot` |
| `PASEO_ASSET_HUB_RPC` | `https://eth-rpc-testnet.polkadot.io/` |
| `DOTIFY_FACTORY_ADDRESS` | `0xbd1a11cfce8b5ef7a37e507bc5109895f8f42a72` |
| `DOTIFY_DIRECTORY_ADDRESS` | `0xcf1534c6e2b0e43b9436c1e86a076466dc0f2108` |
| `DOTIFY_CHAIN_ID` | `420420417` |

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

| Secret | Required | Notes |
| --- | --- | --- |
| `PINATA_JWT` | Uploads | Backend-only Pinata token. Never expose in Netlify. |
| `CONTENT_KEY_MASTER_SECRET` | Audio upload and key delivery | 64+ hex chars, at least 32 random bytes. Do not rotate casually. |
| `GIT_COMMIT_SHA` | Optional | Set by CI/build automation when available; `/version` can fall back in dev checkouts. |

Catalog read-model variables:

| Key | Default | When to override |
| --- | --- | --- |
| `CATALOG_SNAPSHOT_PATH` | `.data/catalog.json` | Not required to boot. Set to a durable Fly volume path, such as `/data/catalog.json`, for production-grade catalog evidence. |
| `CATALOG_POLL_INTERVAL_MS` | `10000` | Change only when deliberately tuning chain polling. |
| `CATALOG_RECONCILE_INTERVAL_MS` | `300000` | Change only when deliberately tuning full reconciliation. |
| `CATALOG_STALE_AFTER_MS` | `60000` | Change only with an updated freshness expectation. |
| `CATALOG_CONFIRMATIONS` | `2` | Change only with an explicit reorg/finality tradeoff. |

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

### Backend Signature Schemes

No Netlify or Fly dashboard variable enables Product signatures. The API
accepts two explicit schemes on session sign-in and protected key requests:

| Scheme | Client | Required proof fields | Backend binding |
| --- | --- | --- | --- |
| `eip191` | Standalone EVM/passkey wallet path | `signature` | `viem.verifyMessage` against the requester H160 |
| `product-sr25519-v1` | Product-host app-scoped account path | `signature`, `productPublicKey` | sr25519 signature over the canonical Dotify message bytes, then Product public-key-to-H160 derivation matching the requester |

Unknown schemes fail at the API schema boundary. Product requests must still
pass the same nonce, chain, purpose, expiry, and `musicAccCanAccess` checks as
standalone requests. The Product frontend submits this proof shape only after
an explicit Product-host account connection; contract writes remain on the
standalone EVM/passkey signer path until the Product CDM transaction adapter has
real host-signed transaction evidence. Validate Product protected playback
through host smoke tests after each Product publication before treating Product
identity as production-ready for gated listening.

## Fly Signaling

Open app `dotify-signal`.

Non-secret runtime values are tracked in `web/fly.signal.toml`:

| Key | Current value |
| --- | --- |
| `SIGNAL_PORT` | `8788` |
| `SIGNAL_HOST` | `0.0.0.0` |
| `SIGNAL_ROOM_TTL_MS` | `21600000` |
| `SIGNAL_HOST_TIMEOUT_MS` | `120000` |
| `SIGNAL_MAX_LISTENERS` | `24` |
| `SIGNAL_ALLOW_MISSING_ORIGIN` | `true` |
| `SIGNAL_ORIGINS` | `https://muzinga.netlify.app,https://dotify-test01.dev-dot.li,https://dotify-test01.app.dev-dot.li,polkadot://app.dotify-test01.dot` |

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

The `app.dev-dot.li` origin is required for both services. If it is missing,
the Host shell still renders the static app, but catalog requests lose their
CORS response header and Socket.IO polling is rejected with `403`, producing an
empty music view and preventing room creation.

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
npm run build:product-devnet
```

7. For a Product release, complete the cross-origin room and host-account
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

| If the change affects | Check/update |
| --- | --- |
| Any env var contract | `docs/reference/environment-variables.md`, relevant `.env.example`, this runbook |
| Netlify build or browser env | `netlify.toml`, `web/README.md`, this runbook |
| Backend API env, secrets, CORS, uploads, keys, catalog | `services/api/.env.example`, `services/api/fly.toml`, this runbook |
| Signaling env, room limits, origin policy, scaling | `web/.env.example`, `web/fly.signal.toml`, `web/README.md`, this runbook |
| Public URLs, contract addresses, production priorities, or architecture narrative | `README.md`; update `docs/index.html` only when the public project page should change |
| Security boundary | relevant threat model or explanation doc plus this runbook |
| PR validation process | `.github/pull_request_template.md` if the checklist itself changes |

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
