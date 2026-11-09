# Approved publication and catalogue visibility, 2026-11-09

Refs #407. Follow-up in #413, prepared from tested dev `6fc81748` and combined
with its storage/deadline candidate `8d86d2aa`; not deployed. The 0.1.81 delivery
record remains in #412.

## Owner evidence

The owner confirms an existing Black Panther draft eventually registered,
appeared in Music and played audibly. Screenshots dated November 8 show an
**Attention / Catalog update delayed** modal with three completed steps, and
later a disabled **Publishing…** editor button. The owner asks for clearer artist
feedback. This confirms one completed journey; the supplied report does not
separately identify Web versus Desktop acceptance or validate the second artist.
The screenshot times are not a measured indexing-latency benchmark.

## Behavior and trust boundary

Registry approval and catalogue visibility are distinct facts. Only the existing
confirmed-transaction path starts reconciliation. The new
`publicationVisibility` feedback marker represents read-only work after that
approval, not a new payment or storage operation.

| State | Artist feedback and action |
| --- | --- |
| Preparing / awaiting wallet | Existing publication controls and failure handling |
| Approval confirmed, checking | Green approval icon, **Release approved**, final catalogue step still pending; **Check visibility** in the editor and modal |
| Catalogue takes longer | Calm confirmed-approval message, slower bounded checks; the same read-only action remains available |
| Exact active runtime/hash appears | **Release published**, completed roadmap and existing My releases handoff |

The first twelve reads use five-second intervals. Later reads use thirty-second
intervals, with at most twenty-eight automatic reads per cycle. Network latency
adds to these intervals; there is no promised completion time. A manual check
starts another bounded read cycle and preserves the delayed explanation. Held
reads cannot be duplicated by repeated clicks. After the automatic budget ends,
shared catalogue updates still complete the operation; manual checking also
remains available. No timer or check button calls upload/registry/payment code.

The underlying publication guard remains pending until visibility is observed,
preventing another registration. The editor's button explicitly switches to a
read-only handler, independently of write/approval busy state. Another artist
runtime's matching hash and inactive tracks cannot satisfy visibility. Generation
checks and one completion identity prevent stale reads or simultaneous global
updates from completing twice. Unrelated payment/recovery dialogs retain their
ownership; account switching and disconnect do not repeat a write or navigate
another artist away from their task. Closing the status retains the existing
reopenable operation summary.

This is client-session tracking. Reloading the whole app does not introduce a
new durable pending-registration journal in this candidate. Catalogue index
latency and Bulletin publication throughput are unchanged. Registered visibility
and successful owner listening are not proof of all access-denial/retention or
multi-client public-pilot gates.

## Validation and delivery

The isolated follow-up passes 1,107 frontend unit tests and 29 targeted real-browser
artist/review tests locally. Combined #413 validation is recorded in the PR. The latter exercise delayed insertion, unchanged upload/transaction
counts, pending and failed transaction distinctions, wrong-runtime collisions,
account changes, dialog ownership, single-flight checks, exhaustion of automatic
checks followed by a shared-catalogue update, and mobile/desktop navigation.
Ordinary Web build passes; final Product/lint/format and CI results are in the PR.

A matching Web/Product rollout is needed for physical acceptance of this
feedback. No API/signaling change, service maintenance, key, authorization,
allowance or chain operation is introduced. Existing preparations/releases are
reused. #407 remains open for throughput and separately identified client/artist
acceptance; no new live upload or payment is requested by this patch.
