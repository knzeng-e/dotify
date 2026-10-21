# W32 new-publication path, 2026-10-21

## Identity and delivery boundary

- Issue #287, refs #88; branch `feat/streaming-publication`.
- Starting tested dev: `cdf92d8a224ebc4323debef53f4ddc26e07c01e1` (#312),
  Dev Quality Gates `39525275473` passed.
- Tested implementation SHA is attached to the containing PR after the source
  commit, avoiding a self-referential hash in this record.
- Code: implemented and locally verified. Release: **not deployed/activated**.
- W30 API non-root/storage is prepared in #316 and remains a hard activation
  prerequisite. Production streaming startup refuses a non-1000 API UID.
- Owner choice: **new publications first**. Existing DAV2 re-encoding is deferred.
- Owner-authorized fresh testnet contracts/CDM are recorded separately in #317;
  this branch does not change their addresses or deploy Web/Product/services.

## Result

Signed/scoped upload admission now feeds a durable encrypted queue and returns
HTTP 202. One running job sends clear audio to an isolated parser service, then
the API encrypts/pins an immutable authenticated directory and returns its v3
reference. Artist registration remains a separate explicit approval after assets
are ready. Studio status shows queued/encoding/protection/storage steps, retains
an account-scoped preparation hint across reloads and permits bounded retry or
explicit discard of a known failed preparation. Active/foreign jobs cannot be
discarded. Form contents/raw File are not persisted; reselect the same file to
resume after reload without re-uploading its bytes.

The reader uses existing canonical signed/session/Free key authority, authenticates
v3 scope/manifest/media and applies gain to the same local/room audio graph.
Standard AAC MSE reads ahead a small window; a browser without it uses a bounded
Blob of the **encoded AAC rendition**, never the archive. Experimental
ManagedMediaSource eviction/refill is not assumed without native evidence.
Existing DAV2 playback and walletless guest WebRTC remain unchanged.

See [operations, resource measurements and rollback](../../../operations/streaming-publication.md)
and [format/nonce decision](../../../adr/0032-streaming-renditions.md).

## Durability and isolation invariants

- No raw master or key is durable in the queue. An admission envelope and encrypted
  source commit by directory rename before indexing; the index gap is recoverable.
  Known uncommitted encrypted inputs can be removed; unknown entries fail closed.
- Expiry/discard uses durable tombstones. A crash cannot reset an accepted job to
  missing source, erase a nonce reservation or silently resurrect an old job.
- Every encryption generation is permanently reserved under the actual derived
  key. A crashed encode burns its generation. Completed ciphertext is authenticated
  and reused on pin retry; no AES invocation is repeated for those objects.
- Missing queue/nonce custody stops startup/work. Explicit fresh initialization
  refuses an existing store; it is not a recovery shortcut.
- The isolated image has no API/custody/config/dependency tree or volume. Startup
  refuses known custody/signing secrets. Its token is a distinct service credential.
  Tests use a private Docker network, read-only roots and bounded tmpfs/resources.
- Runtime authority is checked at admission, execution and before storage
  publication. Progress/retry/discard require the original owner/session chain.
  Guests receive no source key or archive selection through the playback reader.

## Observed local evidence

Environment: macOS arm64 host, Node 22.13.1; Linux/arm64 Docker 28.0.1,
Debian FFmpeg 5.1.9-0+deb12u1 / GPL-2.0-or-later. All media, grants and keys in
these checks are synthetic.

| Check | Observed result |
| --- | --- |
| API full suite | 203 passed, 0 failed/skipped, including queue admission/restart/tombstone recovery, retry ciphertext reuse, scoped upload replay and private status/discard, v3 canonical access and bounded relay checks |
| API typecheck/build | Passed |
| Codec/nonce suite | 6 passed, including real FFmpeg decoding, invalid/cancelled parser cleanup, key/nonce uniqueness and tamper/order/scope refusal |
| Web unit suite | 1013 passed across 127 files, including explicit-only discard |
| Web lint/build | Passed; two existing App hook warnings and existing bundle/Browserslist notices retained |
| New actual reader/graph journey | Chromium and WebKit pass, using the real v3 reader, relay transport, persistent audio/gain module and live capturable track; no archive or unused rendition is requested |
| Full reader/compatibility matrix | 16 passed across Chromium and WebKit; physical Product is not inferred from WebKit |
| Frozen Product build and formatting | Passed; native execution remains a separate gate |
| Isolated 60-second encode/publication | Passed: 15,801 ms; controller peak 141,900 KiB; encoder peak 56,987,648 bytes; actual object authentication and malformed/unauthenticated refusal |
| Isolated 900-second / 43 MiB WAV stress | Passed within 512 MiB controller/parser test limits: 148,491 ms; controller peak 462,272 KiB; encoder peak 268,025,856 bytes; no live service or external network |
| Final isolated image rehearsal | Passed after admission/recovery/isolation integration; CI repeats it independently |

The stress controller has a verifying pin sink, not real multipart Pinata or the
whole HTTP API/relay under load. Its peak explains the proposed **1 GiB API and
two-upload cap**; it does not justify activating the old 512 MiB service under
combined load. Encoder image: 642,868,681 bytes, including distribution FFmpeg;
build/license/package records are retained in the image. No new npm dependency.

One WebKit fixture run initially timed out because the test-only API used
restricted port 9; the actual-path fixture now uses its local server port.
Browser security was not disabled. Linux Firefox remains a hosted-CI gate;
previous local macOS SWGL/sandbox launch failure is not a pass or skipped support.

## Acceptance and remaining gates

| W32 outcome | Implementation/local evidence | Remaining |
| --- | --- | --- |
| Three protected AAC renditions, preserved encrypted master and loudness | Codec + isolated job + browser authentication | Representative music and hosted load |
| Durable bounded studio jobs, progress/retry | Recovery/auth/private progress tests, no duplicate encode on pin retry | Real network reload/failure in the studio |
| Actual reader/player/room integration and gain | Real Chromium/WebKit path and capture | Real Product Desktop/mobile audio, gain/mute/seek/repeat and guest media |
| Existing release compatibility | DAV2 suite and unchanged references | Live mixed-catalog check before reset |
| Permanent nonce/key authority | Existing nonce tests plus interrupted job/retry/recovery proofs | Owner-reviewed full custody backup/restore on Fly |
| Existing-catalog conversion | Explicitly deferred by owner | Separate later scope; no legacy ciphertext rewritten |

No Fly worker/app/volume/secret, Web/Netlify/DotNS publication, real Pinata upload,
funded payment or participant contact occurred in this implementation branch.
Live activation requires #316, the reviewed private encoder/custody provisioning,
#317's coordinated new-directory cutover and W13/#88 acceptance. Keep v3-aware
clients/API on rollback and preserve the complete nonce reservation union.
