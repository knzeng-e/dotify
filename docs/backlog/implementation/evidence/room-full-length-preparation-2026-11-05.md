# Full-length mobile Room preparation — 2026-11-05

Refs #395. Implementation candidate based on tested dev `9dc9708e`; no deployment,
new content upload, key request to a live release, policy change or renewal.

## Problem and evidence boundary

The owner confirms guests hear the eight-second release from a mobile host on
Web/Product 0.1.76, but reports **Adang Fobe** playing solo and stalling on Room
creation, then displaying audio-unavailable. The supplied 32-second recording
shows solo playback then preparation; the error is in a separate screenshot.
An exact phone request timeline is not captured. Public ciphertext-only reads
from the registered API describe 283.1 seconds, 72 init/media objects and
3,550,124 bytes at 96 kb/s. The first three objects return 200 from the operator's
computer; this does not measure cold mobile gateway latency or authenticate the
manifest without its content key.

The complete-rendition reader awaited every object sequentially. Seventy-one
one-second media round trips plus init cannot fit the existing 60-second startup
budget, though progressive solo playback can start after its first segment.
A controlled virtual-clock regression reproduces that expiration before the fix.
This demonstrates the serial latency weakness; it does not claim a measured
cause for every request on the owner's phone.

## Bounded reader and access state

`compatibilityAudio.ts` reuses `pumpStreamingReadAhead` with the current object
plus three future objects. Initialization and segments authenticate independently;
results may finish out of order but are collected in exact init/media order.
There is no unbounded Promise.all over a full release. Parent cancellation or an
observed authentication/transport rejection aborts the child read window. A late
result cannot publish a cancelled Blob or overwrite a newer selection.

Authenticated declared lengths reject an over-40 MiB rendition before any media
read. The existing retained clear-byte cap is also enforced while collecting.
The entire same 96 kb/s rendition must still authenticate before a Blob is
exposed: no archive/master access, microphone, guest key or weaker cipher path.
The 60-second global startup and per-object deadlines remain unchanged.

Verified ordered bytes drive a preparation percentage. This is preparation
progress, not audible output or a promise of instant Room creation. Speculative
or cancelled attempts cannot update the active player. Confirmed Free-key access
is kept separate from media readiness so a slow download does not label an
already authorized Free track Locked; a fresh denied key request still clears
that hint and downloads no media. The hint never authorizes a key or capture.

The tradeoff remains complete-rendition startup and bounded extra clear memory
on managed-only mobile hosting. Solo managed and standard MSE paths remain
progressive. Parallel reads reduce accumulated request latency but cannot turn
an unreachable origin into available audio. Existing retry and fail-closed
selection/capture/clock ownership remain authoritative.

## Validation and remaining gate

The 72-object virtual-clock case completes in 18 seconds at one second per read,
within the same 60-second bound; output ordering and a four-read peak are checked.
Separate cases cover out-of-order completion/progress, oversize early rejection,
parent cancellation and authentication failure aborting the bounded window.
Browser checks cover real AAC, denied and corrupted content, Free access during
preparation, retry/selection retirement and the unchanged global deadline.
Local outcomes: 1,093 unit tests pass; Web and frozen Product builds pass; lint
has no errors and only the two pre-existing App.tsx dependency warnings. Nine
Chromium regressions cover denial/corruption, Free preparation progress/access,
retry, selection retirement and both global-deadline cases. A locally generated
**283.1-second synthetic AAC** passes complete compatibility preparation, duration
and near-end playback checks on Chromium/WebKit, plus real WebKit normalized
WebRTC received-energy measurement: three passes, one managed-only test skipped
on Chromium. Test keys are public synthetic values; no artist key/content is used.
The same codec tests remain in CI with its ordinary synthetic fixture; the
283.1-second variant is local evidence, not a claimed remote/physical result.

## CI-discovered standalone-container correction

The first W35 run passed 30 cases but Linux WebKit reported only 4.01 seconds
for the 24.2-second compatibility fixture. Replacing the immediate metadata/seek
assertion with natural completion confirmed an actual early end at 4.87 seconds.
macOS WebKit and Chromium play the same concatenated bytes completely, so local
codec evidence alone did not expose this platform difference.

The encoder emits one `sidx` (segment index) per DASH segment. Concatenating those
as a standalone MP4 leaves each index describing only a short subsegment.
`compatibilityMp4.ts` replaces them with one complete index after all objects
have authenticated. It reuses each original `moof`/`mdat` payload byte in order,
without decoding or re-encoding samples, changing server content or bypassing
integrity checks. Only the local compatibility Blob changes; progressive readers
retain their original fragments.

This is deliberately limited to the existing FFmpeg DASH profile: one version-1
local index, one `moof`/`mdat` pair, contiguous timestamps, matching track and
timescale, and moof-relative data offsets. Malformed, external, discontinuous or
unsupported layouts fail before exposing a Blob. Box counts and lengths are
bounded. The replacement output is smaller than the authenticated input, so it
does not enlarge the existing 40 MiB budget. No new dependency, encoder setting,
service configuration or stored asset is introduced.

The browser regression now requires natural completion, a final media clock
matching the authenticated manifest and no media error. Its test-only deadline
follows fixture duration plus bounded overhead; production deadlines are
unchanged. Unit tests cover complete index references, payload preservation/no
mutation and malformed/unsupported index rejection. Local Firefox cannot launch
its headless graphics process; Linux WebKit and Firefox remain remote CI checks.

After matching delivery: use the existing full-length release, verify preparation
and actual Web/Desktop guest audio from the mobile host, then pause/resume, Next,
guest local mute/disconnect and same-track position. Background/cold-start
measurements remain separate. Do not infer this from the short excerpt or an
advancing playback clock. #395 stays open until matching physical acceptance.
