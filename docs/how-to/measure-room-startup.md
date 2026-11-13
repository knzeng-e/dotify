# Measure a slow Room start

Use this guide to report a slow or interrupted Room start on a matching client
build. The report also works after successful listening. It helps distinguish
access checks, authenticated media loading, local audio preparation and native
readiness; it does not measure what a person actually hears.

## Collect a comparable observation

1. Record the Dotify version in **You → About Dotify**, the Polkadot app/runtime
   versions if relevant, device and network. Use the same existing track and
   account for before/after comparisons; do not publish or purchase again.
2. On the phone, open a Room once and let preparation finish or fail. Note the
   approximate time and any retry. Do not clear the browser cache or relabel a
   repeated warm run as cold. The Host cache state may be unknown.
3. If ready, let Web/Desktop guests join, then explicitly play. Record whether
   the host and each guest hear sound; a connected peer or moving bar is not proof.
4. Open **You → About Dotify → Listening support → Copy support report**. The
   failure panel offers the same action. If the Host refuses clipboard access,
   select the report in the displayed text field. Opening the section alone
   neither copies nor sends anything.
5. Keep the original report alongside your observation. Repeat comparable starts
   and retain failures too. Reports are recent in-memory evidence, lost on reload;
   copy before closing the app. Do not infer a latency percentile from one run.

For lifecycle acceptance, also note actual audible host/guest behavior during
phone lock, unlock and explicit recovery. Start with 10–15 seconds locked, then
an extended/full-track run. Include any interruption, resumed position and whether
Play was needed. Desktop emulation cannot establish iOS background acceptance.
The report includes bounded output/context observations, not a microphone recording
or a proof of acoustic output.

## Check a solo-to-Room handoff

On a client containing [the continuity candidate](../adr/0059-preserve-solo-during-room-preparation.md),
start an existing full-length track in solo before opening its Room. While the
Room is preparing, check that the original sound and controls remain usable.
Seek once, then check that handoff continues from that live position. Repeat with
an explicit Pause during preparation: the replacement must stay paused. Cancel
one preparation and verify no late Room appears and solo listening remains usable.
Also test lock/unlock during the wait and after hosting with audible guests.
Record this separately from cold Room startup without an existing solo source.

The candidate emits a separate streaming preparation attempt before the normal
handoff selection. Its completed-source reuse is not a cold second download.
Keep both attempts when interpreting the local report; do not subtract timestamps
from different attempt origins or count native clock advancement as audible sound.

## Read the report

The additive fields below belong to `dotify.audio-diagnostics.v1`.
The report contains at most 160 streaming and 160 host events, plus 96 output
observations. Long/repeated sessions can evict early events. Missing phases are
unknown, never zero-duration or evidence of success.

| Field or phase                                              | Meaning                                                                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attempt`                                                   | Export-local number shared by a selection's streaming and host events. It is not an account, track, Room or reusable identifier.                                                      |
| `readAttempt`                                               | One-based preparation try inside a selection. A quiet retry gets another number without becoming another user action.                                                                 |
| `forRoomCapture`                                            | Capture intent when preparation began, rather than whether a Room happened to exist later.                                                                                            |
| Streaming `elapsedMs`                                       | Monotonic milliseconds since this preparation try began. It resets on retry.                                                                                                          |
| `selectionElapsedMs`                                        | Monotonic milliseconds since the corresponding selection began, including earlier attempts and waits.                                                                                 |
| `preparation-started` → `key-authorized`                    | Access/key wait for this try, including any user interaction required by the existing path.                                                                                           |
| `manifest-ready`                                            | Manifest fetched and authenticated; compact Host preparation is included where applicable.                                                                                            |
| `compatibility-reader` → `compatibility-downloaded`         | Complete lowest-rendition collection, including scheduling, transport and authentication.                                                                                             |
| `compatibility-downloaded` → `compatibility-ready`          | Local MP4 assembly and Blob URL creation. This is not audible output.                                                                                                                 |
| `prepared-source-reused` / `prepared-source-adopted`        | Cached complete media / prepared element reuse. Do not count either as a cold download. Access checks still apply.                                                                    |
| Host `source-selected` → `metadata-ready` / `media-playing` | Native element readiness/playing events. Host elapsed time uses its existing element/gesture origin, not the streaming origin. Correlate by attempt; do not subtract unlike clocks.   |
| `error`                                                     | Classified failure within the captured scope. An intermediate reader failure may be followed by a successful retry. Host terminal errors distinguish cancellation and other failures. |

At manifest readiness and compatibility boundaries/errors, `readTimings` is a
snapshot for that reader try:

- `objectsRead`, `encryptedBytes`: successfully received manifest/init/segment
  objects and their bytes. Internal fallback attempts are not separate objects.
- `objectsDecrypted`: successfully authenticated manifest/media operations.
  Failed authentication contributes time but not a successful count.
- `cachedObjects`, `hostObjects`, `httpObjects`: successful transport categories.
  An unclassified/custom transport can leave their sum below `objectsRead`.
- `recoveredObjects`: successful objects delivered after a reported fallback.
- `readWorkMs`, `maxReadMs`: cumulative and maximum completed object-read duration,
  including relay admission, internal retry/body wait and failed completed calls.
- `decryptWorkMs`: cumulative completed authentication/decryption work duration.

**Parallel work durations overlap. Never add them to wall time.** A failure
snapshot can precede completion/cancellation of sibling reads. Parent cancellation
suppresses late reader events; the host terminal event remains authoritative for
that selection. The report does not invent timings for unfinished work. It does
not isolate network RTT from relay queueing or Host internals.

## Privacy and operational limits

Collection is local, bounded and has no backend or persistent storage. Sharing
requires the explicit copy action. The serializer excludes source URLs, CIDs,
account/track/Room identities, keys, raw exception detail and arbitrary properties.
It retains build identity, times, coarse transport counts and allowlisted object
paths. Those observations can still reveal when an app was used; share knowingly.

No timeout, buffer size, concurrency, entitlement, capture policy or automatic
retry behavior changes. Successful preparation does not establish guest sound,
background continuity or faster startup. The next correction must follow matched
phase reports and preserve the existing 60-second media deadline and 40-MiB
compatibility limit.

Source: [telemetry and export](../../web/src/features/catalog/audioStartupTelemetry.ts),
[read aggregates](../../web/src/features/catalog/streamingReadTimings.ts),
[reader](../../web/src/features/catalog/streamingPlayback.ts), and
[selection ownership](../../web/src/hooks/useCatalog.ts).
Acceptance scope: [Room startup](../backlog/room-listener-audio.md).
