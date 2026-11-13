# Mobile-host Room startup and listening continuity

## Solo-to-Room continuity candidate, 2026-11-13

The [separate preparation lifetime](../adr/0059-preserve-solo-during-room-preparation.md)
keeps the current mobile solo source usable while preparing its authenticated
Room-compatible replacement. Handoff captures the live position and respects a
Pause during the wait; cancellation or a stale result cannot create a Room.
Authorization and the total 60-second media budget remain. This improves the
waiting experience, not measured download latency. Matching delivery, repeated
full-length/locked-phone and audible guest acceptance remain open. Real independent
recovery is deferred at the owner's request; it does not block this product slice.
Earlier dated checkpoints below retain their original scope.

## Offline measurement candidate, 2026-11-12

While #407 real recovery awaits destination coordination, a separate client
candidate prepares the [matched Room-start measurement](../how-to/measure-room-startup.md).
Export-local attempt numbers correlate selection, retries and native readiness;
read/authentication aggregates and compatibility assembly boundaries distinguish
where preparation time goes. About now offers explicit support copy after success
as well as failure, without automatic transmission. No latency improvement,
deployment or physical background acceptance is claimed. #407 remains the release
gate; #395 stays Next / In Progress pending comparable real-device reports and
a measured correction. See the [commit-bound local evidence](implementation/evidence/room-startup-diagnostics-2026-11-12.md).

## Current remaining scope, 2026-11-09

Guest sound is restored on the owner-tested path. #395 remains Next for
measured startup improvement and broader continuity, after #407. The approximately
55-second Adang Fobe start is one observation, not a latency budget or a repeated
benchmark. Use the [selected plan](implementation/listening-and-publication-readiness.md)
for phase reports and comparable repeated phone-host/Web/Desktop acceptance.
Do not restart the already delivered capture implementation from the old incident.

## Next implementation gate, 2026-11-08

The owner reports delivered 0.1.80 starts Adang Fobe without retry in approximately
55 seconds and guests hear sound. One approximate observation does not identify
the slow phase. After the new publication blocker #407, follow the
[measurement and execution plan](implementation/listening-and-publication-readiness.md):
local success/failure phase reports, comparable repeated starts, then a measured
correction. Keep #395 open; do not expand deadlines or claim all background paths.

Issue #395 · P1 · Production spine · Next · Work.

## Matching relay correction delivered, 2026-11-07

[Web/Product 0.1.80](implementation/evidence/product-0.1.80-rollout-2026-11-07.md) now deliver #404 with green exact-source/merged-dev CI and independent complete dependency/Web/DotNS readback. The owner confirms one matching 0.1.80 Adang Fobe Room preparation without retry in approximately 55 seconds and audible Web/Desktop guests. This accepts the reported successful path; startup latency remains too long and broader lifecycle stays open. The owner separately confirms 0.1.79 account connection and short-release sound on iPhone 0.10.0 (20), Runtime 0.26.0; the scoped used-domain comparison supports retaining the current SDK. Keep #395 open and copy the local support report if startup fails. No service or musical asset is changed.

## Relay-capacity follow-up candidate, 2026-11-07

The owner confirms 0.1.79 pause/resume, fresh close/reopen and Room → solo, but
Room startup still needs retries. The [client correction](implementation/evidence/room-preparation-relay-2026-11-07.md) addresses a reproduced four-read/two-download relay mismatch and makes bounded local audio diagnostics available at the failure. This is not a native phone diagnosis or deployment; keep startup acceptance open.

## Owner startup and short-lock acceptance, 2026-11-06

