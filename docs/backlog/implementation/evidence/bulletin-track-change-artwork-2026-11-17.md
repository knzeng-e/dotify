# Bulletin track-change artwork check — 17 November 2026

The owner confirms **solo changes OK, Room change OK, guest sound OK** on
delivered Dotify **0.1.88**, build `4cbdb4f4206f91470eb6097ade8f23093f4aa840`,
Polkadot app **0.10.0 (20)** on iOS. This is a positive bounded #388 check of
correct current title/artist/cover after changes and lock, following the
[Room baseline and repeat](bulletin-room-baseline-2026-11-17.md). No artwork or
latency patch is selected from these successful observations.

## Evidence and scope

The supplied exports are observed at `2026-11-17T05:17:14.802Z` and
`2026-11-17T05:21:25.113Z`. The second repeats the same initial selections and
extends the same in-memory context with Room preparation and another selection;
these are not independent trials. The
[structured record](bulletin-track-change-artwork-2026-11-17.json) transcribes
selected observations, not a full raw-report archive.

The requested exercise uses existing Free Bulletin releases **Eskapade à engong**
and **Black panther anthem**, with distinct registered cover references. The
reports intentionally omit track identities. The solo manifests have encrypted
sizes 12,668 → 20,637 → 12,668 bytes; the later Room selection's manifest is
10,290 bytes. Do not assign that final selection an exact title/CID solely from
the request or these sizes. The owner's response binds the visual and audible
check; exact final Room release identity is not independently established.

The explicit result is:

> Solo/changements : OK ; Room/changement : OK ; son invité : OK

This answers the requested correct title/artist/cover and no-old-cover-return
check. Native appearance delay is not independently timed. Successful metadata
registration alone would not establish visible artwork or audible guest sound.

## Artwork ownership and reuse

| Artwork attempt | Recorded preparation | PNG metadata publication |
| --- | --- | ---: |
| 1 | Decode 6 ms, compose 58 ms | 63 ms |
| 2 | Decode 3 ms, compose 17 ms | 18 ms |
| 3 | Prepared PNG hit at 0 ms | 8 ms |
| 4, later Room selection | Prepared PNG hit at 0 ms | 9 ms |

Each previous artwork owner retires before the next request; the supplied
sequence has no late publication from a retired owner. This bounded trace and
owner confirmation support these observed changes, not every cancellation race.
Solo selection starts are **7.128 s** and **4.803 s** apart, after each preceding
PNG is ready. The exercise therefore does not test interruption before first
cover preparation completes or the signature/immediate-lock trigger.

## Playback and background boundaries

All three initial streaming selections have `forRoomCapture=false`; their media
elements reach `playing` after source selection in **388 / 129 / 98 ms**.
The first solo lock spans about **29.234 s**, including a Pause while hidden
after about **26.433 s**. Media advances from **8.311 s** to **34.676 s** and
remains paused on return. The pause's origin is not exported; the owner reports
no failure. A later approximately 120.754-s hidden interval is already paused
and is not continuous-playback acceptance. The ~26-s age at a later solo
segment completion is not a Room preparation time or, by itself, a stall.

The extended report completes Room preparation attempt 5 in **1.056 s**:
31 authenticated objects / 1,464,541 encrypted bytes, comprising **16 client
cache, 13 native Host and 2 HTTP recovery** objects. Attempt 6 reuses this
prepared source after authorization in 129 ms, preserves the paused 34.676-s
position, and reaches metadata in 210 ms before later explicit Play.

The later Room selection, attempt 8, prepares media in **1.198 s**: 25
authenticated objects / 1,150,652 encrypted bytes, comprising **2 client cache,
21 native Host and 2 HTTP recovery** objects. Its final replacement reaches
metadata in 108 ms and `playing` in 130 ms from that source selection. Both
complete readers record two rejected native probes recovered by the
catalogue-gated Bulletin API, with **zero HTTP failures**. Counts are successful
objects; overlapping work totals are not wall-time components. Definitions
remain in the [measurement guide](../../../how-to/measure-room-startup.md).

`selection-interrupted` ends the previous host selection when this new one
begins. It accompanies the requested change, not an independently reported
unexpected playback error. The initial and final `source-selected` events
within attempt 8 are not two complete Room preparations.

The replacement's output records `hidden` → `visible` over **30.376 s**, with
running/unpaused/ready boundary states. Media advances from **15.160 s** to
**45.520 s**, approximately **30.360 s**; a later foreground Pause occurs around
47.388 s. These are boundary observations, not continuous sound sampling. The
owner's guest confirmation supplies audible acceptance. No end event is present.

## Decision and remaining scope

Accept this bounded solo-return and Room-change artwork check alongside the
two successful same-release Room starts. No additional unchanged exercise is
selected just to accumulate positive reports. Keep #388 open for unobserved
native previous/next layout and queue behavior, stop/disconnect metadata cleanup,
interruption before first image readiness and the signature/immediate-lock
trigger. The past intermittent native-display failure is not diagnosed or
declared universally fixed by these positive observations.

The [selected sequence](../listening-and-publication-readiness.md#product-work-first)
allows bounded **#406 CASH-tip feasibility research** while remaining device
acceptance waits. That is the next research step, preserving existing contribution
semantics and its go/no-go boundary. #408 access settlement follows separately;
compact activation, broader #395/pilot gates and owner-deferred real recovery
remain unchanged. This evidence changes no software, service, key, access rule,
funded allowance or publication, and fetches no remote audio or content key.
