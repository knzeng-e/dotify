# Listening authorization and Room signaling hardening

GitHub: #431. Priority: P1. Track: Production spine. Phase: Now. Type: Work.
Status: server fixes [deployed on 14 November](implementation/evidence/service-security-rollout-2026-11-14.md);
post-delivery physical Host and sustained-load acceptance remain open.

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

The [Socket.IO reference](../reference/socket-events.md#negotiation-limits)
defines per-socket relay budgets, message shapes and browser pending ICE bounds.
Membership/roles still decide routing; a budget never grants permission.
Leaving/rejoining does not reset it. Higher-capacity or extreme-network
acceptance remains separate; dropping excess negotiation can require reconnect.

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
The original review’s `npm audit --omit=dev` reported zero Web findings and one API high advisory
(Zod 3). [#432](api-schema-security-migration.md) records the real Zod 4 migration.
The [HTTP reference](../reference/request-limits.md) defines structural and byte
limits, the 413 response and the raw proxy exemption. Private schemas and
journals are not rewritten.

## Acceptance and evidence

Regression cases cover logout/expiry during access reads, stale batch grants,
late response/error parsing, cross-tab replacement before prepared-cache hits,
malformed envelopes/coercion/acknowledgements preserving existing Rooms, and
independent negotiation budgets/finite candidate storage. Existing paid/free,
anonymous joining and real WebRTC tests must remain green.

[Review and validation record](implementation/evidence/listening-security-review-2026-11-11.md).
The review is bounded to key-delivery/session and Room signaling/audio lifecycle
paths. It includes a production-dependency advisory scan, but is not a contract-economics
or cryptography certification or an exhaustive repository audit. The separate
server delivery is linked above; physical Host and sustained-load acceptance
remain distinct from local tests and service health.
