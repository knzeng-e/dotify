# Full-length mobile Room preparation delivered — 2026-11-06

**Web and Product 0.1.77 are published and independently verified** from frozen
source `0587442dbbbe75e10e44fffbb692ebdabdcc0edf` on `release/product-0.1.77`, based on merged dev
`7b1705077d4e26ecad978b0b1caab9169dc5d6ad` (#399).
[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42195158354) and
[merged dev CI](https://github.com/knzeng-e/dotify/actions/runs/42193657375) pass.
[Structured evidence](product-0.1.77-rollout-2026-11-06.json) contains public receipts and independent readback.
Refs #395 and W33/#288; the owner confirms eventual full-length foreground delivery,
but startup reliability and locked/background hosting remain **open**.
The [0.1.76 record](product-0.1.76-rollout-2026-11-05.md) preserves the confirmed
eight-second listen and subsequent full-track failure without conflating them.

## Delivered behavior and remaining tradeoff

The [full-length correction](room-full-length-preparation-2026-11-05.md) replaces
serial complete-rendition retrieval with at most four concurrent authenticated
reads, collecting in exact init/media order. Verified ordered bytes drive the
preparation percentage. A confirmed Free access hint is distinct from media
readiness and never grants a key or authorizes capture.

Managed-only mobile Room hosting still waits for the complete authenticated
96 kb/s rendition under the existing 60-second global deadline, per-object
limits and 40 MiB cap. Solo stays progressive. Cancellation, authentication
failure, source retirement and wallet/access interruption remain fail closed.
The complete local AAC index replaces per-fragment DASH indexes while preserving
every encoded media payload byte; unsupported layouts fail before exposing a
Blob. No server encoding or stored musical asset is changed. A larger timeout
alone would leave serial latency and the CI-discovered truncated MP4 unresolved.
Bounded reads cannot guarantee an unreachable origin will become available.

## Exact publication and independent verification

Completed **2026-11-06T14:24:56.468Z**: **12 new app stores / 3,577,762 bytes**,
**8 authenticated reused dependencies**, Bulletin nonces **1198–1209** and
**2 DotNS signing requests**, within the explicit owner-approved caps.
CAR **9,433,603 bytes**, SHA-256
`05416946f19f692a9c60b98b373677e66c0474046d64a75623f0bc2a77fa8586`;
storage root `bafybeihh2tyq6jo2c2pjae6x3wwhcehwk35yhignqt65ozwp3unkemxxnq`.
Offline artifact verification authenticates 99 inner blocks, compares 71 files
and verifies all 20 outer dependencies. A separate read-only client retrieves
those dependencies, authenticates each CID and reconstructs the exact CAR.
Finalized root/app owners, resolvers, contenthash and app version `[0,1,77]`
match; the independent lab stays 0.3.1. The gateway returns HTTP 200 with the
same CAR bytes and hash.

The owner published Netlify `muzinga` from the same source. Served entry
`./assets/index-3YS4rmvd.js`, **1,141,153 bytes**, SHA-256
`2eecbb0941f303fd9f950cb715c4cb5ad3c80031201ba0b18b6d40b99806a1b1` matches the independent reconstruction byte-for-byte.
Public configuration digest: `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.
Netlify reports clean=false because of host non-source files; a temporary
untracked marker reproduces that identity metadata without source edits.
A fresh mobile-sized public browser boot shows the listener shell/navigation,
with no uncaught error, wallet, key request or playback action.

The signer is identity-checked and passed privately over FD3, removed from
launchctl immediately after capture and independently checked absent after exit.
An exclusive local account lease, durable submission intents and exact CID/call
bounds constrain the manual operation; ambiguous intent stops rather than
silently repeating a write. Custody has no active or pending publication before
signing. No phrase or credential is included in this evidence.

## Service and retention boundaries

Post-publication readiness, both catalog entries and three bounded ciphertext
reads pass without a content-key request. API/custody remain source
`e2dd614862a8d9e3c5373689f58195b069130c07`. No server deployment/restart, musical
upload, registry write, policy/CORS/key change, purchase or renewal occurs.
The prior custody database-lock loss/code-0 exit remains a separate supervision
defect; this client rollout does not repair it or restart that instance.

Quota after publication: **461 transactions**, **154,665,731 store bytes**,
**210,941,854 renewal bytes**. Preserve prior 351 renewals / 112,567,204 bytes
and add the whole new dependency graph, including reused children:
**371 future renewals / 122,037,661 bytes**. This is a reserve, not renewal.
Earliest reused expiry remains block **1532185**; account authorization expires
separately at **1621405**. The new root extends neither and no scheduler is
activated. Rollback to the verified 0.1.76 graph requires fresh dependency and
retention checks plus separately bounded DotNS writes; it restores the reported
full-length limitation and must preserve newer receipts/nonces.

## Validation and device gate

Merged implementation validation includes 1,097 unit tests and full 24.2-second
synthetic completion across three browser engines. Local 283.1-second synthetic
Chromium/WebKit preparation and near-end playback checks complement CI;
media-index reconstruction preserves encoded payloads and decoded PCM equality.
These are controlled synthetic checks, not physical acceptance of Adang Fobe.

The first exact-source release CI measured zero receiver energy in one Room case
while 318 main cases passed. The same assertion passes three consecutive local
runs, and the failed job passes on CI attempt 2 without changing source,
artifacts, assertions or production deadlines. Merged dev CI also passes. That
first run has no retained trace establishing a cause; do not treat the rerun as
proof of a diagnosed infrastructure failure.

The owner is asked to reopen About 0.1.77 on the foreground, unlocked phone,
prepare existing **Adang Fobe**, pause while updated Web/Desktop guests join,
then explicitly start and confirm audible playback beyond the first fragments.
No new publication or purchase is needed. Next validate host pause/resume/Next,
guest local mute/disconnect/recovery and same-track position. Background and
cold-start checks remain separate. Keep #395 open; #396 retains matching panel
acceptance, and W33 retains denial/account switching, conservation/alerts and
coherent off-volume recovery. The owner result below now confirms eventual foreground delivery, with material startup and background failures still open.

## Owner full-length feedback, 2026-11-06

Replying to the matching 0.1.77 **Adang Fobe** test request, the owner confirms
**“Préparation : OK”**, **“Web : oui”** and **“Desktop : oui”**. Sound eventually
arrived on two tests. The owner did not independently restate About/app version,
network, exact elapsed preparation time or uninterrupted full-track completion.
This confirms reported foreground full-length-source delivery to both guest
types, not reliable startup or all lifecycle acceptance.

After Room opening, audio still takes a long time and sometimes shows
**“The audio is slow to arrive. Your access is confirmed, but the audio file could
not be loaded right now”**. The owner retried several times before sound arrived.
Do not classify this as an accepted preparation delay: correlate ordered-byte
progress, fetch/authentication completion, Blob creation, media readiness,
AudioContext resume and capture activation with the existing attempt generation
and deadline. Distinguish room/signaling readiness from audible-source readiness;
measure before changing timeouts or introducing caches or new storage writes.

Locking the phone silences **both host and guests**; unlocking restores sound.
The owner reports playback seems to continue in background, but neither media
and context clocks nor outgoing audio energy were captured. The code routes the
local monitor and outgoing WebRTC leg through a shared AudioContext
(`audioNormalization.ts`, with a similar fallback in `useSession.ts`). Suspension
or interruption of that graph is consistent with both outputs falling silent,
not yet a measured cause. [WebKit background AudioContext history](https://bugs.webkit.org/show_bug.cgi?id=261554)
is supporting context, not proof of the behavior of the current Host/iOS version.
Capture context/session state, both clocks and sender energy across lock/unlock;
separate client behavior from native Host background policy. Preserve explicit
pause, disconnect/access interruption, mute ownership and source retirement.
No microphone permission or synthetic keepalive is justified by this report.

#395 remains open for reliable full-length startup, locked/background delivery
and the remaining host/guest lifecycle controls. This feedback changes no
runtime, deployment, content, policy, allowance or renewal state.
