# Environment Variables Reference

All environment variables for the Dotify web app, signaling server, backend API,
and EVM deployment scripts. Copy the relevant `.env.example` file and fill in
values for your environment.

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

---

### `VITE_DOTIFY_DEBUG_PANEL`

| Property     | Value             |
| ------------ | ----------------- |
| **Type**     | Boolean string    |
| **Required** | No                |
| **Default**  | `false`           |
| **Example**  | `true`            |

Enables the optional Production readiness panel under the `You` tab. The panel
performs read-only checks for the backend readiness endpoint, signaling health,
chain RPC, configured factory/directory contract code, wallet-chain mismatch,
catalog status, and IPFS gateway reads. Leave this unset for ordinary listener
deployments unless operators need in-app diagnostics.

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
requests. When unset, the web app falls back to local/demo browser-side Pinata
upload and `VITE_CONTENT_SECRET` encryption.

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

---

### `VITE_IPFS_READ_GATEWAYS`

| Property     | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| **Type**     | Comma-separated URL list                                           |
| **Required** | No                                                                 |
| **Default**  | `https://paseo-ipfs.polkadot.io,https://ipfs.io,https://dweb.link` |

Fallback IPFS gateways tried after `VITE_PINATA_GATEWAY`.

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

| Property     | Value                             |
| ------------ | --------------------------------- |
| **Type**     | TURN URL and optional credentials |
| **Required** | Recommended for production rooms  |
| **Default**  | None                              |

Optional TURN relay configuration for WebRTC rooms. Without TURN, STUN-only
connections can fail behind symmetric NATs and some corporate firewalls.

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

| Property     | Value                                               |
| ------------ | --------------------------------------------------- |
| **Type**     | Comma-separated URL list or `*`                     |
| **Required** | No                                                  |
| **Default**  | `*`                                                 |
| **Example**  | `https://muzinga.netlify.app,https://dotify.dot.li` |

CORS allowed origins for Socket.IO and status endpoints. Set explicit frontend
origins in production. `SIGNAL_ORIGIN` is still accepted as a backwards-compatible
singular alias.

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

Frontend origin allowed by backend CORS.

---

### `PASEO_ASSET_HUB_RPC`

| Property     | Value        |
| ------------ | ------------ |
| **Type**     | HTTP URL     |
| **Required** | Key requests |
| **Default**  | None         |

Paseo Asset Hub EVM RPC used by the backend to verify track access before
delivering content keys. If unavailable, key delivery fails closed.

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
