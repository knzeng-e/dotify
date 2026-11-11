# Listening authorization and Room signaling hardening

GitHub: #431. Priority: P1. Track: Production spine. Phase: Now. Type: Work.
Status: code candidate; production remains unchanged.

## Outcome and philosophical boundary

A requested independent review found existing races at key-delivery boundaries
and malformed-input/resource failures in signaling. Fixing these supports artist
control and shared presence: disconnect stays authoritative, guests can still
join without wallets, and Room listeners never receive content keys. Free
listening stays free. No tokenomics, payment, new media format or UI expansion
is introduced.

## Confirmed findings and fixes

- **P1 — signaling process termination:** malformed HTTP Host/request targets
  and non-object Socket.IO payloads could throw outside validation. Parse HTTP
  routing against a constant base with refusal for invalid targets. Validate
  object-event envelopes and acknowledgement types before Room mutation. Keep
  intentional nullable track/player state and array lineup protocols.
- **P2 — session/key races:** a single-track request could outlive revocation;
  delayed renewable errors could restart a disconnected identity or clear a
  replacement session. Reverify the server session after access reads; enforce
  the same client generation and exact token before cache use, after response/
  error parsing and before retry/state mutation. A legitimate live session can
  still renew once, with no per-track wallet authorization.
- **P2 — stale batch verdicts:** a fast result could expire while another track
  waited. Check validity immediately before derivation and return temporary
  denial without a key. Preserve the original grant expiry rather than extending
  it. Production grants use epoch milliseconds; optional expiry on uncached
  internal/test verdicts keeps its existing meaning.
- **P2 — negotiation resource abuse:** repeated readiness could continually
  rebuild host peers; descriptions, candidates and pre-description queues lacked
  independent limits. Apply per-socket budgets after membership/role checks and
  bound wire size/shape. Keep a finite browser queue, deduplicate and discard
  departed-listener entries.

## Limits and persistence

Signaling windows are 10 seconds per socket: four readiness relays, 128 SDP
messages, 1,024 candidates and 128 peer notices. SDP is at most 64 KiB UTF-8,
candidates 4,096 bytes, and target IDs 128 characters. Membership and host/listener
roles still decide routing; a budget never grants permission. Leaving/rejoining
a Room does not reset the budget, while disconnect cleans it up. These are
conservative service limits, not evidence of unlimited crowd capacity.

The browser retains at most 64 pending peer identities, 128 candidates per peer
and 512 total; known candidate fields only, bounded strings and no duplicates.
The current default Room capacity is 24 listeners. Higher capacity or extreme
network candidate counts need explicit load/compatibility acceptance. Dropping
excess negotiation protects the host but can require an explicit reconnect.

Session tokens remain in the existing identity cache; keys remain page-memory
only. No key format, secret, database schema, stored profile or encryption nonce
changes. The extra server session check is deliberate revocation enforcement,
not an extra chain lookup or wallet prompt. Batch chain checks remain parallel.

## Dependency remediation and remaining gate

Compatible lockfile updates patch Engine.IO, Fastify/multipart/URI handling,
sharp/libvips and Web build-tool leaves. Scoped Nano ID patches preserve v3 for
PostCSS and v5 for Host API; the scoped write-package/deepmerge v8 override is
covered by real async/sync package-update fixtures and PAPI CLI startup. Existing
SDK, signer and TrUAPI versions are unchanged.

[Development toolchain follow-up #433](tooling-security-migration.md) tracks
remaining Vitest/Tinypool and lint/parser majors; no claim of a clean full-dev audit.
Final `npm audit --omit=dev` reports zero Web findings and one API high advisory
(Zod 3). [#432](api-schema-security-migration.md) records the real Zod 4 migration.
Before route schema parsing, an iterative JSON budget bounds nodes (8,192), depth
(16), arrays (256), object fields (128), property names (256 code units) and
strings (64 Ki code units). Oversized input gets a constant typed 413 without issue
accumulation or reflected data. Raw proxy buffers/multipart retain their existing
paths and streaming limits; private schemas/journals are not rewritten.

## Acceptance and evidence

Regression cases cover logout/expiry during access reads, stale batch grants,
late response/error parsing, cross-tab replacement before prepared-cache hits,
malformed envelopes/coercion/acknowledgements preserving existing Rooms, and
independent negotiation budgets/finite candidate storage. Existing paid/free,
anonymous joining and real WebRTC tests must remain green.

[Review and validation record](implementation/evidence/listening-security-review-2026-11-11.md).
The review is bounded to key-delivery/session and Room signaling/audio lifecycle
paths. It includes a production-dependency advisory scan, but is not a contract-economics
or cryptography certification or an exhaustive repository audit. Deployment, physical Host and sustained load
acceptance remain separate from local tests. No production inspection, service
maintenance, image upload, real media publication or signing is performed here.
