# W32: authenticated AAC renditions and nonce allocation

Date: 2026-10-20. Status: implementation decision, pending review and rollout.
Base: tested dev `e0d8c2c`. Refs #287, #88. This decision is recorded before
adding encoding/encryption code. Existing release bytes and access policy stay
authoritative; it does not authorize live migration or publication.

## Addressing and access

New releases will use `dotify:enc:v3:key-vN:ipfs://<directory CID>`; the fixed
`manifest.json` describes AAC-LC fMP4 at 96/160/320 kb/s, 48 kHz stereo, one
initialization object and approximately four-second media objects per rendition.
Objects, including the original archival master, are AES-256-GCM encrypted under
the existing release key. The archive is not a playback fallback. An authenticated
manifest binds all paths, lengths, order, identity, loudness and encryption
generation. CID immutability does not replace authentication with the release key.

The manifest payload is canonical JSON with an empty-plaintext GCM tag. Each
object's AAD is a canonical tuple of schema/version, chain, runtime, original
content hash, key version, generation, nonce scheme, rendition, kind, index,
nonce counter and plaintext length. Init, media and archive are different kinds.
Verification checks the expected canonical release before decrypting anything.
The key service keeps its existing signed/session/Free authority; no new key,
frontend master secret, guest key or client-provided access decision is added.

Archive exclusion is a playback rule, not artist-only cryptographic custody:
someone who already has the release key can manually fetch and decrypt the
archival object too. A separate archival key/authority would change the selected
same-key scope and is not introduced silently. Do not present this as DRM.

Existing DAV2 refs remain unchanged and playable. A later owner-authenticated
migration job may register a manifest CID in a durable off-chain rendition index
bound to the exact original audio ref and canonical release. Removing that index
rolls playback back to unchanged DAV2, not to a re-encrypted replacement. Key-v1
or unproven writer provenance is refused until a reviewed uniqueness proof exists.

## Nonce namespace, before implementation

[RFC 5116](https://www.rfc-editor.org/rfc/rfc5116.html#section-3.1) requires unique
nonces per actual AES key. AAD does not permit nonce reuse. Scheme
`dotify.gcm.high-counter.v1` uses **64-bit reserved generation || uint32 BE
(0x80000000 + object counter)**, counter 0..0x7fffffff. The manifest itself uses
one counter; all init/media/archive objects consume other counters in that same
generation, across all renditions. Re-encryption always reserves a new generation.

Why this can coexist with production release-bound DAV2: key-v2 was introduced
with the server DAV2 writer (#142/#150); it always writes sequential low counters
starting at zero. The upload budget is 50 MiB with 512 KiB chunks (and a bounded
smaller first chunk), far below 2^31 chunks. Its nonce counter's high bit is zero
regardless of its random prefix. W32 counters have that bit set, so even an
identical legacy prefix cannot collide. Enforce the low-half limit in the DAV2
writer going forward and reject migration containers exceeding it. This proof
does **not** apply to unversioned/key-v1 ciphertext whose older format used a
random full nonce. No claim is made about external writers outside this policy.

A reservation store is keyed by SHA-256 of the **actual derived key**, not just
its version/artist label, so aliases of the same key share the ledger. It stores
allocation metadata only. A candidate generation is created exclusively on the
existing local durable filesystem; its file and parent directory are fsynced
before encryption is possible. A collision reserves nothing new and retries with
a different candidate; exhaustion fails closed. Atomic exclusive creation works
across concurrent workers on that same volume. No distributed/NFS guarantee.

A generation is used once per in-memory encryptor. Crashes, failures and retries
burn the reservation; restart allocates another. Reservations are never deleted
or recycled while the key can be used. Counter overflow fails before calling AES.
Unchanged completed ciphertext can be reused without invoking encryption again.
Missing/unreadable storage refuses work; do not recreate a lost ledger or restore
an older snapshot alone. Retain the union of all reservations with custody
backups. Safe multi-writer/fleet monotonic storage remains a prerequisite before
scaling; this does not claim protection against operator rollback of durable state.

## Encoding and resource boundary

Use an external FFmpeg process with its native AAC encoder, not a browser/WASM
transcoder. [FFmpeg license terms](https://ffmpeg.org/legal.html) depend on build
options: local Homebrew 7.1_4 is GPL-3.0-or-later (`--enable-gpl --enable-version3`).
The measured Debian image uses 5.1.9-0+deb12u1, GPL-2.0-or-later with its
`--enable-gpl` build. Neither uses nonfree/Fdk-AAC. This is compatible with this
GPL project but is not a patent clearance claim. Retain actual worker build and
license information. [FFmpeg DASH](https://ffmpeg.org/ffmpeg-formats.html#dash-2)
provides frame-aligned fMP4 segments; the
[W3C ISO BMFF byte-stream specification](https://www.w3.org/TR/mse-byte-stream-format-isobmff/)
defines initialization/media append structure.

Before adding FFmpeg to a production image, retain its image size delta and a
CPU/peak-memory benchmark per minute of audio, plus a malformed-input/timeout
probe. The initial Docker-unavailable inspection was followed by a local Linux
measurement before any production-image change: Node slim 242,381,067 bytes;
with distribution FFmpeg 642,831,501 bytes, an additional 400,450,434 bytes
(about 382 MiB). At one CPU / 256 MiB, a synthetic minute took 1.49, 2.70 and
6.62 CPU-seconds for 96/160/320 respectively, with at most 52,368 KiB child RSS.
The native EBU R128 measurement added 0.43 CPU-seconds/minute. These single-sample
synthetic figures are not Fly capacity or a Node worker peak-memory proof. The
large image delta argues for a deliberately measured worker/minimal build before
packaging; the production API Dockerfile is unchanged in the format slice.

The worker will allow one running encode, bounded queued encrypted masters,
fixed local paths, selected audio demuxers and file/pipe protocols only, one
codec thread, no stdin/shell/network input, maximum 15-minute duration, bounded
output count/bytes, deadline and cancellation. FFmpeg still parses untrusted
media: limit its process/container resources and keep it patched. Plain files
exist only inside a private ephemeral job directory and are removed in finally;
the durable queue contains ciphertext and metadata, never raw keys or plaintext.
The parser child receives only PATH and fixed C locale, not the API's secrets.
This is not an OS sandbox: a parser exploit running with the API's privileges
could still access its files/processes. Real-upload integration therefore needs
an isolated worker filesystem/process boundary, in addition to W30's non-root
execution and bounded resources. The inactive codec slice does not deploy that
boundary or accept public uploads.

Loudness is measured by EBU R128 without a normalization filter in the encoded
signal path. Store integrated LUFS and bounded playback gain toward -14 LUFS;
silence yields zero gain. Playback capability is checked at runtime. Do not
promise AAC/MSE support in every Firefox/WebKit/Product package from one desktop
test; retain DAV2 for existing releases, never fetch a v3 archive to hide an
unsupported decoder.

## Implementation order and acceptance

1. Reviewable format, persistent nonce allocator, encoder and synthetic
   round-trip/security tests. No production route switches in this slice.
2. Durable bounded jobs, artist progress/retry, manifest access-checked reader,
   MSE playback/gain and canonical off-chain DAV2 migration/rollback rehearsal.
3. Three-engine browser/first-sound evidence and measured worker packaging,
   preserving W30 and device release gates before activation.

W33 edge caching, W34 key preparation and W35 adaptive/gapless behavior stay
outside W32. A partially landed slice is not a completed #287.
