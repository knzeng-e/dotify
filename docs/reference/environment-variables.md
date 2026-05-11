# Environment Variables Reference

All environment variables for the Dotify web app (`Dotify/web/`) and the signaling server. Copy `.env.example` and fill in the values for your environment.

---

## Web app variables (`VITE_` prefix)

Variables prefixed with `VITE_` are bundled into the browser. Do not put secrets that must remain server-side here.

### `VITE_SIGNAL_URL`

| Property | Value |
|---|---|
| **Type** | URL string |
| **Required** | No |
| **Default** | `http://localhost:8788` (dev) or same host on port 8788 |
| **Example** | `https://signal.example.com` |

The URL of the Socket.IO signaling server. Used by `useSession` to establish WebSocket connection for room management and WebRTC handshake relay.

In production, this must be a publicly reachable HTTPS endpoint.

---

### `VITE_BULLETIN_WS_URL`

| Property | Value |
|---|---|
| **Type** | WebSocket URL |
| **Required** | No |
| **Default** | `wss://paseo-bulletin-rpc.polkadot.io` |
| **Example** | `wss://paseo-bulletin-rpc.polkadot.io` |

WebSocket RPC endpoint for the Polkadot Bulletin Chain. Used by `useBulletin` to submit `TransactionStorage` extrinsics when an artist enables Bulletin archival.

---

### `VITE_LOCAL_WS_URL`

| Property | Value |
|---|---|
| **Type** | WebSocket URL |
| **Required** | No |
| **Default** | `ws://localhost:9944` |

Local Substrate node WebSocket endpoint. Used during local development to connect PAPI to a local chain node instead of Paseo.

---

### `VITE_LOCAL_ETH_RPC_URL`

| Property | Value |
|---|---|
| **Type** | HTTP URL |
| **Required** | No |
| **Default** | `http://localhost:8545` |

Local EVM JSON-RPC endpoint. Used when `config/network.ts` detects a local development environment and routes contract calls to the local node.

---

### `VITE_PINATA_JWT`

| Property | Value |
|---|---|
| **Type** | JWT string |
| **Required** | Yes (for uploads) |
| **Default** | None |
| **Security** | Exposed in the browser bundle. Use a restricted Pinata API key scoped to `pinFileToIPFS` only. |

Bearer token for the Pinata IPFS pinning API. Used by `services/pinata.ts` for audio, cover, and metadata uploads.

Create a restricted API key in the [Pinata dashboard](https://app.pinata.cloud/keys) with only `pinFileToIPFS` permission. A leaked key can incur upload costs on your account but cannot delete existing pins if the key has no delete permission.

---

### `VITE_PINATA_GATEWAY`

| Property | Value |
|---|---|
| **Type** | URL string |
| **Required** | No |
| **Default** | `https://paseo-ipfs.polkadot.io` |
| **Example** | `https://gateway.pinata.cloud` |

Primary IPFS gateway for fetching audio, cover images, and metadata. The gateway is tried first; if the request fails, `VITE_IPFS_READ_GATEWAYS` fallbacks are tried in order.

---

### `VITE_IPFS_READ_GATEWAYS`

| Property | Value |
|---|---|
| **Type** | Comma-separated URL list |
| **Required** | No |
| **Default** | `https://paseo-ipfs.polkadot.io,https://ipfs.io,https://dweb.link` |

Ordered list of fallback IPFS gateways. If the primary gateway (`VITE_PINATA_GATEWAY`) fails, `fetchIpfsCid()` tries each gateway in this list until a successful response is received.

---

### `VITE_CONTENT_SECRET`

| Property | Value |
|---|---|
| **Type** | 32-byte hex string |
| **Required** | No |
| **Default** | None (encryption disabled or uses a fixed demo key) |
| **Security** | Exposed in the browser bundle. This is demo-grade protection only. |
| **Example** | `a3f1...` (64 hex characters) |

Input to AES-256-GCM key derivation for audio encryption and decryption. All tracks encrypted with the same secret share the same key derivation root (though each track uses the content hash as a per-track salt, producing different keys per track).

Do not use a production secret here — a determined attacker can extract it from the browser bundle.

---

## Signaling server variables (Node.js only)

These variables are read by the signaling server process (`server/signaling.mjs`) and are never sent to the browser.

### `SIGNAL_PORT`

| Property | Value |
|---|---|
| **Type** | Integer |
| **Required** | No |
| **Default** | `8788` |

TCP port the Socket.IO server listens on.

---

### `SIGNAL_HOST`

| Property | Value |
|---|---|
| **Type** | String |
| **Required** | No |
| **Default** | `0.0.0.0` |

Network interface to bind. Set to `127.0.0.1` to restrict to localhost (useful when behind a reverse proxy).

---

### `SIGNAL_ORIGIN`

| Property | Value |
|---|---|
| **Type** | URL or `*` |
| **Required** | No |
| **Default** | `http://localhost:5273` |
| **Example** | `https://dotify.dot.li` |

CORS allowed origin for Socket.IO connections. In production, set this to the exact origin of your deployed frontend. Using `*` allows connections from any origin.

---

### `BULLETIN_ACCOUNT`

| Property | Value |
|---|---|
| **Type** | String |
| **Required** | No |
| **Default** | `Alice` |

Dev account name used for Bulletin Chain uploads when no wallet signer is available (local development / CI only). Valid values: `Alice`, `Bob`, `Charlie`, `Dave`, `Eve`, `Ferdie`.

Never set this in a production environment. Bulletin uploads in production must use the connected wallet's Substrate signer.

---

## Contract deployment variables

Set via Hardhat vars (`npx hardhat vars set`), not in `.env`. Used only during contract deployment and verification.

### `PRIVATE_KEY`

| Property | Value |
|---|---|
| **Type** | Hex private key |
| **Required** | Yes (testnet/mainnet deployment) |
| **Set via** | `npx hardhat vars set PRIVATE_KEY` |

EVM private key for the deployer account. Must hold sufficient DOT (as native EVM token on Asset Hub) to pay deployment gas fees.

Never commit this value to source control.

---

### `ETH_RPC_HTTP`

| Property | Value |
|---|---|
| **Type** | HTTP URL |
| **Required** | No |
| **Default** | `http://127.0.0.1:8545` |

Overrides the EVM RPC endpoint used by Hardhat scripts (`contracts/evm/.env`). Set to the Paseo Asset Hub EVM endpoint for testnet deployments.

---

### `SKIP_VERIFY`

| Property | Value |
|---|---|
| **Type** | `0` or `1` |
| **Required** | No |
| **Default** | `0` |

Set to `1` to skip Blockscout contract verification after deployment. Useful during rapid iteration where verification is not needed.
