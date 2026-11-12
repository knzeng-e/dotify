# Compact Bulletin delivery and admission

This reference helps contributors trace an explicitly compact release from its
storage admission to encrypted delivery. It describes the implementation
candidate for #407, not a deployed format or permission to publish. The recorded
services remain Web/Product/public API 0.1.82 and custody #426.

[Decision](../adr/0054-explicit-compact-delivery.md) ·
[Dispatch evidence](../backlog/implementation/evidence/bulletin-compact-dispatch-2026-11-12.md) ·
[Codec evidence](../backlog/implementation/evidence/bulletin-compact-aac-2026-11-12.md) ·
[Prepared-recovery evidence](../backlog/implementation/evidence/bulletin-admitted-recovery-2026-11-12.md) ·
[Object-reader limits](bulletin-compact-reader.md) ·
[Publication procedure](../operations/bulletin-artist-publication.md).

## Registered reference

The portable grammar is defined in
[`streamingReference.ts`](../../services/api/src/services/streamingReference.ts).
API and browser callers supply their own existing CID codec; the module imports
no platform packages or configuration.

| Physical layout             | Registered audio reference                     |
| --------------------------- | ---------------------------------------------- |
| Standard `unixfs-files-v1`  | `dotify:enc:v3:key-vN:ipfs://ROOT`             |
| Compact `rendition-pack-v1` | `dotify:enc:v3:key-vN:bulletin-pack-v1://ROOT` |

`v3` remains the authenticated audio encryption format. `N` is the retained
content-key version, at least 2. `bulletin-pack-v1` identifies the fixed physical
graph from [ADR 0052](../adr/0052-bulletin-layout-inventory-binding.md); it changes
neither AES-GCM, key derivation nor access policy. Compact roots must be canonical
base32 CIDv1 DAG-PB roots with a 32-byte Blake2b-256 digest. Unknown versions,
query strings, paths and non-Bulletin compact roots refuse.

An old reference always means its existing path layout, including when its CID
uses Bulletin hashing. Do not infer a format from a CID, marker lookup, mutable
global setting or a failed read. Compact studio metadata keeps the complete
reference in `assets.audioCID`, with its existing `assets.keyVersion`. Standard
metadata retains its existing representation. Compact metadata with only a bare
root is refused before its durable claim or storage operation.

## Ciphertext delivery

[`media.ts`](../../services/api/src/routes/media.ts) admits only active, encrypted
catalogue releases matching both root and explicit format. One parameterized
Fastify route shares the existing 240 requests/minute limit across these paths:

| Reference layout | HTTP object path                    |
| ---------------- | ----------------------------------- |
| Standard         | `/api/media/ROOT/stream/OBJECT`     |
| Compact          | `/api/media/ROOT/compact-v1/OBJECT` |

`OBJECT` is `manifest.json`, or a quality 96/160/320 followed by `init.bin` or
`segment-000.bin` through `segment-255.bin`. Archive, direct pack, layout marker,
query parameters, HTTP ranges and arbitrary offsets are not exposed. Unknown or
inactive references return `404 / MEDIA_NOT_FOUND`. Conflicting compact
registrations for one root refuse instead of selecting an arbitrary key scope.

The public API serves **ciphertext only**. For compact requests it takes the
chain, runtime, content hash and key version from that catalogue registration,
derives the retained server key internally, and authenticates the manifest
before trusting its lengths. The API never accepts a client key or returns one
on this route. Missing retained keys, malformed graphs or authentication failures
return `502 / MEDIA_UNAVAILABLE`; a saturated reader returns
`503 / MEDIA_BUSY` with `Retry-After: 2`. The temporary derived key is cleared
when the operation ends. This use of custody verifies layout; it is not a new
listener entitlement or a substitute for the existing signed/session/Free key
request and canonical runtime checks.

