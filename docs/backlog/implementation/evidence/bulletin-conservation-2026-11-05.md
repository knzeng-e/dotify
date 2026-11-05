# Read-only Bulletin conservation — 2026-11-05

Partial W33/#288. The [operator command](../../../operations/bulletin-conservation.md)
checks a reviewed explicit dependency plan at one finalized block, independently
of account authorization and quota. It cannot sign, store, renew, change admission
or load a custody seed/profile. No monitoring schedule or alert destination is
activated. [Structured live evidence](bulletin-conservation-2026-11-05.json)
contains public metadata only.

The controlled live check of **all 20 outer dependencies of Product 0.1.73**
reports **warning** at finalized block **1,511,018**: every declared block is
retained, but the oldest reused child expires at **1,532,185**, within the explicit
25,000-block warning window. The account expires independently at **1,621,405**;
quota covers the declared conservative **311-renewal / 93,634,213-byte floor**.
Critical threshold is 5,000 blocks. This is not a calendar-date prediction.
No renewal, nonce/balance lookup, payload retrieval or signature occurs.

Product includes CAR chunks above 512 KiB, so the assessment's explicit metadata
bound is **1 MiB per declared block**. The captured-runtime regression exercises
a 700,000-byte SHA-256 Product entry alongside BLAKE2b media. Existing media
payload-reader/writer limits are unchanged.

The sixteen focused tests cover child-vs-root expiry, shared-CID size consistency,
account expiry independently of retention, both quota counters, expired/missing/
unknown/invalid metadata, wrong identity, single-finalized-head reads, SHA-256 and
BLAKE2b codec/hash agreement, cancellation, and CLI exit/privacy/file-permission
boundaries. The full API suite passes **341 tests**; typecheck and API build pass.
Backlog-manifest and whitespace checks pass.

This small live inventory intentionally does not claim all historical app/lab/
media obligations. Reconcile those inventories before activating alerts or a
writer; do not lower an older reserve because it is absent here. Recurring bounded
renewal, live payload availability, coherent off-volume key/data restoration,
representative costs and wider artist admission remain separate production gates.
