# Publication and room follow-up — 2026-10-11

Owner-reported acceptance gaps on published Product 0.1.47.

GitHub issue: #269.

Priority: P1. Track: Production spine. Phase: Now. Type: Work.

## Scope

- Reconcile an approved publication until the exact runtime/hash is visible,
  with fresh reads and a read-only retry that never submits another release.
- Navigate from the artist space to listening inside the running app, including
  Product Hosts, without a document reload.
- Bound cover gateway stalls, reuse immutable artwork in a bounded browser
  cache, and preserve responsive widths and public-only asset boundaries.
- Automatically bind a connected host's authenticated account to room tips;
  warn an unconnected host at room creation about foregoing an eligible share.
- Route unclaimed host shares through the artist's existing rights split and
  announce finalized EVM/native Product tips through verified room receipts.
- Keep queue search quiet until text is entered or Browse is explicitly chosen.
- Allow the original artist to correct title, story and editorial metadata via
  an owner-approved registry update without changing audio, access or royalties.

## Acceptance and operations

Test delayed index convergence, runtime/hash collisions, Product navigation,
gateway stalls/cache bounds, account and room reconnect races, unbound-host
quotes, native receipt rejection and deduplication, and authorization/invariant
checks for release edits. API/signaling/frontend changes ship together. Metadata
editing requires the new registry selector on an artist runtime; old runtimes
must show an honest upgrade requirement. No live contract upgrade or data reset
is implicit in this implementation. Physical Desktop/mobile and guest audible
room evidence remain W13 release gates.

## Implementation evidence

Local checks on 2026-10-11: 879 frontend unit tests, 88 signaling tests,
169 API tests and 74 contract tests passed. The 44 artist-publication and room
workspace browser scenarios passed, including delayed catalog convergence
without another registration, in-document listener navigation, empty queue
search and explicit Browse. Typechecks, ordinary/Product builds, formatting,
backlog validation and whitespace checks passed. Lint reports only the two
existing `App.tsx` dependency warnings.

The contract tests install the additive facet locally and prove original-artist
authorization, compare-and-swap rejection and preservation of all other track
fields, token ownership, purchased access and royalty split. Artwork tests
prove response-type and size limits, in-flight reuse, body-stall gateway hedging
and eviction. Native notification tests reject wrong chain/hash/block/status
and duplicate announcements. A server-only credential isolates bounded
signaling receipt traffic from the public per-IP quota; spoofing never obtains
that service bucket. Approved publication recovery survives a wallet disconnect
without submitting another registration. These are local checks, not live deployment or
physical Host evidence. Keep issue #269 open through coordinated rollout and
metadata upgrade verification.