Both formats share the Bulletin reader's two logical read slots and existing
raw RPC budget/cache. Each logical operation remains bounded by 12 seconds.
Responses use `no-store` and the existing 64-MiB aggregate sending bound. The
unchanged [object-reader bounds](bulletin-compact-reader.md#bounds) additionally
limit compact traversal and range reconstruction. Standard IPFS/Pinata delivery
keeps its current path and does not start requiring a retained key on this
ciphertext route.

In the Host, the manifest bootstrap uses its common `manifest.json` path. After
ordinary key delivery, the browser authenticates that manifest and prepares the
compact native object reader. Only then can it select later packed segments.
Returned objects still pass ordinary per-object AES-GCM before playback.
Native recovery uses only the matching compact API path, never a standard path
or an unrelated gateway. Ordinary Web uses that compact API path directly.

The short-lived warm cache includes layout, root and object path, retaining
ciphertext only. Cancellation is checked before cache reuse and again after a
native read. A late cancelled result cannot enter the cache or trigger HTTP
recovery. Manifest-only prefetch for compact releases never requests a key or
uses unauthenticated offsets. Existing decoder, adaptation, Room capture and
compatibility assembly receive the same logical objects.

## Immutable exact-source admission

The existing profile and base capacity remain standard. A compatible stopped
writer can inspect a new request with schema
`dotify.bulletin.release-extension.v2` and required
`audioLayout: rendition-pack-v1`, using the same exact owner/scope and reviewed
profile/admission digests as an existing extension. No UI or global layout
switch is added. The request applies only to a **new** release identity; a prior
claim or extension cannot be reclassified.

The extension procedure archives the previous ledger, then atomically creates
`dotify.bulletin.release-admission.v3`. Its extension records the layout; the
first durable release claim records it again before queue preparation. The
runtime compares claim, extension and audio inventory on startup/retry. Public
cover/metadata inventories stay standard. V1/v2 ledgers remain unchanged until
an explicit extension operation; ordinary standard extensions keep their old
schema unless a v3 ledger already exists. Unknown layouts or extra fields refuse.

The admitted publisher chooses the graph, preserves full dependency proofs and
retention, and constructs the external reference only from a matching ready
inventory. The queue stores that reference in its unchanged v1 job schema.
Restart and response-loss reconciliation retain graph, generation, nonce and
conservative attempt charges; no failed attempt grants a new allowance. The
whole original per-release budget, separate original slots, publisher lease,
account cursor and prior retention reservations remain authoritative.

## Automated codec acceptance

The [compact AAC harness](../../web/e2e/compact-audio.spec.ts) uses an FFmpeg
encoded 24.2-second synthetic tone, its real authenticated objects, and the
production standard/compact graph constructors. The loopback API runs the actual
catalogue media route, HTTP block reader and range reconstruction against those
graphs. The Host case injects only SDK block responses into the actual native
adapter; it is not a physical Product Host or bridge compatibility test.

| Check                                 | What it establishes                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 96/160/320 AAC → PCM                  | Each quality authenticates, reconstructs and decodes into nonzero real audio samples on Chromium, WebKit and Firefox, through Web and injected-Host delivery.                                                                    |
| Seek, mixed selection, cold transport | Decoded signal returns after forward/backward seeks, standard → compact → standard selection and a fresh browser/reader cache. Chromium/Firefox use progressive playback; WebKit uses the complete-rendition compatibility path. |
| Adaptive Web transport                | Chromium/Firefox decode 96 → 320 → 160 under controlled HTTP delays. This is an estimator/decoder regression, not a measured network speedup.                                                                                    |
| Compatibility Room capture            | The full compact rendition produces measured normalized source and loopback WebRTC guest signal, then reaches its authenticated duration.                                                                                        |

WebKit's progressive MediaSource-to-WebAudio signal is not accepted by this
harness. Existing progressive codec/container tests remain; the new WebKit
energy checks exercise compatibility playback instead. Native adaptive output,
physical Host/iPhone background behavior and real first-sound latency remain
separate acceptance work. A moving media clock alone never satisfies a signal
check.

The public fixture key and account scope are synthetic. The Node artifact keeps
the full encrypted graph for dependency checks, while the injected browser
receives only playback-reachable blocks. Tests reject external HTTP requests,
archive block reads and archive/pack/marker HTTP paths. They do not exercise
production key delivery or grant a listener entitlement. The cold restart clears
only in-memory transports; it is not a prepared-job repair, durable backup
restore, nonce recovery or rollback rehearsal. See the
[reproduction procedure](../operations/dev-quality-gates.md#compact-aac-acceptance).

Native progressive cases require no HTTP recovery in this fixture. The complete
compatibility reader can issue four logical reads against the unchanged shared
two-SDK-lookup budget. Its existing API recovery is allowed only for the same
registered root/format and is recorded by the harness; the test does not enlarge
the SDK budget or claim native-only compatibility preparation.

## Deployment and remaining gates

This source change runs no extension apply, network write, maintenance,
renewal, key transfer or deployment. Before any compact publication, deliver
matching Web/Product/API/custody readers and review a separate exact admission
and budget. Keep old encryption-key versions and complete inventories available.
An old binary cannot safely interpret the new reference or ledger: rollback must
retain compatible readers/state handling or stop new work, never erase layout
fields or restore an older ledger to obtain capacity.

Ordinary queue restart/retry has simulated compact response-loss coverage. The
[stopped-writer prepared-job recovery candidate](../operations/bulletin-prepared-job-recovery.md)
now verifies the original audio claim, layout, lineage and saved ciphertext for
admitted standard/compact work. It preserves cumulative charges, receipts and
nonce history; an older pilot-only binary still refuses this state. The
[generated backup rehearsal](../operations/bulletin-generated-restore-rehearsal.md)
adds an independent-runner artifact transfer and source-loss exercise for both
layouts; it uses public structural fixtures and simulated chain history.
Operational backup/key restoration, historical-binary rollback, physical Host
startup/seek/adaptation, Room/background behavior, real first sound and memory
pressure remain acceptance gates before activation. Automated AAC/sample checks
do not prove faster publication or audible physical-device output.
