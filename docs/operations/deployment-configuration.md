# Deployment Configuration Runbook

This runbook is the operator checklist for Dotify's hosted configuration across
Netlify and Fly.io. Use it when changing dashboard values, deploy contexts,
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
| Backend API | Fly.io | `dotify-api` | `services/api/fly.toml` | Uploads, key delivery, catalog read model, health |
| Signaling | Fly.io | `dotify-signal` | `web/fly.signal.toml` | Socket.IO room discovery and WebRTC signaling |

Production URLs currently assumed by the app and docs:

```txt
Frontend:       https://<netlify-or-custom-domain>
Backend API:    https://dotify-api.fly.dev
Signaling:      https://dotify-signal.fly.dev
IPFS gateway:   https://paseo-ipfs.polkadot.io
Asset Hub RPC:  https://eth-rpc-testnet.polkadot.io/
```

Use the exact current frontend origin for CORS and signaling origin values. Do
not include a trailing slash.

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
can allow multiple origins with `SIGNAL_ORIGINS`, but the backend API currently
accepts one `API_ORIGIN`. For PR evidence, use a stable frontend origin, a
dedicated staging site, or temporarily set `API_ORIGIN` to the deploy-preview
origin and restore it after validation.

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
| `PASEO_ASSET_HUB_RPC` | `https://eth-rpc-testnet.polkadot.io/` |
| `DOTIFY_FACTORY_ADDRESS` | `0xbd1a11cfce8b5ef7a37e507bc5109895f8f42a72` |
| `DOTIFY_DIRECTORY_ADDRESS` | `0xcf1534c6e2b0e43b9436c1e86a076466dc0f2108` |
| `DOTIFY_CHAIN_ID` | `420420417` |

Set server-side values in the app's Secrets area:

| Secret | Required | Notes |
| --- | --- | --- |
| `API_ORIGIN` | Production | Exact frontend origin allowed by API CORS. One URL only. |
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

Set hosted frontend origins in the app's Secrets area:

| Secret | Value |
| --- | --- |
| `SIGNAL_ORIGINS` | Exact comma-separated frontend origins, for example `https://muzinga.netlify.app,https://<deploy-preview-origin>` |

Keep `dotify-signal` on one active machine until a shared Socket.IO adapter is
added. Rooms, chat, reactions, request queues, and solo-presence aggregates are
currently in memory.

## Validation Checklist

After changing Netlify or Fly dashboard values:

1. Trigger a new Netlify deploy for frontend `VITE_*` changes.
2. Restart or redeploy the affected Fly app after secret/runtime changes if the
   platform did not already restart machines.
3. Confirm the backend:

```bash
curl -s https://dotify-api.fly.dev/health
curl -s https://dotify-api.fly.dev/health/ready
curl -s https://dotify-api.fly.dev/api/catalog
```

4. Confirm signaling:

```bash
curl -s https://dotify-signal.fly.dev/health
curl -s https://dotify-signal.fly.dev/status
```

5. Run local smoke checks when the repo is available:

```bash
cd web
npm run smoke:production-env
npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://<frontend-origin>
```

6. For explicit origin rejection evidence, include a denied origin:

```bash
cd web
npm run smoke:signal -- \
  --url https://dotify-signal.fly.dev \
  --origin https://<frontend-origin> \
  --denied-origin https://not-dotify.example
```

7. Attach evidence to the PR when the active ticket requires public validation.
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
