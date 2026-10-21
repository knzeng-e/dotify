# W30 - Harden the hosted services for the 42-person trusted pilot

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W30** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `fix/pilot-hardening` created from the latest tested `origin/dev`.
- Dependencies: W19 (merged by PR #283). Release gate: W13 trusted pilot.
- Release stage: Pilot blocker. It must be deployed before the 2026-10-17 trusted pilot starts.
- Source: architecture audit of `origin/dev` `9965862` on 2026-10-15 (owner session).
- Product purpose: about 42 trusted people on several continents must be able to open, join, and listen at the same time without hitting a shared limit or losing their session to a redeploy.

## Remaining process-hygiene slice, 2026-10-21

The earlier proxy, presence, session and catalog changes are already delivered.
The API non-root remainder is now implemented and locally rehearsed, separately
from the inactive W32 format foundation. See the [evidence](evidence/W30-api-nonroot-2026-10-21.md)
and [operator procedure](../../operations/api-nonroot-storage.md). No live
ownership migration or deployment has been performed by this slice; #285 stays
open for the operator window and acceptance readbacks.

## Outcome

The API and signaling service identify real clients behind the Fly proxy, stop broadcasting to every socket on every playback tick, keep sessions and the catalog across a redeploy, and bound the remaining unauthenticated abuse paths. No new service, store, or region is introduced.

## Findings this sequence resolves

| # | Finding | Location at audit |
| --- | --- | --- |
| 1 | Every host `player:state` (about 1 Hz) calls `emitRooms()`, which sends an always-empty `rooms:updated` list to every connected socket. | `web/server/signaling.mjs:798`, 12 call sites of `emitRooms` |
| 2 | `presence:solo` has no rate limit and triggers a global `io.emit` per change. | `web/server/signaling.mjs:463-475` |
| 3 | Fastify has no `trustProxy`; behind Fly the 100/min rate limit is likely keyed on the proxy address and therefore shared by every user. | `services/api/src/app.ts:55,68` |
| 4 | Signaling `clientKey` trusts the first `X-Forwarded-For` entry, which a client controls. `SIGNAL_TRUST_PROXY` is not set in the Fly config, so network limits may also be shared. | `web/server/signaling-utils.mjs:163-168`, `web/fly.signal.toml` |
| 5 | Room codes use `Math.random()`. Since rooms are link-only, the code is the only secret. | `web/server/signaling-utils.mjs:8` |
| 6 | `room:create` has no limiter and the room map has no cap; each creation can trigger RPC reads. | `web/server/signaling.mjs:490` |
| 7 | The catalog snapshot defaults to `.data/catalog.json`, outside the mounted volume, so a redeploy reindexes cold and key delivery fails closed meanwhile. | `services/api/src/config.ts:91`, `services/api/fly.toml` |
| 8 | The session epoch is random per process, so every redeploy signs everyone out (root cause of the stale host-tip session handled by #283). | `services/api/src/services/sessionTokens.ts:70` |
| 9 | Key responses carry no `Cache-Control: no-store`. | `services/api/src/routes/keys.ts:194,269,309` |
| 10 | The access-check viem transport uses library defaults (10 s timeout, 3 retries) in front of first sound. | `services/api/src/services/chainAccess.ts:177` |
| 11 | Both images run as root and start through `npm`, so SIGTERM is not forwarded for a graceful stop. | `services/api/Dockerfile`, `web/Dockerfile.signal` |

## Work sequence

1. **Real client identity.** Add an explicit API setting (for example `API_TRUST_PROXY=fly`) that reads `Fly-Client-IP` for the rate-limit key and request IP; default stays off for local use. In signaling, prefer `Fly-Client-IP`, otherwise the rightmost `X-Forwarded-For` hop, never the leftmost. Set the trust settings in both Fly configs. Keep per-client limits as they are.
2. **Signaling fan-out.** Remove the global `rooms:updated` broadcasts while still answering `rooms:list` with the legacy empty shape. Rate-limit `presence:solo` per socket and coalesce its broadcast to at most one aggregate per interval (for example 2 s), sent only when counts changed.
3. **Room codes and creation.** Generate codes with `crypto.randomInt`. Keep the current length and alphabet so existing links and QR codes keep working; record the length decision in the evidence. Add a per-network `room:create` limiter and a global room cap with an explicit `ROOMS_BUSY` reply that the client shows as a recoverable message.
4. **Catalog persistence.** Point `CATALOG_SNAPSHOT_PATH` at the mounted volume in `services/api/fly.toml`, and document it in `docs/operations/deployment-configuration.md`.
5. **Session continuity.** Accept an optional stable `SESSION_EPOCH`; keep the random epoch when it is unset. Persist revoked session IDs to the volume (bounded, pruned at expiry) so a stable epoch does not resurrect signed-out tokens after a restart. If the revocation file is unreadable at boot, fall back to a fresh random epoch (fail closed). Rotating `SESSION_EPOCH` remains the global sign-out.
6. **Key response headers.** Add `Cache-Control: no-store` to every content-key response (allowed, denied, and error).
7. **RPC bounds.** Configure the access-check transport with an explicit short timeout and one retry, plus an optional fallback RPC URL through viem `fallback()`.
8. **Process hygiene.** Run both images as `USER node`, start Node directly, and close the HTTP/Socket.IO servers on SIGTERM. Do not upgrade Node in this sequence unless a security advisory requires it; record the current version.
9. **Read-only operational checks** (owner runs or authorizes): exactly one signaling machine (`max_machines_running = 1` in `web/fly.signal.toml`), TURN grants returned by `/api/turn/grant` for a room member, and one logged request confirming the client address seen after the change.

## Acceptance and meaningful verification

- Unit tests: `Fly-Client-IP` and rightmost-hop keying; a spoofed leftmost `X-Forwarded-For` does not change the key; API rate limit keyed per client with the setting on.
- Signaling tests: `player:state` reaches only room members and causes no global emit; `presence:solo` bursts are limited and coalesced; `room:create` limit and room cap return explicit codes; room codes keep the existing format.
- API tests: sessions verify across a simulated restart with a stable epoch; a revoked token stays revoked after restart; an unreadable revocation file forces a fresh epoch; key responses carry `no-store`.
- Commands: `npm --prefix web run test:signal`, `npm --prefix web run test:unit`, `npm --prefix web run lint`, `npm --prefix web run build`, `npm --prefix services/api test`, `npm --prefix services/api run typecheck`, `npm --prefix services/api run build`, `cd web && npm run fmt`, `git diff --check`.
- Release notes list every new variable, its default, the deploy order (API, then signaling, then clients), and the rollback.

## Scope boundary

No Redis, Postgres, second machine, new region, streaming format change, or contract change. No deployment, secret change, or participant contact unless the owner authorizes it in the session. Client discovery follow-ups belong to W31.

## Release condition

Merged code is not a deployed fix. The pilot may start only after the owner deploys W30 and the read-only checks in step 9 are recorded.

## Handoff

Write `docs/backlog/implementation/evidence/W30.md` using `evidence-template.md`, including the base SHA, implementation SHA, PR, new configuration, verification results, and checks not run.
