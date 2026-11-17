# Mobile room capture and shared listening panels — 2026-11-05

**Web and Product 0.1.76 are published and independently verified** from
`e195e3ab75dd437c17e9f0ac9c0840f304361ae0`, frozen branch `release/product-0.1.76`, based on merged dev
`9dc9708e07f99f3b02e4c7aa7b3686e59f9f8f2a` (#397/#398).
[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42032408117) and [merged dev CI](https://github.com/knzeng-e/dotify/actions/runs/42031562226) pass.
[Structured proof](product-0.1.76-rollout-2026-11-05.json) contains the public receipts and readback.
Refs #395, #396 and W33/#288; owner-confirmed foreground delivery is recorded below,
with lifecycle, presentation and conservation acceptance still separate.
The [0.1.75 record](product-0.1.75-rollout-2026-11-05.md) retains its own device feedback.

## Delivered behavior and tradeoff

[Mobile room capture](../../../backlog/room-listener-audio.md) uses the existing
complete, authenticated 96 kb/s AAC compatibility Blob on managed-only engines
when room capture is explicitly requested. This targets a WebKit MediaSource/Web
Audio limitation consistent with the report, not yet a measured phone root cause.
Solo playback stays progressive and standard MediaSource room hosting keeps its
existing path. Re-preparation preserves the current track position; standby and
unlock restoration preserve capture intent. No microphone, guest key or archive
read is introduced. The compatibility reader retains the 40 MiB cap and access,
authentication/cancellation boundaries; mobile room preparation waits for the
complete rendition, with bounded extra memory.

[Shared listening panels](../../../backlog/listening-overlay-motion.md) give Room
Up next/suggestions and release details the same sheet presentation as solo
Queue. Hidden dialogs keep drafts without owning focus, history or scroll.
Explicit/automatic Next into denied access dismisses contextual sheets before
the access gate owns focus. Motion, drag dismissal and player collapse preserve
room membership, persistent audio and reduced-motion behavior.

## Exact publication and independent verification

Completed **2026-11-05T13:43:30.013Z**: **12 new app stores / 3,575,212 bytes**,
**8 authenticated reused dependencies**, Bulletin nonces
**1186–1197**, **2 DotNS signing requests**.
The immutable plan stops on missing approved reuse or ambiguous intent; its
budget cannot grow through a retry. CAR **9,431,053 bytes**, SHA-256
`6507a89ef7927f81f3b08cc1dac6b9a0ec563ea377ffe638f9ef3d7c319a4c3c`; storage root `bafybeig5twqwxc5kx6k254tpprob7nwwf25rtr2qkybtnhygqmd4sd2wjy`.
Offline verification authenticates 99 inner blocks,
compares 71 files, verifies 20
outer dependencies and repeats stable merkleization. Independent raw reads
reconstruct the exact CAR; finalized root/app version `[0,1,76]`, owners/resolvers,
branding, unchanged lab 0.3.1 and gateway HTTP 200 bytes all match.

The owner publishes Netlify `muzinga` from the same source. Served entry
`./assets/index-C1sjIxye.js`, **1,138,603 bytes**, SHA-256 `2f08346d35a4c505e70349b6ce30a57b6c11540ceda02579a523535a31cdc2fa`.
The same public config and Netlify clean=false identity reproduce those exact
bytes without source edits. Public configuration digest:
`0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`. A fresh mobile-sized public browser boot passes
without wallet/key/playback action or uncaught errors. Evidence changes stay on
this record branch, not the frozen release branch.

The signer is identity-checked and passed over FD3, immediately removed from
launchctl and cleared/checked on exit. No phrase is stored in public evidence.
Before signing custody has no active job or pending submission. An exclusive
local account lease and durable submission intents protect the manual operation;
other shared-account transactions remain idle.

## Service availability incident during preparation

API/custody retain source `e2dd614862a8d9e3c5373689f58195b069130c07`. The existing custody
machine was already stopped after its exclusive database connection failed at
12:05 UTC: admission/encoder closed safely, but the process exited with code 0
and Fly's on-failure policy did not restart it. The same existing instance was
started during preparation, preserving its image, volume, keys, policies, jobs,
receipts and counters. Two jobs are ready with no active/pending submission;
readiness, both catalog items and bounded ciphertext reads pass without a key.
This operational recovery is separate from client publication and does **not**
fix the fatal-exit/supervision defect in code. Follow up with a deterministic
process/lock-loss test and bounded operational alert; never keep writing after
lock loss or clear durable history to recover.

No server deployment, new service, musical/registry write, policy/grant/CORS/key
change, domain purchase or renewal occurs. Conservation tooling is not activated.

## Retention and rollback

Quota after publication: **473 transactions**,
**158243493 store bytes**, **210941854 renewal bytes**.
Preserve prior 331 renewals / 103,099,297 bytes and conservatively add this whole
graph, including reused children: **351 future renewals /
112,567,204 bytes**. Reserve is not renewal. Earliest reused expiry
is **block 1532185**; account authorization expires separately at
**1621405**. The new root extends neither. No scheduler is activated.
Rollback to the independently verified 0.1.75 graph requires fresh dependency
readback/retention checks and a separately bounded DotNS update; it restores the
reported mobile-host limitation and must preserve all newer nonce/receipt state.

## Physical foreground result and remaining acceptance

The owner replies **“Web : oui, Desktop : oui.”** to the matching 0.1.76 test:
the phone hosts in foreground/unlocked, guests join while paused, then the
existing eight-second release starts explicitly. This confirms reported audible
music at both Web and Desktop guests, resolving the reported foreground-silence
symptom in that scenario. The Polkadot app version was not restated in this reply.
No new deployment, musical write or policy change is performed to record it.

Still verify physical host pause/resume and Next, guest local mute/disconnect and
explicit recovery; test background hosting separately. Inspect Room queue,
suggestions and release details for drag/Back/keyboard/focus behavior without
changing room/audio ownership. No new publication or purchase is needed.
#395 remains open for those lifecycle checks; #396 retains matching panel
acceptance. This is not a cold-start measurement or general device certification.

Automated evidence includes 1,088 unit tests, real normalized WebRTC energy in
Chromium and managed-only authenticated AAC Blob received-energy in WebKit.
The owner's audible result is distinct from those automated engine checks.
W33 also retains signed denial/account changes, conservation/alerts and coherent
off-volume recovery; custody's fatal-exit/supervision defect remains a follow-up.

## Full-length follow-up, 2026-11-05

The owner subsequently reports that **Adang Fobe** plays solo but stalls while
opening a Room, then shows the audio-unavailable error. The 32-second recording
shows solo audio followed by ongoing preparation; the terminal error is supplied
in a separate screenshot. No exact failure duration or phone transport trace is
captured. The public registered manifest describes 283.1 seconds, 72 init/media
objects and 3,550,124 clear bytes at 96 kb/s; this diagnostic read requests no key.

The delivered compatibility reader awaits each object serially under the
existing 60-second post-authorization startup budget. Controlled latency
reproduces exhaustion for a track with this segment count; this is consistent
with the report, not a measured account of each request on the phone. A bounded
parallel-reader correction is being tested separately. The eight-second result
remains valid for that excerpt and does not certify full-length Room hosting.
#395 remains open; no new deployment, content upload or access bypass is included.

The [0.1.77 delivery](product-0.1.77-rollout-2026-11-06.md) publishes the bounded preparation and complete-index correction on 2026-11-06. Independent delivery checks pass; matching physical full-length acceptance remains pending.
