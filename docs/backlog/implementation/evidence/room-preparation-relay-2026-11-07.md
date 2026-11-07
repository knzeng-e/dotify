# Room preparation: respect relay capacity and expose local failure evidence

Refs #395; follows owner acceptance in deployed Web/Product 0.1.79 and the
separate delivery record #403. Branch starts from tested dev `27060674`.
This is a client candidate; deployed services and musical assets are unchanged.

## Observation and demonstrated boundary

In the requested 0.1.79 Adang Fobe phone test, the owner confirms audible
pause/resume, close/reopen at zero and Room → solo. Room preparation still needed
two or three attempts with audio-slow errors, before listening succeeded. The
follow-up screenshot shows solo at 0:00 / 0:00 after an attempted Room, as the
owner clarified; it does not establish a fresh direct-solo startup failure.

Adang Fobe uses the existing registered IPFS v3 reference, not the Bulletin
prototype. Its public authenticated-manifest declaration has a 283.1-second
track, 71 media segments plus init and 3,551,276 encrypted bytes at 96 kb/s.
One bounded public manifest read succeeded in about 0.21s from this operator's
network. No content key, musical plaintext or phone request trace was collected;
that observation does not measure the owner's startup.

A cross-layer mismatch is demonstrable in source: `readCompatibilityAudio`
prepares four objects concurrently, but `createEncryptedMediaReader.read`
(`services/api/src/services/encryptedMedia.ts`) allows only two distinct upstream
downloads in its process. The extra reads receive MEDIA_BUSY/503 while the first
two are pending. The client then tries other gateways, spending startup time and
potentially failing even when the original relay could serve the track. A
controlled full-length test reproduces this failure with the unmodified client.
This is a proven failure mode, not a measured attribution of every phone failure.

## Client backpressure and cancellation

`fetchStreamingObject` acquires a shared client-local FIFO slot only for its
known `/api/media/` relay URL. At most two such requests run concurrently,
including response bodies. The existing four-object read/decrypt window and
ordered authenticated appends remain. Public gateway/native recovery, ciphertext
cache validation, credentials omission and authenticated length checks retain
their ordinary behavior; cache hits require no network slot.

A queued request is removed on owner cancellation before it can fetch. An active
request releases its slot on complete body, failure or abort, once. Queue waiting
uses the enclosing selection/prefetch signal. Per-request network deadlines begin
when a slot is granted; the existing 60-second post-authorization selection bound
still covers the whole preparation. This avoids adding timeout time just because
four useful future reads are queued. No key grant is queued or cached here.

Raising API capacity would increase shared server resource pressure and require
server rollout; reducing the entire compatibility producer would also constrain
healthy non-API paths. The narrower client relay queue respects the deployed
boundary. Other clients may still occupy the process, so it does not guarantee
all 503s disappear. Canonical access and byte authentication remain authoritative.

## Support evidence at the failure itself

The existing identifier-free `serializeAudioDiagnostics` is now reachable through
**Copy support report** in solo/host playback-failure presentation. It snapshots
bounded local startup/output observations and the build identity. URLs, CIDs,
accounts, keys and arbitrary error text are omitted by the existing serializer.
Copying is explicit and sends nothing to a service. If the Host denies clipboard
access, a labelled readonly textarea lets the owner select the same report.
The primary retry remains available; guests gain no content-key request or host
control. No debug profile, automatic telemetry, permission or environment change.

## Validation

The two initial transport regressions fail before the correction: the full-length
read cannot recover from self-triggered busy responses; the third body begins
instead of remaining queued. After correction, 72 ordered objects complete in
36 simulated seconds at one second per upstream object, with peak two relay
requests, zero busy responses and zero fallback traffic. Separate cases cover
body completion, queued cancellation and an active aborted body releasing a slot
for the next selection. Native/Bulletin, edge fallback and warm-cache regressions
remain covered.

Local Node 22 validation: 1,104 unit tests across 145 files pass, Web and frozen
Product builds pass, and ESLint has zero errors (two existing App.tsx hook
warnings). All 42 applicable Chromium encrypted-audio continuity cases pass;
the existing native-WebKit-only case remains excluded on Chromium. All six
WebKit listening controls/artwork cases pass. Three new encrypted-playback/report
cases pass on both Chromium and WebKit, including sanitized copy and Host-denied
clipboard fallback. The final explicit same-track retry case also passes on both engines: failed
complete preparation is not reported as ready, then an explicit solo retry
reauthorizes and plays without page reload. New remote CI remains a separate gate.

Changed files are formatted. A broader Prettier probe also reports three
untouched baseline files (`tokens.css`, `mobile-accessibility.spec.ts`,
`streaming-format.spec.ts`); they are outside this correction. Existing build
bundle-size/Browserslist/third-party annotation warnings remain.

## Review and delivery gate

Review `mediaRelaySlots` → `fetchStreamingObject` against the server's capacity,
then the complete-rendition and cancellation tests. Check `AudioFailureDiagnostics`
→ shared serializer → PlayerView: copying must not request media/keys, retry or
alter playback; denied clipboard needs a usable local fallback.

This candidate needs review and matching Web/Product delivery before another
phone acceptance test. No API/signaling deployment, storage operation, musical
upload, allowance change or automatic retry budget is activated. Keep #395 open
for reliable full-track cold startup and broader native lifecycle evidence. If
after delivery the error persists, capture the local report before retrying so
actual transport/preparation/output phases can guide the next correction.
