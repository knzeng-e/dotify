# Room stream + sync fixes

Three reported real-time defects in host-to-listener room streaming, their root
causes, and the fixes. All are in the WebRTC/audio path; none change the room
access doctrine (host satisfies the policy, listeners get only the stream).

## Symptom A - listeners joining by link/QR often hear nothing

Two contributing causes:

1. `captureAudioStream` threw when the captured `MediaStream` had zero audio
   tracks. Capture runs at `loadedmetadata`, before the element is actually
   playing, so a transient zero-track capture aborted the whole host stream and
   no offer was ever sent. Fix: capture no longer throws on zero tracks; the
   caller checks for a live track instead and retries on `play`
   (`PersistentAudio` now also calls `onPrepareLocalStream` in `onPlay`). To
   avoid retrying a genuinely trackless source forever (unsupported codec,
   silent asset), a bounded counter (`nextCaptureAttempt`, ceiling
   `MAX_CAPTURE_ATTEMPTS`) surfaces "Capture unavailable" after a few attempts
   for the same source; a live track resets it.
2. Genuine browser autoplay policy: a listener with no user gesture cannot
   auto-start audio. This already surfaces as `autoplay-blocked` with a "Start
   audio" control in `PlayerView`; unchanged here. It is expected mobile
   behavior, not a bug, and the control is the honest answer.

## Symptom B - host changes track or loops, listeners do not hear the new audio

- Track change / next: on a new source the element fires `loadedmetadata`, which
  re-runs `prepareLocalStream`. That now re-captures the new `MediaStream` and
  swaps the outgoing audio sender with `RTCRtpSender.replaceTrack()` for each
  connected listener. If a browser rejects the sender swap, the host falls back
  to a one-listener renegotiation instead of leaving that listener silent. The
  previous throw-on-zero-tracks could make this silently fail; fixed as in A.
- Loop / replay: repeat was implemented by replaying on the `ended` event. When
  an element fires `ended`, its `captureStream()` audio track ends too, so the
  room went silent on loop. Fix: repeat now uses the element's native `loop`
  property, which seeks back without ever firing `ended`, so the captured track
  stays live and the room keeps hearing the looped track.

## Symptom C - clicking next keeps playing the old track (visible delay)

`selectTrack` updates the title/cover/track info synchronously but only sets the
new `audioSource` after an async access check + decrypt/fetch. During that gap
the old source kept playing while the UI already showed the new track. Fix:
`selectTrack` pauses the current element immediately at the top; the new source
autoplays once it loads.

## Efficiency: no peer churn on play/pause/seek/next

`prepareLocalStream` is triggered by several element events. It now records which
`audioSource` the live stream was captured from (`capturedSourceRef`) and skips
re-capture/renegotiation when the source is unchanged and the stream still has a
live track. A real source change uses `replaceTrack()` on the existing peer
senders, so the listener keeps the same WebRTC session during a normal next/skip
flow. Full renegotiation remains only as the per-listener fallback when
`replaceTrack()` fails or no sender exists yet. This removes the teardown/rebuild
that a naive re-capture on every event would cause.

## Link/QR names

Guests landing on a `#/rooms/<id>` link no longer auto-join under the untouched
default "Listener" name. If a wallet-scoped or guest display name is already
remembered, the one-link join remains immediate. Otherwise the join modal opens
with the room code prefilled and requires the guest to pick their visible room
name before the host sees them in the listener list. Older localStorage entries
that stored the literal default "Listener" are ignored and cleared. Once inside,
a listener can rename themselves from the room panel; the signaling server
updates the listener record and broadcasts the room roster to every participant
live, so hosts and listeners see the same people.

## Manual QA (required - these are browser-timing behaviors, not unit-testable)

On two devices/tabs, host + listener:

1. Host starts a track, listener joins by link and by QR: listener hears audio
   (tapping "Start audio" once if the browser blocked autoplay).
2. Host clicks next: old audio stops immediately; the room switches to the new
   track within the load time; listener follows.
3. Host enables repeat and lets a track loop: listener keeps hearing it across
   the loop boundary with no silence.
4. Host play/pause/seek repeatedly: the listener is not disconnected/rebuilt each
   time (no repeated "Connecting..." blips).

## Follow-ups

The Playwright room spec covers the deterministic browser path: protected to
public track switching increments the `replaceTrack` counter without creating a
second WebRTC offer, and first-time share-link guests must choose a room name.
Still validate on two real devices before production release, especially on
mobile browsers where autoplay policy and `captureStream()` behavior can differ.