In the requested 0.1.78 Adang Fobe test, the owner confirms preparation without
retry and audible sound at host and guests during phone lock. The protocol asked
for Web/Desktop guests and 10–15 seconds locked; actual duration, app version,
network and per-guest results are not restated. This is positive physical evidence
for that startup/short-lock path, not full-song or extended background acceptance.
Explicit interruption recovery and artwork are not reported in this reply. See
[the dated record](implementation/evidence/product-0.1.78-rollout-2026-11-06.md#owner-startup-and-short-lock-acceptance--2026-11-06).

## Matching lifecycle delivery, 2026-11-06

[Web/Product 0.1.78](implementation/evidence/product-0.1.78-rollout-2026-11-06.md) deliver merged #400. Source CI and independent delivery/complete canonical application retention pass. The owner confirms preparation without retry and host/guest sound through the requested short phone-lock test. Extended background/cold-start and explicit recovery under an actual interruption remain separate checks. The bounded one-off app dependency renewals do not activate general conservation. Keep #395 open; the previous foreground result is not background acceptance.

## Matching delivery, 2026-11-06

[Web/Product 0.1.77](implementation/evidence/product-0.1.77-rollout-2026-11-06.md) deliver merged #399: bounded four-object reads, verified preparation progress and a complete AAC index. Source CI and independent delivery checks pass. The owner confirms eventual full-length phone-host sound at both guest types, but startup remains slow with intermittent errors/retries, and locking the phone silences host and guests until unlock. Keep #395 open for reliable startup and lifecycle/background delivery. Earlier dated results below retain their original scope.

The owner reports that a mobile host hears local music but Desktop/Web guests
receive silence, including with the phone unlocked and app foregrounded. Hosting
from Web/Desktop works for receivers on all three surfaces. This is not yet
attributed to 0.1.75 or to Bulletin. Successful peer negotiation is insufficient
proof of audible delivery.

Trace real source capture, normalization and WebRTC sender energy before changing
receiver behavior. Add deterministic received-energy tests rather than relying
on live tracks alone. Preserve host-only source/key access, pause/mute ownership,
source retirement and fail-closed access interruption. Never request microphone
permission as an incidental music-capture workaround.

Physical mobile Host to Web/Desktop acceptance remains required after matching
rollout. No service restart, musical upload, signing or allowance is authorized
by this implementation ticket.

## Full-length preparation follow-up, 2026-11-05

The owner confirms 0.1.76 reaches Web/Desktop guests on the eight-second release,
but **Adang Fobe** (4 min 43) plays solo and stalls when opening a mobile-hosted
Room, eventually showing audio-unavailable. [The bounded preparation correction](implementation/evidence/room-full-length-preparation-2026-11-05.md)
addresses serial complete-rendition reads under the existing 60-second startup
budget. Keep #395 open for matching full-length and lifecycle acceptance; the
short excerpt does not certify those paths. No musical upload or deployment is
included in this follow-up.

## Candidate design

Managed-only AAC readers now prepare the authenticated 96 kb/s compatibility
Blob **when explicitly opening a room or selecting the room's next track**.
Solo playback remains progressive; standard MediaSource readers keep their
existing room path. A currently playing managed source must be prepared again
before becoming a host, preserving its current position through the existing
audio-continuation mechanism; standby identity includes capture intent so a solo
managed element cannot be adopted accidentally. First room preparation requests
`room_host` key purpose, even before a signaling emitter exists. Successful unlock restoration retains room
capture intent instead of reverting to managed streaming.

This targets [WebKit #266922](https://bugs.webkit.org/show_bug.cgi?id=266922):
MediaSource can play natively without delivering samples through
MediaElementAudioSourceNode. It is a diagnosis consistent with the owner report,
not yet a measured root cause on that phone. No microphone, new relay, clear
public URL, archive/master read or guest key request is introduced.

The compatibility reader authenticates the same manifest, identity, gain and
every segment before exposing a local URL. Existing cancellation, source
retirement, wallet/access invalidation and the 40 MiB clear-buffer cap apply.
The tradeoff is waiting for the full 96 kb/s rendition before mobile hosting,
with bounded extra memory; it does not promise progressive start for that path.

## Evidence and remaining acceptance

Local: 1,088 unit tests, frontend build/lint; authenticated AAC parsing and denial
checks on Chromium/WebKit, plus WebKit managed-only AAC Blob → normalization →
real WebRTC received-energy measurement. Chromium exercises real normalized
media in two room contexts, pause/local mute and source retirement. The AAC
managed test targets WebKit; simulating a nonexistent managed capability in
Chromium is not a supported acceptance target. PCM-only WebKit probes did not
provide a reliable signal and are not claimed as mobile AAC evidence.

After matching rollout: mobile host **foreground/unlocked first**, Web/Desktop
guests, existing protected release, explicit start, pause/resume, next, guest
local mute and disconnect. Then test background separately. Require sound at the
guest, not merely connected peers or advancing clocks. #395 remains open until
that acceptance; deployment/signing is separate from code review.

Review follow-up: a real media-clock regression verifies same-track re-preparation
retains position, while opening a different track still starts normally.


## Physical foreground result, 2026-11-05

After [Web/Product 0.1.76 delivery](implementation/evidence/product-0.1.76-rollout-2026-11-05.md),
the owner confirms **“Web : oui, Desktop : oui.”** for the requested foreground
phone-host test with the existing eight-second release. Both guest types hear
the music. The app version was not restated. This accepts that reported path;
physical pause/resume/Next, guest mute/disconnect/recovery and background hosting
remain separate checks. Keep #395 open for that remaining lifecycle acceptance.

## Full-length foreground result and background failure, 2026-11-06

The owner reports eventual sound with **Adang Fobe** on two tests and confirms
Web/Desktop guests hear it. Startup still takes a long time after Room opening,
sometimes shows audio-slow/unavailable, and required repeated retries. Locking
the phone silences both host and guests; unlocking restores sound. Background
clock advancement is reported, not independently measured. See the
[matching delivery feedback](implementation/evidence/product-0.1.77-rollout-2026-11-06.md#owner-full-length-feedback-2026-11-06).

Next diagnosis must separate authenticated download, local media readiness and
capture/context activation. Record per-attempt timings and context/session state,
media/context clocks and outgoing energy across lock/unlock. Do not infer
readiness from Room visibility or connected peers, treat foreground success as
background acceptance, or weaken access/deadlines to hide failure. #395 stays open.

## Startup and device-interruption candidate, 2026-11-06

The owner confirms eventual full-length foreground Web/Desktop sound in 0.1.77,
but long delays/errors/retries persist, and phone lock silences host and guests.
The [next client slice](implementation/evidence/room-host-lifecycle-2026-11-06.md)
refuses room creation after failed/superseded preparation, distinguishes complete
compatibility preparation in timing evidence, requests native playback policy
where supported, and pauses at position with explicit recovery if the shared
output is interrupted. A bounded local context/media-clock snapshot supports
native diagnosis. It does not promise uninterrupted locked hosting or identify
every slow request; #395 stays open for matching rollout/device evidence.


## Close/reopen continuity candidate, 2026-11-07

The owner confirms 0.1.78 preparation succeeds without retry and host/guests remain audible during a short phone lock. A separate report concerns silent advancing playback after closing the player, chiefly on phone. The candidate retires dismissed output and removes cross-visit checkpoints; confirmed host Room exit can retain the same local source and pause state. Physical close/reopen acceptance remains open; the prior lock observation does not prove this new path.
See [design and validation](implementation/evidence/listening-session-continuity-2026-11-07.md). No deployment is part of this change.


## Matching delivery, 2026-11-07

[Web/Product and signaling 0.1.79](implementation/evidence/product-0.1.79-rollout-2026-11-07.md) now deliver the reviewed candidate from `c656992c`, with both source CIs and independent readback green. Room exit/source-lifecycle and multiline chat behavior, plus the simplified system badge, still require matching physical phone acceptance. The deployment record preserves exact bounded writes, one-off retention, service restart and rollback boundaries; this issue remains open.


## 0.1.79 phone lifecycle acceptance and startup follow-up, 2026-11-07

The owner confirms audible pause/resume, close/reopen at the beginning, and
confirmed host Room → solo continuity in the requested Adang Fobe protocol.
However, Room startup required two or three attempts with audio-slow errors.
A follow-up screenshot shows 0:00 / 0:00 and the same failure in solo after an
attempted Room; direct solo startup failure is not established. Preserve these
partial successes and keep startup reliability open. See the [delivery feedback](implementation/evidence/product-0.1.79-rollout-2026-11-07.md#owner-feedback--2026-11-07).
