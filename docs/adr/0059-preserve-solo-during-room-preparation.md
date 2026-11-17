# 0059 — Keep solo listening alive while preparing a Room

Date: 2026-11-13. Status: implementation candidate, not deployed.
Refs #395. The [Room-start measurement guide](../how-to/measure-room-startup.md)
owns device acceptance; this decision does not establish faster downloads or
uninterrupted physical background hosting.

## Problem and decision

Opening a mobile-hosted Room can require a complete authenticated AAC rendition:
managed streaming may play locally without providing Web Audio capture samples.
Previously, selecting that replacement immediately retired the audible solo
source and saved its position before the wait. A slow preparation therefore
turned an invitation to listen together into silence.

For an explicitly requested Room of the **current managed-source track**, prepare
that complete rendition while leaving the existing solo selection, media element,
producer and transport untouched. Once prepared, use the ordinary selection path
and its authorization checks to replace the source. Capture the media position
at that handoff, including any seek made during preparation. Preserve the current
playback intent at the Room gesture, including a pre-existing or subsequent
explicit Pause. Sharing the current track never requests a new Play.
Different-track selection still retires the outgoing track immediately; ordinary
Web/Desktop sources keep their existing Room path.

## Ownership and failure

`web/src/features/player/roomAudioPreparation.ts` owns one candidate controller.
Room cancellation, selection retirement, identity/lifetime change or a replacement
candidate cancels that candidate. It never owns the audible solo producer. A
bounded race rejects even an abort-ignoring transport; the reader checks its
owner before publishing a Blob URL or caching complete media. A stale completion
cannot select a source or open a Room. Matching cleanup removes listeners/timers
without canceling a newer candidate.

`useCatalog.prepareCurrentTrackForRoom` captures selection, source and preparation
identity and rechecks them. Its explicit `room_host` purpose is passed through
the key request without mutating the current solo purpose. The Free endpoint
still verifies canonical Free policy; its existing purpose-specific prepared-key
lookup is unchanged. Protected requests retain their signed Room-host purpose.
The subsequent selection still revalidates authorization before reusing the
completed Blob: media readiness is never an access grant. Guests never request
content keys. Existing account/access interruption still retires protected output.

The media budget starts after authorization and remains 60 seconds across
preparation and handoff, rather than acquiring another full allowance at source
replacement. Wallet authorization has its existing separate bounds. The complete
lowest-rendition reader keeps its 40-MiB clear-audio limit and existing read window;
no master, public clear URL, microphone, extra retry or persisted key is added.
A candidate failure leaves the solo source alone, cancels Room creation and offers
an understandable retry notice. A current authoritative key denial retires solo output and shows the access
gate too; it is not treated as an ordinary preparation failure. Account/access
revocation retains authority over solo playback.

## Tradeoffs and remaining checks

The prepared Blob and the current streaming decoder coexist briefly. This improves
continuity while preserving the existing compatibility requirement; it does not
reduce network preparation time or prove a total process-memory bound. Preparing
speculatively before a Room gesture would do unnecessary authorized work and is
not included. Reusing the managed element directly would reintroduce the reported
silent capture path. A format/capture redesign requires separate evidence.

The local synthetic browser regressions exercise real encrypted AAC, native
clocks, seek, pause, cancellation and track change. Controlled wall-clock expiry
makes the bounded ciphertext cache cold; media clocks and playback
timers are not fast-forwarded. They do not establish acoustic output on an iPhone.
After matching Web/Product delivery, measure repeated full-length starts, audible
host/Web/Desktop guests, cancellation, paused handoff and lock/unlock during the
wait and after hosting. Keep #395 open until that matching acceptance.
