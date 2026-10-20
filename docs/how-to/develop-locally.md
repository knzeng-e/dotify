# Develop locally

This guide runs Web, signaling and the API from the repository. Use Node 22,
npm 10+, Git and a supported browser. The configured network is a testnet;
you do not need to run a local blockchain. Wallet writes still need the
appropriate test-network account and funds.

## 1. Install and configure

From the repository root:

```sh
npm ci --prefix web
npm ci --prefix services/api
cp web/.env.example web/.env.local
cp services/api/.env.example services/api/.env
```

Copy these files only on first setup; preserve an existing local configuration.
The frontend example already uses API port 8790 and signaling port 8788.

In `services/api/.env`, set `DOTIFY_FACTORY_ADDRESS` and
`DOTIFY_DIRECTORY_ADDRESS` from the matching `factory` and `directory` entries
in [deployments.json](../../deployments.json). Verify that the RPC and
`DOTIFY_CHAIN_ID` refer to that same network. Catalog indexing needs this
configuration and a reachable RPC.

For **your own local uploads**, configure a scoped `PINATA_JWT` and a fresh
server-only `CONTENT_KEY_MASTER_SECRET`. A locally generated secret cannot
decrypt releases encrypted by another API. To play those releases, use their
authorized service and origin configuration; do not copy production secrets
into a development checkout. Readiness can fail while basic process health
still passes when these capabilities are unconfigured.

Never put these secrets in `web/.env.local` or a `VITE_` variable. The checked-in
examples contain no usable credentials. Detailed variables and persistence
rules live in the [reference](../reference/environment-variables.md) and
[deployment guide](../operations/deployment-configuration.md).

## 2. Start the services

In one terminal, start the API from its directory so its local `.env` is read:

```sh
cd services/api
npm run dev
```

In another, start the frontend and signaling together:

```sh
cd web
npm run dev:listen
```

| Surface          | Address                              |
| ---------------- | ------------------------------------ |
| Music and rooms  | <http://localhost:5273>              |
| Artist studio    | <http://localhost:5273/artists>      |
| Signaling health | <http://localhost:8788/health>       |
| API health       | <http://localhost:8790/health>       |
| API readiness    | <http://localhost:8790/health/ready> |

Open the same room link in a second browser context to test guest entry. Keep
the host present. Independent networks may require configured TURN grants;
two local tabs do not validate mobile/carrier networking or physical audibility.
`/status` is not a public room directory; an empty `rooms` array there is expected.

## 3. Verify a change

From the repository root:

```sh
npm run test:unit --prefix web
npm run lint --prefix web
npm run build --prefix web
npm run test:signal --prefix web
npm test --prefix services/api
npm run typecheck --prefix services/api
```

Choose checks for the actual boundary changed. Contract work also needs the
tests and ABI-generation checks in [contracts/evm](../../contracts/README.md).
Documentation changes need link, image, formatting and offline backlog checks.

## Deterministic browser journeys

These are useful when you do not have a wallet, media service or test funds:

```sh
cd web
npx playwright install chromium
npm run test:e2e
```

Playwright supplies isolated test configuration and starts Vite/signaling at
ports 5274/8789. Existing fixtures replace chain/wallet responses and source
audio, while selected room tests use real local signaling and WebRTC. They are
not a deployment profile: never enable `VITE_E2E_*` in a published build.
See [Web verification](../../web/README.md#verification) for specialized suites.

## Troubleshooting

| Symptom                           | Check                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Catalog empty or unavailable      | API URL, configured directory, RPC availability, catalog status and startup indexing.               |
| Key service unavailable           | API readiness, server key configuration, wallet/network and release identity. Do not bypass denial. |
| Room connects but audio is silent | Local play/mute, browser media support, host access and WebRTC/TURN.                                |
| Port already in use               | Stop your previous local process; test suites need their configured ports free.                     |
| API fails after editing `.env`    | Keep values single-line and restart the service. This loader is not a shell.                        |

Publishing a build is a separate task. Follow the
[Web/API/signaling runbook](../operations/deployment-configuration.md) and
[Product runbook](../operations/product-devnet-deployment.md); the commands
above neither deploy services nor publish Product.
