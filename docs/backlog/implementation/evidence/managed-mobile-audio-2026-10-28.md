# Managed mobile AAC: implementation and acceptance

Refs #88 / W08. Owner-selected priority: mobile first sound and a shorter audio
path, before adding delivery services or changing hosting capacity.

## Identity

- Base: `ea0dfcb24c8ae89e513fd03a6eb397a5b26bbfda`, after #344 merged to dev.
- Branch: `fix/mobile-progressive-audio`.
- Tested implementation: `b68ac56eead6802bc4d858afc9ba93ec8196c958`.
- The following commit adds documentation only. No deployment, payment,
  infrastructure provisioning, secret rotation or contract change occurs here.
- Physical Product mobile remains unverified. #88 stays open.

## Before and after

The previous selector recognized only standard AAC `MediaSource`. Without it,
the compatibility reader fetched and decrypted every 96 kb/s segment before
making a playable Blob. An iPhone engine exposing `ManagedMediaSource` could
therefore wait for a whole track despite being able to stream it.

Selection is now: supported standard AAC MSE, supported managed AAC, then the
existing bounded compatibility reader. Standard desktop adaptation is preserved.
No user-agent guess, feature flag or extra server is needed. On the managed path,
first playback requires the authenticated manifest, initialization and early
media segments, not all remaining segments. About reports the selected capability;
that label is not proof of actual audible output.

## Design and deliberate limits

The **Listening startup Module** retains the existing authorized URL **Interface**.
`streamingMediaSource.ts` owns the capability/attachment **Seam**, with standard
and managed **Adapters**. Its **Implementation** configures the native element
before `src`/`load`, so callers cannot accidentally enable a source too late.
This provides **Depth** by hiding platform attachment rules; **Leverage** is the
same contract for active and silent successor elements, and **Locality** keeps
those rules out of hooks and views.

`managedStreaming.ts` owns one event-driven producer. Native `startstreaming`
and `endstreaming` control reads. Seeking aborts obsolete downloads; native
SourceBuffer updates finish serially before another append. Buffer eviction
invalidates segment presence and re-reads only the affected window. Native
frame replacement is not mistaken for eviction. An ended source can reopen
using its already authenticated init. The reader retains presence indexes and
one small init, not a clear full-track cache.

The window is approximately 30 seconds ahead for active playback and 4 for a
silent successor, using W32's fixed nominal four-second fragments with an AAC
boundary margin. It waits on native events while idle, not a polling loop.
Absent initial demand fails after 20 seconds; the existing overall startup
budget remains. Repeated eviction/refill of one segment is bounded. An
unexpected source close reports failure. Source cancellation removes listeners,
cancels downloads and retires the managed URL attachment registration.

This first managed adapter stays at **96 kb/s**. Standard MSE retains W35 adaptive
quality. Combining mobile lifecycle, memory eviction and quality switching would
make native failures harder to isolate. A future managed quality change must
preserve authentication, segment alignment and measured continuity.

WebKit requires an AirPlay alternative or remote playback disabled for managed
sources. Dotify sets `disableRemotePlayback` only for its managed audio URLs,
before active or standby attachment. There is no public clear-media URL, so
URL-based AirPlay is unavailable for this path. Standard sources and room guest
streams are unchanged. The browser may decline silent preload; an unready
successor expires without interrupting current playback.

A constructor-name alias alone was rejected: it cannot correctly honor native
demand or refill evicted media. Removing access checks or adding an unencrypted
media endpoint was not an acceptable route to faster startup. More API replicas
would not eliminate the full-rendition client wait.

## Trust and operations

The existing key service remains authoritative. Every manifest/init/segment is
bound to the same release and authenticated before use. Denial and corruption
fail closed; no different key, archival-master read or full-file fallback is
introduced after a managed failure. Short-lived standby grants and cached-media
reauthorization remain unchanged. Room guests still receive only WebRTC audio.

No migration, environment setting, CDN or new bill. Publication must use reviewed
Web/Product artifacts with exact version/SHA/CID recorded. Rollback is the
preceding reviewed client artifact; W36 trust state/custody must not be reverted.

## Verification

- Audio browser suite: **73 passed**, one intentionally skipped native-MMS case
  on Chromium. Real synthetic AAC decodes in Chromium and WebKit. Managed event
  simulation covers first playback while the second segment is held, demand
  gating, eviction, pause intent, cancellation, denial, corruption and prepared
  successor adoption. Existing standard/compatibility cases still pass.
- **Native local WebKit ManagedMediaSource**, not the event simulation: first
  playback while the second segment is held, then real native bufferedchange
  and demand events after removing buffered media and seeking backwards: pass.
  This is desktop WebKit, not physical iPhone or Product evidence. CI platforms
  without native managed AAC explicitly skip this native-only case.
- Full unit suite: **1,039 passed**. Twelve focused unit cases cover capability order, URL ownership, demand,
  cancellation, bounded refill, source closure, frame replacement, eviction
  during append and cleanup without idle polling.
- Four About browser journeys pass: safe diagnostics, managed capability,
  narrow layout and denied clipboard. No account data is added to copying.
- Web and frozen Product builds/typecheck pass. Lint has zero errors and the
  two pre-existing App.tsx effect dependency warnings. Existing build warnings
  concern chunk size, Browserslist age and third-party annotation.
- During development the corruption test initially asserted the pre-source
  failure field instead of the progressive player's terminal `no-audio` state;
  corrected to assert terminal playback and one key/one corrupted read. The
  older Blob fixture also needed to disable both streaming APIs explicitly.
  These were test setup/assertion corrections, not relaxed access checks.

No physical first-sound percentile or cost reduction is claimed. The relevant
native test exercises decoded playback-clock progress, not human-heard output.

## Remaining release gate

After review and publication, use **You → About Dotify** to bind the installed
version/build and reader, together with Host version, OS, device class and
network. Test cold/warm Free playback, already-authorized protected playback,
denial, seeking/repeat, cancellation, successive tracks, background/screen lock,
return to the app and room-host audio capture on two devices. Collect schema-6
first-sound samples with explicit audible confirmation and report failures and
p75 rather than inferring speed from HTTP or synthetic test times.

If the Host lacks managed AAC, record that fact and the compatibility latency;
do not claim this implementation is active. Native managed adaptive quality and
shorter ciphertext retry budgets are separate possible follow-ups after these
observations. No infrastructure downscaling is authorized by this change.

## Primary platform references

Checked 2026-10-28:

- [WebKit Safari 17.1](https://webkit.org/blog/14735/webkit-features-in-safari-17-1/):
  iPhone ManagedMediaSource and the remote-playback condition.
- [WebKit media sources and AirPlay](https://webkit.org/blog/15036/how-to-use-media-source-extensions-with-airplay/):
  URL-based remote playback and managed demand.
- [Media Source Extensions Editor's Draft](https://w3c.github.io/media-source/#managedmediasource-interface):
  managed demand and buffer cleanup. This is a work-in-progress specification,
  not a stable guarantee of any Product Host implementation.
