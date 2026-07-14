# 10 — Observability and health checks

## Sprint
Sprint 2 — Product hardening and philosophical differentiation

## Priority
P1

## Objective
Add observability and runtime health checks so production failures become diagnosable instead of mystical.

## Scope
Cover frontend, backend, signaling server, IPFS gateway reads, and chain/runtime availability.

## Backend requirements

- `/health` endpoint with status, uptime, version.
- `/version` endpoint with package version and commit SHA if available.
- Structured logs.
- Request correlation IDs.
- Typed error responses.

## Signaling requirements

Expose health/status including:

- active rooms count;
- active peers count;
- uptime;
- configured allowed origin;
- optional room TTL config.

## Frontend requirements

- Add error boundary.
- Add user-facing toast/error system.
- Display chain ID mismatch clearly.
- Display RPC unavailable clearly.
- Display signaling unavailable clearly.
- Display IPFS gateway fallback failures clearly.
- Add optional debug panel gated by env flag.

## Chain/runtime checks

Add startup or diagnostic checks for:

- factory address availability;
- directory address availability;
- chain ID match;
- runtime lookup;
- `musicAccCanAccess` read failure;
- IPFS metadata fetch failure.

## Acceptance criteria

- A developer can determine whether a failure is frontend, backend, signaling, IPFS, wallet, or chain-related.
- No raw secrets are logged.
- User-facing messages avoid blockchain jargon where possible.
- README documents how to inspect health.

## Senior-engineer notes

Observability is compassion for your future self. In a system crossing browser, WebRTC, IPFS, EVM, and wallets, silence is not elegance; silence is technical debt wearing perfume.

## Delivery notes

First slice delivered (`feat/observability-health-checks`): backend and signaling observability.

- Key service diagnostics: new `services/diagnostics.ts` runs dependency checks with injectable deps and a 10s report cache: content-key master secret configured (boolean only), RPC reachable and chain ID matches `DOTIFY_CHAIN_ID`, artist directory readable (`artistCount`), factory contract code present, Pinata JWT configured. `ready` means the key-delivery spine can work (secret + RPC + directory); factory/Pinata failures only degrade `status`.
- Routes: `GET /health` (liveness, uptime, version), `GET /version` (version + commit SHA from `GIT_COMMIT_SHA` or `git rev-parse HEAD`), `GET /health/ready` (full diagnostics report, `503` when not ready). Route factory is dependency-injected for tests.
- Request correlation IDs: every response carries `x-request-id` (echoed from a well-formed incoming header, otherwise generated); the ID is the Fastify log correlation ID and appears in error bodies.
- Typed error envelope: `{ error, code, requestId }` from the global error and 404 handlers. Framework statuses are preserved (a rate-limit 429 or malformed-JSON 400 is no longer collapsed to 500). Handlers are registered before the route plugins because encapsulated Fastify scopes capture the handlers existing at registration time.
- Structured logs: pino redaction for `authorization`/`cookie` headers and `sessionToken`/`signature` body fields; redaction is a guardrail, secrets are still never logged deliberately.
- App assembly extracted to `src/app.ts` (`buildApp()`) so tests exercise the real wiring; `index.ts` only builds and listens.
- Signaling `/health` now echoes non-secret config: allowed origins, room TTL, host heartbeat timeout, per-room listener cap, plus room, in-room listener, active solo-listener counts, and uptime. `/status` also exposes the anonymous per-track solo-presence aggregate used by the listening UI.
- Tests: `routes/health.test.ts` (liveness, version, ready 200/503, no secret material) and `app.test.ts` (request-ID echo/generation, typed 404, preserved framework statuses); signaling health test added. README documents how to inspect health.

Still open in this ticket (next slices):

- Frontend: error boundary, user-facing error/toast system for chain-ID mismatch / RPC unavailable / signaling unavailable / IPFS gateway fallback failures, optional env-gated debug panel. The frontend can now consume `/health/ready` and the signaling `/health` for honest status display.
- Frontend chain/runtime startup diagnostics (factory/directory availability, runtime lookup, `musicAccCanAccess` read failure, IPFS metadata fetch failure surfacing).
