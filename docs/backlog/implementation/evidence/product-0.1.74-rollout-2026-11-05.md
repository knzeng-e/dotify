# Listening controls delivery — 2026-11-05

**Web and Product 0.1.74 are published and independently verified** from
`e8d3be908a4a887f1b8b00f0117af5afd46189d3`, frozen branch `release/product-0.1.74`, based on merged
#389 / tested dev `bfc4fca4`. [Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/41970981680) passes all jobs,
including 308 core flows, Nearby, audio continuity, WebKit controls/artwork,
Product identity and incomplete sign-out recovery.
[Structured proof](product-0.1.74-rollout-2026-11-05.json) preserves the bounded public receipts/readback.
Refs #388 and W33/#288: physical acceptance and conservation remain distinct gates.

## Delivered behavior

The [listening controls iteration](listening-controls-and-discovery-2026-11-05.md)
provides direct account access in the mobile player, live release/artist discovery
from the room cover, and resolved Media Session artwork with previous/next
controls when the queue permits them. The small/keyboard room geometry correction
is included without weakening layout assertions or touch targets. Guest inspection
is read-only and keeps audio/membership active. The existing account sheet owns
disconnect; protected audio still requires explicit authorization after reconnect.
Browser registrations alone do not prove the physical native lock-screen display.

## Exact publication

Publication completes at **2026-11-05T05:32:41.406Z**, with **12 new app stores /
3,563,205 bytes**, **eight reused dependencies**, nonces **1162–1173** and **two
DotNS signing requests**. There is no uncertain submission or automatic retry.
The **9,419,046-byte CAR** has SHA-256
`b89856550b2b444ba015a44f9c044d21f9c79418a983e548070c6a356078ae70` and storage root
`bafybeic54ilwksnwhkcv6qgixtifgbgrv6i6vlskeae7ozzrbnimkk4v3q`. Offline verification authenticates 99 inner blocks and
byte-compares 71 files. Independent network readback authenticates all 20 outer
blocks, reconstructs the exact CAR, checks finalized root/app DotNS records and
receives identical HTTP 200 gateway bytes. App executable is `[0,1,74]`.
Branding, owner/resolver and the independent 0.3.1 lab remain unchanged.

The owner manually publishes the Web on Netlify `muzinga` from the same frozen
source; all other public build/environment/preview settings are preserved.
Exact public entry is `assets/index-BQdxSy1e.js`, **1,131,636 bytes**, SHA-256
`8fcc2f0a2fd1233c4670952b6cfdfe05cf0f7088cb8397681002094b3ca398cb`. Pinned local dependencies and the same public configuration
reproduce these bytes; a temporary non-source marker reproduces Netlify's
`clean=false` identity and is removed afterward. Configuration digest remains
`0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`. Keep record edits off the frozen production branch.

The signer is identity-checked and removed from launchctl immediately after
capture, then checked/removed on exit. It is passed only through FD3 to the bounded
operator. No phrase or key is stored in this record. Before capture, the shared
custody publisher has no active job or pending intent; other account activity was
held idle for the operation. The exclusive local lease and durable intents are
preserved throughout.

## Preserved service and retention boundaries

No API/custody deployment or restart, media/registry write, key transfer,
policy/grant/CORS change, domain purchase or renewal occurs. Both catalog entries
and the existing synthetic release are unchanged. API/custody remain source
`e2dd614862a8d9e3c5373689f58195b069130c07`; readiness and bounded ciphertext reads
pass without requesting a content key.

Quota after publication is **497 transactions**,
**165391094 store bytes** and **210941854 renewal bytes**.
Conservatively retain **311 future renewals / 93,634,213 bytes**, including all 20
current app dependencies and the previous global floor. Reused children still
expire as early as **block 1532185**; account permission expires independently at
**1621405**. New root/executable records extend neither deadline.
No renewal or monitoring schedule is activated by this rollout. The separate
[read-only conservation candidate](../../../operations/bulletin-conservation.md)
is not included in this deployed client source and is not deployed to the API.

## Remaining evidence

Use the existing eight-second synthetic release: verify the direct mobile account
sheet, disconnect/explicit recovery, room release/artist inspection with audio
and membership preserved, then physical locked/backgrounded artwork and eligible
queue actions. Record OS/Host versions. #388 remains open until those checks;
W33 also retains signed unentitled denial, account switching, room-guest silence,
complete retained inventory, bounded renewal and coherent off-volume restoration.
Prior 0.1.73 disconnect/recovery acceptance on all three clients remains valid
historical evidence, not a substitute for these new native checks.
