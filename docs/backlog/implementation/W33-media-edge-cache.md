# W33 - Serve encrypted media through a read-through edge cache

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W33** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/media-edge-cache` created from the latest tested `origin/dev`.
- Dependencies: W30. Refs #88 (this sequence makes the backend read-through decision).
- Release stage: Next (streaming experience track).
- Product purpose: listeners on several continents get the same fast start; a single public gateway is not on the critical path.

## Problem at audit

- DAV2 range reads go only to Pinata gateways, including the shared public gateway (`web/src/services/pinata.ts:142`).
- Range timeouts and full-file fallbacks were observed live (W19 recovery evidence, 2026-10-15).

## Outcome

The 2026-10-17 owner-feedback stabilization adds a bounded API ciphertext
read-through as an interim recovery path. See
[W08/W19 evidence](evidence/W08-W19-stability-2026-10-17.md). It does not complete
this sequence's provider decision, multi-region edge, pre-warming or latency
acceptance. Retain the remaining scope below.

1. **Decision record.** Compare at least two options (for example Cloudflare or Bunny in front of a dedicated gateway, versus a dedicated Pinata gateway alone) on latency from three regions, cost, range support, cache control, and operational burden. Choose one.
2. **Read-through cache.** Media objects are content-addressed and encrypted, so the edge caches `/ipfs/<cid>/...` as immutable. The cache never sees keys or plaintext and cannot serve different bytes for a CID without failing authentication in the client.
3. **Pre-warming.** After publication, the API requests the first segments (or first DAV2 chunks) through the edge.
4. **Client order.** Edge first, then the existing Pinata and IPFS fallbacks. IPFS stays the source of truth.
5. **Honest documentation.** Public docs say the edge is a cache that accelerates delivery and has no authority over access.

## 2026-10-22 execution note

The internal reset retired DAV2. This sequence now applies only to authenticated
v3 manifest/init/segment objects; no legacy range reader is restored. The API
read-through remains the fallback. The owner supplied an existing dedicated
Pinata gateway/CDN, selected by [ADR 0034](../../adr/0034-media-cdn-and-native-storage.md)
without creating another provider account. Prepared code and remaining
provider/three-region audible acceptance are recorded in [W33 evidence](evidence/W33.md).
Six authorized regional HTTP probes return API 200 and gateway 401. This is an
activation blocker, not a successful latency improvement or completed #288.

## Acceptance and meaningful verification

- Latency evidence (time to first byte and time to first sound) from at least three regions, before and after.
- Range requests, 404 handling, and fallback covered by gateway tests.
- No credential or token in cached URLs; cache keys exclude query strings carrying identity.
- Update `docs/operations/deployment-configuration.md` with configuration, cost limits, purge procedure, and rollback.

## Scope boundary

No change to encryption, access checks, or the streaming format. No account creation or spending without explicit owner authorization.

## Handoff

Write `docs/backlog/implementation/evidence/W33.md` using `evidence-template.md`.
