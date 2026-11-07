# Listening continuity and matched chat delivered — 2026-11-07

Web, Product and signaling **0.1.79 are delivered and independently verified**
from frozen source `c656992c31c91e5bd3953267537df86ee513075e` on `release/product-0.1.79`, based on tested
merged dev `270606742a1f98a486ef97030253d633afcf578c`. This delivers #401/#402.
[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42370030029) and
[merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/42369693742) pass.
[Structured public evidence](product-0.1.79-rollout-2026-11-07.json) records receipts and independent readback.
Refs #395, #388 and W33/#288. Matching physical acceptance remains pending.

## Listening behavior and state ownership

The [listening implementation](listening-session-continuity-2026-11-07.md) limits
resume to the still-open session. Pause/minimize preserves its source and position;
closing retires pending work and output, and later selection starts at zero through
normal access checks. Every Room exit confirms. A host can retain source, position
and play/pause state in solo, or explicitly stop; guest exit stops local playback.
The removed cross-visit bookmark is not reconstructed by rolling the client back.

Queue/details/discovery share stable playback controls and consistent motion with
reduced-motion support. Current-track Room setup and the small-keyboard composer
keep listening/conversation in reach. Artist return preserves catalog context,
including a changing live-room shelf. System artwork delivers the [larger
bottom-right Dotify badge](system-artwork-signature-2026-11-06.md) without outer
petals, in solo and Room. Original covers, titles and artist attribution remain.

## Application publication and complete dependency retention

Completed **2026-11-07T12:37:29.341Z** within the explicit new owner-approved cap:
**13 stores / 4,423,600 bytes**, **7 immediate one-off
renewals / 5,061,961 bytes**, **20 distinct CIDs / 9,485,561 accounted bytes**,
and **two DotNS signing requests**. Nonces span
**1230–1249**.
Every CID consumes one operation; unknown outcomes stop for reconciliation.
No recurring renewal is registered.

The CAR is **9,448,707 bytes**, SHA-256 `aa5cb6fa76e5df165dc6143e4878f904392e13ec05209901bcd05225668995cc`, storage root
`bafybeibfcyq5cl6a4hpfmsrmxvj6bqia45qmhe7dk46fsxoajkhky4dvgq`. Offline checks authenticate 101 inner
blocks, 71 files and all 20 outer dependencies. Renewed
blocks show strictly later canonical expiry, not merely a successful receipt.
Before DotNS writes, all dependencies have fresh canonical retention and exact
retrieved bytes. Independent readback authenticates the complete graph at a
finalized hash, reconstructs the CAR and checks identical gateway bytes.

Finalized owners/resolvers, domain/app contenthash and app version `[0,1,79]`
match the plan. The lab stays at 0.3.1. Netlify entry `./assets/index-n_mwATMm.js` is
**1,148,403 bytes**, SHA-256 `5872f04fbadafc7263a7a65b6238a5f8e8c1cc592d921d6bf1b1dec0ec080e52`, matching the exact reconstructed
build. Public configuration digest `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9` is unchanged.
A fresh mobile-sized Web boot has no wallet, key request, playback or uncaught error.

After publication, quota is **421 transactions**,
**144,982,508 store bytes** and
**201,665,611 renewal bytes**. Preserve the prior 391 /
131,511,566-byte future floor and conservatively add the complete candidate:
**411 future renewals / 140,997,127 bytes**. Immediate renewals do not reduce that
future floor. Earliest candidate expiry is **1745225**; authorization expires
at **1621405**. These clocks are independent. Reservations do not execute
renewals, cover all older graphs, or provide off-volume recovery.

The public signing identity was verified, the phrase passed privately over FD3,
and launchctl was cleared immediately after capture and again on exit, with
absence independently checked. Fresh read-only custody inspection showed no
active/pending publication; exclusive local lease, exact call caps and durable
intents govern the operation. No credential/content key enters this record.

## Matched signaling and operational boundary

Signaling runs `registry.fly.io/dotify-signal@sha256:5c94b9d1212639470224763a412bdc44af62bbec70b4e51ea0ccc725754313e5` on the existing single machine. The source
context contains only 27 tracked build files; image digest and running source
hashes verify independently. All live environment values match the candidate;
no CORS, secret, volume, scale or new service is introduced. API/custody remain
source `e2dd614862a8d9e3c5373689f58195b069130c07`; readiness, both catalog entries
and three bounded public ciphertext reads pass.

The first maintenance guard observed an active Room and postponed the restart.
A fresh zero-Room check then permitted the authorized update. Restart clears
in-memory Rooms/chat; this is not a persistent conversation store. A private
synthetic Room verified two-line relay and late-join history using three clients,
then closed explicitly. Membership/rate/text limits remain, requests stay
single-line, and guests receive no content key. Local signaling validation passes
126 cases, including packaged-runtime coverage.

Rollback image: `registry.fly.io/dotify-signal@sha256:c3cf987ba8c4d03dccc11235fe3aaa3bafa0b7523832687543d1960bb668b80c`.
Signaling rollback needs no schema migration but restarts Rooms and flattens chat
newlines; coordinate the client/server choice and an empty-room window. Product
rollback first authenticates the prior graph/retention and needs bounded DotNS
write authorization; keep all new receipts/nonces. No musical upload, metadata
rewrite, registry registration, domain purchase or key transfer occurred.

## Acceptance still required

Both source CIs pass their unit/access/lifecycle, 329 core browser, supplementary
Nearby/audio/WebKit/identity/logout and three-engine streaming gates. Four operator
budget/renewal tests, refusing-signer rehearsal and synthetic FD3/lease checks pass.
Real received-energy tests verify the browser source lifecycle; clocks alone do
not certify audible physical Host output.

After reopening 0.1.79, use the existing short release and Adang Fobe to hear
pause/resume versus close/reopen at zero, host keep/stop and guest cancellation,
artist return, stable sheet controls and phone lock/unlock. Send/receive two-line
chat with the real phone keyboard open and check scrolled-up history remains.
Verify the simplified badge on solo/Room lock-screen covers. No new purchase or
publication is needed. #395/#388 stay open. W33 retains protected denial/account
switching, full historical conservation and coherent off-volume restore gates.

## Owner feedback — 2026-11-07

For the requested phone/0.1.79 **Adang Fobe** protocol, the owner confirms
**pause/resume OK, close/reopen OK and Room → solo OK**, including the requested
exit-cancellation and host keep-listening path. App/OS/network are not restated.

Room preparation still required two or three attempts with “The audio is slow to
arrive”, before listening succeeded. A subsequent screenshot shows that same
failure in the solo player at 0:00 / 0:00 **after an attempted Room**, as clarified
by the owner. It does not establish a fresh direct-solo startup failure or the
exact failing transport phase. These are partial positive lifecycle results with
a remaining Room-startup defect, not blanket startup/background acceptance.
Keep #395 open; no new upload, deployment or write records this feedback.
