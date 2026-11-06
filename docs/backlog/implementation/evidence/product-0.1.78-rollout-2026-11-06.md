# Room audio lifecycle and complete application retention delivered — 2026-11-06

**Web and Product 0.1.78 are published and independently verified** from frozen
source `6898863de55a4a99d4a7a7b86fb1b86a2414e39f` on `release/product-0.1.78`, based on merged dev
`4999bce694ca365d739236a0844dcc7066e2b71d` (#400).
[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42263916065) and
[merged dev CI](https://github.com/knzeng-e/dotify/actions/runs/42261396140) pass.
[Structured evidence](product-0.1.78-rollout-2026-11-06.json) contains the public receipts and independent
readback. Refs #395, #388 and W33/#288. Matching physical startup/background
acceptance remains **pending**; historical 0.1.77 owner feedback stays separate.

## Delivered behavior

The [client correction](room-host-lifecycle-2026-11-06.md) refuses Room creation
after failed/superseded preparation, distinguishes authenticated compatibility
preparation from native output readiness, and exposes explicit Resume audio on
initial autoplay refusal or an observed output interruption. A previously running
interrupted graph silences local/outgoing audio and pauses at position. Device
visibility/unlock cannot override Pause or account/source retirement. Existing
60-second startup and 40 MiB limits, host-only key access and guest WebRTC-only
media remain unchanged; solo remains progressive.

Native playback session policy is requested where supported. This does **not**
prove uninterrupted locked hosting. A graph reporting running while silently
stalled may not expose an interruption event; the bounded, identifier-free
diagnostic series supports the remaining device diagnosis. Its copy action lives
in the existing readiness/debug panel; the unchanged production profiles disable
that panel. Do not ask an ordinary user to find a visible export button in this
rollout. Support capture/accessibility remains a follow-up if needed.

System artwork now uses the same rounded artist cover, six Dotify petals and
compact logo in solo and Room. Tiny room information is removed; title/artist
and original artwork remain unchanged. Native rendering still needs physical
acceptance. No Host entitlement, backend encoding or musical asset changes.

## Publication and retention operations

Completed **2026-11-06T19:54:19.926Z** within the explicit new owner-approved cap:
**14 new stores / 5,259,623 bytes**, **6 immediate one-off
renewals / 4,214,282 bytes**, **20 distinct application CIDs / 9,473,905
accounted bytes** and **two DotNS signing requests**. One CID cannot consume both
operations. Nonces span **1210–1229**.
No recurring renewal is registered.

The prior read-only 0.1.77 snapshot found two expired application chunks
(1,678,413 bytes). These exact local bytes occur in the new candidate and are
included among its new stores. Six retained dependencies were authenticated
before their approved immediate renewal. A new root alone would not extend
those children; every renewed CID now shows a strictly later canonical expiry.
A finalized acknowledgement or warm gateway cache alone is insufficient.

CAR: **9,437,051 bytes**, SHA-256
`1a6b6ad85590f01a6a3d98cab25c0bb0846977017f277ec33aa35b8917f85783`; storage root
`bafybeib2nvskilwylbkneprjxzcqrnulwcpt5omni6odbnzbwmapxdfdk4`. Offline verification authenticates 99 inner CAR blocks,
71 files and all 20 outer dependencies. Before DotNS writes, every dependency
has fresh canonical retention and exact retrievable bytes. Independent readback
checks all 20 at a finalized hash, retrieves/CID-authenticates bytes, reconstructs
the exact CAR and requires the gateway to serve those same bytes.

Finalized domain/app owner, resolver, contenthash and app version `[0,1,78]`
match the plan. The independent lab remains unchanged at 0.3.1. Netlify served
entry `./assets/index-ytm18OUC.js`, **1,144,097 bytes**, SHA-256
`555f26e05d1b779e84d315e110aea966a50ef0cd49c5303b830b88b585797340` matches the reconstruction. Public configuration digest
`0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9` is unchanged. The known Netlify clean=false identity
is reproduced without source edits; a fresh mobile-sized public browser boots
without wallet, key request, playback or uncaught errors.

## Signing, quota and operational boundary

The public account is checked before use; the signer passes privately over FD3
and is removed immediately from launchctl, then independently checked absent on
exit. Custody's fresh read-only snapshot shows no active/pending publication.
An exclusive local lease, exact CID/call caps, combined per-CID operation budget
and durable intents prevent blind ambiguous retries. Unknown outcomes stop for
chain reconciliation. No phrase, content key or credential enters this record.

After publication: **441 transactions**,
**149,406,108 store bytes** and
**206,727,572 renewal bytes** remain.
Preserve the prior 371 / 122,037,661-byte future reserve and conservatively add
the complete 20-object candidate: **391 future renewals / 131,511,566 bytes**.
The performed six renewals do not lower that future floor. Earliest candidate
expiry: **1735316**; account authorization expiry: **1621405**.
These are independent clocks; new content retention does not extend account
authorization. This operation covers the new application graph, not every older
app/lab/media graph. Complete inventory, recurring conservation and off-volume
recovery remain open. Reserved counters do not execute future renewals.

API/custody remain source `e2dd614862a8d9e3c5373689f58195b069130c07`. Readiness,
both catalog entries and three bounded public ciphertext reads pass without a
content-key request. No server deployment/restart, musical store/renewal, registry
write, policy/CORS/key change, domain purchase or new service occurs. The earlier
custody lock-loss/code-0 supervisor defect remains a separate follow-up.
Rollback must first authenticate the selected prior graph and current retention,
preserve new receipts/nonces and obtain a bounded DotNS write authorization.

## Validation and remaining device gate

Both source CI suites pass: unit/access/source-retirement checks, real normalized
WebRTC received-energy checks, three-engine streaming, continuity, WebKit
controls/artwork and Product identity/sign-out. The merged-dev API job was canceled
after more than twenty minutes downloading Ubuntu FFmpeg dependencies, before
codec tests. Only that job and its dependents reran; no source/assertion/deadline
change. The exact frozen-source CI passes on its first attempt. Four additional
operator tests cover positional renewal, one explicit nonce/submission, failed/
ended/timed-out finality, independent extension and per-CID/combined caps. Six
actual runtime renewal calls encode with a fake creator; two exact DotNS calls
reach a refusing test signer before the real authorized operation.

Next physical check: reopen About 0.1.78, prepare existing **Adang Fobe** on the
phone, join with refreshed Web/Desktop guests and explicitly start. Verify actual
sound and preparation behavior, then lock/unlock and observe clocks/recovery.
Record any interruption/recovery; diagnostic export is currently gated by the
disabled readiness panel. Verify branded artwork in solo and Room. No new
upload or purchase. Keep #395 open; foreground delivery, uninterrupted background
sound and explicit interruption recovery are distinct acceptance outcomes.
