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