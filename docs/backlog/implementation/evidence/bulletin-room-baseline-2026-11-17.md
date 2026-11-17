# Bulletin Room baseline and repeat check — 17 November 2026

The first selected **Eskapade à engong** iPhone journey succeeds on delivered Dotify
**0.1.88**, build `4cbdb4f4206f91470eb6097ade8f23093f4aa840`, with Polkadot app
**0.10.0 (20)**. The support report measures **1.807 seconds of Room media
preparation** with Pause preserved through source replacement. The owner
separately confirms **guest sound, sound through phone lock and the end of the
track, and visible artwork**. This establishes one positive Bulletin journey;
repeated startup and broader artwork reliability remain open under
[#395](../../room-listener-audio.md) and
[#388](../../listening-controls-and-discovery.md).

## Scope and binding

The owner responds to the selected existing Eskapade journey. A metadata-only
public catalogue read at `2026-11-17T01:37:46.185031Z` verifies that it is active,
Free, and registered under runtime
`0xdcF6b75E4185E99a830878D044dC76372c556819`, content hash
`0x5dc8ab81bc96061d988b603d431b8e493d622c78db979c4c99201b7fb6b631bb`.
Its audio reference is
`dotify:enc:v3:key-v3:ipfs://bafykbzaceccdgweiu3bj25zvaxdxjfw3i54fi3x5j4glivg2m4nn5esn7npza`.
The standard wire spelling reuses `ipfs://`; the registered CID selects Bulletin.
[Existing dispatch](../../../../web/src/features/catalog/streamingPlayback.ts)
uses the native Bulletin reader, then the catalogue-gated Bulletin API as
recovery, without ordinary IPFS-gateway fallback.

The report is observed at `2026-11-17T01:45:20.784Z`. It intentionally omits track
identity, so the selected journey and owner reply supply that binding. Wi-Fi,
no connected wallet and a client relaunch were requested, but are not independently
exported or separately restated by the owner. Ten objects are reused from the
solo session; this is not an entirely cold read. Host/API cache state is unknown.
The [structured record](bulletin-room-baseline-2026-11-17.json) transcribes
selected supplied values and observations; it is not a full raw-report archive.

## Preparation and handoff

Room preparation is attempt **2**, read attempt **1**, with no error or second
complete preparation in the supplied export.

| Boundary | Elapsed from preparation start |
| --- | ---: |
| Access/key authorized | 209 ms |
| Manifest authenticated | 210 ms |
| Complete media downloaded | 1,800 ms |
| Compatibility source ready | 1,807 ms |

The reader authenticates **31 objects / 1,464,541 encrypted bytes**: **10 client
cache**, **14 native Host**, and **7 HTTP** objects. All seven rejected native
probes recover through the Bulletin API; its seven HTTP requests and bodies
succeed, with **zero HTTP failures**. The native rejection cause is not exported.
This demonstrates a working recovery path, not a diagnosed native defect or
an exclusively native read.

Cumulative work is 5,788 ms of reads, 40 ms of decryption, 2,783 ms of native
probes, 2,615 ms before HTTP headers, and 383 ms consuming bodies; maximum
completed object read is 1,117 ms and recorded relay wait is zero. Work overlaps
and must not be added to wall time. Field definitions and limits remain in the
[measurement guide](../../../how-to/measure-room-startup.md#distinguish-transport-phases).

Attempt **3** authorizes and reuses the already prepared source in **147 ms**,
then reaches element metadata in **117 ms**. This is normal handoff, not another
Room opening or download. The 1.807-second boundary measures media preparation,
not a user stopwatch from the Room button to visible readiness or audible sound.

## Pause, audible continuity and artwork

The output trace pauses solo **9.218 seconds before preparation starts**, at
media position **0.401065792 s**. That position and paused state survive
retirement of the solo element and attachment/readiness of its replacement.
An explicit Play later reaches `playing` in **46 ms**. Thus Pause preservation is
observed; a new Pause gesture during preparation is not demonstrated by this
particular trace.

The supplied export remains foreground-only and ends after a short playback
followed by Pause, at media position about **0.935 s**. It contains no visibility
transition or end-of-track event. The owner's subsequent explicit observation is:

> invité : OK; verrouillage : OK ; fin : OK ; pochette : OK

That reply supplies audible guest/lock/end-of-track and visible-cover acceptance
for the selected journey. A matching extended trace and measured lock duration
are not supplied. Do not represent native clock advancement, `playing`, or PNG
registration alone as proof of those audible or visual outcomes.

Artwork decodes in **2 ms**, composes in **23 ms**, and publishes PNG metadata in
**27 ms**. The owner's visible-cover observation is distinct from that local
registration timing. Repeated locks, rapid changes and signature/immediate-lock
triggers remain outside this acceptance.

## Repeated opening and background readback

The second supplied report, observed at `2026-11-17T05:11:23.217Z`, identifies the
same client build and iOS Host. The owner reports **Room approximately 1 s,
Pause OK, guest/lock sound OK and artwork OK** in response to the requested
relaunch/reopening check. The export resets attempt numbering and retains the
same 31-object / 1,464,541-byte media size; that is consistent with the selected
journey, but does not independently prove the relaunch, release identity or
network. Those remain bound through the request and owner reply.

Attempt 2 / read attempt 1 authorizes in **237 ms**, authenticates the manifest
in **238 ms**, downloads completely in **838 ms**, and prepares the source in
**842 ms** (4-ms assembly). There is no preparation error or another complete
Room preparation. Attempt 3 reuses that source after authorization in **100 ms**;
replacement metadata takes **120 ms**. Keep the owner's approximately one-second
visible timing separate from the 842-ms media boundary.

The 31 authenticated objects split into **10 client-cache, 19 native Host and
2 HTTP recovery** objects. All 21 native probes settle; two reject and recover
through the catalogue-gated Bulletin API. Both HTTP requests/bodies succeed,
with zero HTTP failures. Recorded work totals are 1,316 ms reads, 45 ms decryption,
160 ms native probes, 1,136 ms before HTTP headers and 13 ms bodies; relay wait
is 1 ms and maximum completed object read is 591 ms. These overlapping totals
are not wall-time components. Host/API cache state and native rejection causes
remain unknown; fewer fallbacks do not establish an optimization gain.

Solo Pause occurs **9.562 s before preparation**, at **0.785519001 s** media
position, which remains paused through source replacement. The first explicit
Play reaches `playing` in **46 ms**; a later explicit pause/resume reaches
`playing` in **27 ms**. This is preserved pause intent, not a new Pause gesture
during the short preparation window.

Unlike the first supplied export, this one includes background boundaries:
`hidden` at timestamp `1794892181789`, then `visible` at `1794892260832`, about
**79.043 s** apart. The context is running and media is unpaused/ready at both
boundaries; media advances from **9.666 s** to **88.706 s**, about **79.040 s**.
The context advances about **79.077 s**. Interior output is not continuously
sampled, so the owner's audible guest confirmation remains the sound proof.
A later foreground Pause occurs at media position **100.538 s**. There is no
end event or new full-track-end confirmation in this second report; the first
journey's explicit owner end-of-track confirmation remains separate.

Artwork decodes in **2 ms**, composes in **19 ms**, and publishes PNG metadata in
**23 ms**, with owner-confirmed visible cover. This is another positive lock
observation on the same release, without a track-change or signature/immediate-lock
trigger. Selected transcription and arithmetic are in the structured record's
`repeatFollowup` section.

## Subsequent track-change check

The [later #388 artwork exercise](bulletin-track-change-artwork-2026-11-17.md)
confirms solo changes, Room change and guest sound, with roughly 30 s of Room
background boundary observations. It completes the selected bounded next check
below; unobserved native triggers and broader #395/pilot criteria remain open.

## Decision and remaining checks

The bounded same-release repeatability check now passes: **1.807 s then 0.842 s**
media preparation, with owner-confirmed Pause, guest/lock sound and artwork on
both journeys. The first also has owner-confirmed listening to the track end.
Move active device validation to **#388 track changes and artwork stability**,
while retaining broader #395/pilot criteria. Do not select a speculative
latency patch from a successful mixed native/API read. The earlier Adang Fobe
IPFS runs use a different, larger release (73 objects / 3,580,693 bytes) and
different transport/cache conditions; they cannot establish a controlled speed
gain here and remain outside active Bulletin acceptance.

No additional unchanged-track repeat is selected merely to accumulate more
positive reports. These two observations do not establish cold starts, a latency
percentile, all-network/device reliability or all #395 continuity cases. #395
remains open for that broader scope; #388 retains rapid changes, repeated modes
and the particular signature/immediate-lock trigger. The compact/CASH and owner-deferred real recovery gates keep their
existing order. Recording this evidence changes no application, service,
capacity, access rule, publication, key or funded allowance.
