# Mobile-host room audio delivery

Issue #395 · P1 · Production spine · Next · Work.

## Matching delivery, 2026-11-06

[Web/Product 0.1.77](implementation/evidence/product-0.1.77-rollout-2026-11-06.md) deliver merged #399: bounded four-object reads, verified preparation progress and a complete AAC index. Source CI and independent delivery checks pass. Physical full-length phone-host preparation and audible Web/Desktop guest delivery remain pending; keep #395 open for these and lifecycle/background checks. Earlier dated results below retain their original scope.

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
