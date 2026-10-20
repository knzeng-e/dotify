# Dotify Web

The React, TypeScript and Vite client for shared listening. **Music**, **Rooms**
and **You** form the listener app; `/artists` opens the artist studio.

[Project overview](../README.md) ·
[Local setup](../docs/how-to/develop-locally.md) ·
[Documentation map](../docs/README.md)

## Run locally

Use Node 22 and npm 10+. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev:listen
```

The app runs at <http://localhost:5273>, the artist studio at
<http://localhost:5273/artists>, and signaling at <http://localhost:8788>.
This command does **not** start the API. The example configuration expects it
at port 8790; see the [complete setup](../docs/how-to/develop-locally.md).

Configuration has one [reference](../docs/reference/environment-variables.md).
The common entry points are:

| Setting                                          | Purpose                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `VITE_DOTIFY_API_URL`                            | Catalog, backend uploads and access-checked key requests.           |
| `VITE_SIGNAL_URL`                                | Room signaling and scoped discovery.                                |
| `VITE_DOTIFY_HOST_MODE`                          | Web versus Product Host integration. Ordinary local Web uses `off`. |
| `VITE_PINATA_GATEWAY`, `VITE_IPFS_READ_GATEWAYS` | Public asset and encrypted-byte reads.                              |

Every `VITE_` value is browser-visible. Keep Pinata credentials and content-key
secrets on the API. Browser-only upload/encryption fallback is local demo
behavior; production builds reject its secret variables.

## Find the code

| Path                                                  | What lives here                                             |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/`                                            | Shells, shared providers, routing and viewport behavior.    |
| `src/views/`, `src/components/`                       | Screens and reusable presentation.                          |
| `src/features/catalog/`, `player/`, `rooms/`          | Catalog, audio and room state/transport helpers.            |
| `src/features/artist-studio/`, `payments/`, `access/` | Publishing, contributions and access flows.                 |
| `src/features/runtime/`, `productHost/`               | Typed runtime and Host adapters.                            |
| `src/hooks/`, `src/services/`, `src/shared/`          | Orchestration, API clients, configuration and shared types. |
| `src/generated/contracts/`                            | Generated ABI bindings; do not edit by hand.                |
| `server/`                                             | Socket.IO signaling and its integration tests.              |
| `e2e/`                                                | Browser journeys, isolated fixtures and capture recipes.    |
| `scripts/`                                            | Build, deployment guards and evidence tools.                |

Use [architecture](../docs/explanation/architecture-overview.md) for the data
flow, [room mechanics](../docs/explanation/listening-rooms.md) for transport,
and the [key-delivery threat model](../docs/security/content-key-delivery-threat-model.md)
for trust boundaries. Current type definitions are in `src/shared/types.ts`;
contract bindings are generated with `npm run generate:abis` from `contracts/evm`.

## Verification

Run checks that match the changed boundary:

```sh
npm run fmt:check
npm run lint
npm run test:unit
npm run build
npm run test:signal
npm run test:e2e
npm run test:nearby
npm run test:audio-continuity
```

Playwright starts isolated local signaling/Vite servers. Its fixtures replace
wallets, chain responses and source audio where needed; they do not establish
funded payments, physical audibility or native Host compatibility. Install its
Chromium browser first with `npx playwright install chromium`.

Test services use ports 5274 and 8789. The specialized Nearby and audio suites
have their own configurations; run them sequentially to avoid port conflicts.
See [quality gates](../docs/operations/dev-quality-gates.md) and the
[pilot plan](../docs/operations/pilot-release-plan.md) for candidate-bound,
real-device evidence.

The README gallery is reproducible through the
[documentation capture recipe](../docs/images/release-preview/README.md).

## Build and publish

| Command                               | Result                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run build`                       | Ordinary Web build in `dist/`.                                                       |
| `npm run build:product-devnet:frozen` | Product package from the committed catalog snapshot; no catalog refresh.             |
| `npm run build:product-devnet`        | Product build that first refreshes its catalog bootstrap. Inspect generated changes. |
| `npm run build:bulletin`              | Separate single-file Bulletin build.                                                 |

A successful build does not publish anything. Web hosting, API/signaling
operation and Product publication have different configuration and rollback
boundaries:

- [Deployment configuration](../docs/operations/deployment-configuration.md)
- [Product build, publication and rollback](../docs/operations/product-devnet-deployment.md)
- [Environment variables](../docs/reference/environment-variables.md)

Use these runbooks rather than historical deploy snippets. Product publication
uses local operator authority and verified Host configuration; no signer is
needed for the frozen build or CI. Keep release-specific SHAs, CIDs, service
versions and device results in the dated rollout evidence.
