# 01 — Backend key service skeleton

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Create a minimal backend service that becomes the production boundary for upload orchestration, content-key delivery, health checks, and future WebAuthn support.

Dotify must stop treating the browser as a trusted runtime for production-sensitive operations.

## Context
The current frontend is React/Vite and talks directly to Pinata, IPFS gateways, Paseo Bulletin, and Paseo Asset Hub EVM. This is acceptable for a demo, but production requires a backend boundary for secrets, upload tokens, key custody, observability, and wallet-authenticated access checks.

## Scope
Create a backend package under `server/` or `services/api/`.

Recommended stack:

- Node.js 22
- TypeScript
- Fastify or NestJS; prefer Fastify for a lean first implementation unless the repo is intentionally moving to NestJS
- Zod or Valibot for request validation
- viem for EVM reads
- structured logs

## Required endpoints

```txt
GET  /health
GET  /version
POST /api/auth/nonce
POST /api/tracks/:contentHash/key-request
```

This ticket only builds the skeleton. Key delivery may be implemented in Ticket 03.

## Required architecture

```txt
services/api/
  src/
    index.ts
    config.ts
    logger.ts
    routes/
      health.ts
      auth.ts
      keys.ts
    services/
      chainAccess.ts
      keyVault.ts
      signatures.ts
    types/
  package.json
  tsconfig.json
```

## Engineering requirements

- Do not store private keys in source code.
- Do not read production secrets from Vite variables.
- Validate all inputs.
- Add explicit CORS configuration.
- Add rate-limit hook placeholder, even if disabled in local dev.
- Add typed environment config with fail-fast startup.
- Include `.env.example` for the backend.
- Add `npm run dev`, `npm run build`, and `npm run typecheck`.

## Environment variables

```txt
API_PORT=8790
API_ORIGIN=http://localhost:5273
PASEO_ASSET_HUB_RPC=https://eth-rpc-testnet.polkadot.io/
DOTIFY_FACTORY_ADDRESS=
DOTIFY_DIRECTORY_ADDRESS=
DOTIFY_CHAIN_ID=420420417
CONTENT_KEY_MASTER_SECRET=
```

`CONTENT_KEY_MASTER_SECRET` must never be bundled into frontend assets.

## Acceptance criteria

- Backend starts locally with `npm run dev`.
- `/health` returns status, uptime, and version.
- `/version` returns commit or package version if available.
- Invalid env config fails startup with clear errors.
- Frontend can be configured with `VITE_DOTIFY_API_URL` without breaking current local flow.
- No production secret is added to frontend code.

## Non-goals

- Do not implement full upload pipeline here.
- Do not implement full key delivery here.
- Do not refactor the entire frontend here.

## Senior-engineer notes

Keep the service boring. The backend is not the product; it is the security boundary. Favor explicitness, typed errors, and small modules over clever abstractions.
