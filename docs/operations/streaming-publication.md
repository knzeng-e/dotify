# New-publication streaming activation

Activated with API 29, encoder 1 and Product 0.1.58 on 2026-10-22.
See the [rollout evidence](../backlog/implementation/evidence/product-0.1.58-rollout-2026-10-22.md);
real artist publication and physical-device acceptance remain open.

Refs #287 / W32 and #320. The internal catalog resets with #319; artists recreate
their runtime and republish. Only authenticated v3 streaming remains supported. This procedure does not deploy services by itself. W30's
non-root/volume cutover (#316) must be merged and verified first.

## Components and authority

The API accepts audio only through the existing signed artist session and
single-use scoped upload authorization. It validates the original hash/media,
derives the existing release-bound key and durably stores an encrypted master.
HTTP 202 returns an owned preparation ID, never a key or an on-chain publication.
Only that artist/session chain can query, retry or discard its failed job.

One API writer owns the bounded JSON queue on its volume. Admission writes an
encrypted source and initial envelope into `incoming/`, fsyncs them and atomically
renames into `jobs/` before committing the index. Startup recovers a committed
admission missing from its index. It removes only recognized uncommitted encrypted
admission files; unknown entries stop startup. Missing queue/nonce custody is
never recreated. A durable expiry tombstone makes interrupted deletion resumable.

The API sends clear uploaded audio over the private service connection to a
separate encoder. The encoder image contains only the media parser, fixed binary
protocol and HTTP entrypoint. Startup rejects known API/custody/signing secrets. It has no API configuration, key vault, Pinata,
session/signing secrets or persistent volume. FFmpeg receives only PATH/locale,
fixed local arguments, one thread and file/pipe protocols. This is an independent
filesystem/process boundary; it is not a claim that an FFmpeg parser exploit is
impossible. Keep the private service patched and resource-limited.

The API encrypts three AAC fMP4 renditions, the archive and authenticated manifest
using the existing permanent actual-key nonce ledger. Encryption failures burn
their generation. Only a complete durable manifest marks reusable ciphertext;
a pin retry validates and reuses those bytes instead of re-encrypting. The artist
still approves on-chain registration separately, after a ready reference exists.
Recheck runtime authority at execution and before publishing to storage.

The browser verifies the canonical release and manifest before reading media.
The recorded first activation selected 160 kb/s. The [W35 client candidate](../explanation/continuous-listening.md) starts at 96 kb/s, adapts from measured throughput and maintains about 30 seconds of active read-ahead; it is not yet published. Supported standard MSE appends authenticated segments.
ManagedMediaSource eviction/refill is not assumed from browser identity. Without standard AAC MSE, playback assembles the same authenticated AAC rendition into a
bounded Blob; it never selects the archival master. Bad authentication is terminal,
not a gateway/key fallback. Transport may retry bounded ciphertext reads only.

Loudness gain is authenticated metadata. One Web Audio graph applies it before
both local output and WebRTC capture. Host mute affects only the monitor; room
guests still receive the stream and never call the source/key endpoints. Platforms
without Web Audio retain native playback without normalization; physical Host
compatibility remains an acceptance gate. This protects distribution access,
not recording/DRM; an authorized key holder can manually decrypt the same-key
archive outside the playback reader.

## Configuration and resource envelope

| Setting                     | Owner/default                                | Boundary                                                                         |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `STREAMING_WORKER_URL`      | API only; required to publish audio          | HTTPS, or HTTP only on `.internal`/loopback; no credentials/path/query/redirects |
| `STREAMING_WORKER_TOKEN`    | Dedicated secret on API and encoder          | At least 32 characters; never reuse custody/session/Pinata/signing secrets       |
| `STREAMING_STATE_PATH`      | API; `.data/streaming` locally               | Live plan `/data/contributions/streaming` on the existing volume                 |
| `UPLOAD_GLOBAL_CONCURRENCY` | API activation plan `2`                      | Configured streaming refuses values above 2                                      |
| API memory                  | Activation plan **1024 MiB**, one CPU/writer | Existing relay/catalog/request buffers need headroom beyond encoding control     |
| Encoder                     | Private one warm Machine, 512 MiB, one CPU   | No public HTTP/TCP service or volume; one encode at a time                       |

Queue: four retained unfinished jobs (including failed), at most 200 MiB of
original masters and 64 status records. Inputs remain limited to 50 MiB and
15 minutes; output/objects/counts are bounded. Three attempts per job prevent
unbounded automatic retries. A storage request is cancelled after five minutes;
retry reuses its authenticated ciphertext. Retry failures from the studio, or explicitly
**Discard failed preparation** to release their capacity. Active jobs cannot be
discarded. Failed/ready status records expire after seven days; the background
queue and admission paths prune them. Ready local files are removed after durable
success. **Nonce reservations never expire with jobs.**

Status polling is no-store, account/chain scoped, every 2.5 seconds with bounded
transport retries and a 15-minute UI wait. Browser storage retains only an
API/account/chain/hash-scoped job ID. After a reload, reselecting the same file
recomputes its hash and resumes the saved job without re-uploading. A network
error retains the ID; a confirmed missing/expired job clears the stale hint.
The whole publication form and raw File are not persisted. A completed prepared
upload is still checked against the current publication runtime before registration.

## Rehearsal and measured limits

```sh
npm --prefix services/api run streaming:rehearse
DOTIFY_REHEARSAL_SECONDS=900 npm --prefix services/api run streaming:rehearse
```

Both use only synthetic music/keys and an internal Docker network. Containers
have read-only image filesystems, no added capabilities, no-new-privileges,
512 MiB, one CPU, 64 PIDs and bounded tmpfs. They prove parser isolation,
authentication/malformed-input refusal and real encode/encrypt/verify delivery.
They clean up only their own containers/images/network/volume.

Observed local Linux/arm64 Node 22.13.1 / Debian FFmpeg 5.1.9-0+deb12u1:

| Synthetic profile        | End-to-end job | Controller peak RSS | Encoder cgroup memory peak | Encoder CPU    |
| ------------------------ | -------------- | ------------------- | -------------------------- | -------------- |
| 60 seconds               | 15,801 ms      | 141,900 KiB         | 56,987,648 bytes           | 14.73 seconds  |
| 900 seconds / 43 MiB WAV | 148,491 ms     | 462,272 KiB         | 268,025,856 bytes          | 143.83 seconds |

The controller fixture uses a verifying in-memory pin sink, not real Pinata or
the complete HTTP API under load. These samples are not a Fly capacity/SLA
claim. They justify increasing the API plan from 512 MiB to 1 GiB and limiting
concurrent uploads before activation; real upload/storage/listening load must
still be observed. The isolated encoder image is 642,868,681 bytes, about
382 MiB above the inspected Node slim baseline. Maintained distribution packaging
keeps the parser isolated and its license/build records available; a smaller
maintained build can follow.

The image retains `/usr/share/dotify-encoder/{build,license,packages}.txt`.
This Debian build is GPL-2.0-or-later with native AAC, no nonfree/Fdk-AAC.
See [FFmpeg build-dependent license terms](https://ffmpeg.org/legal.html).
No new npm dependency or key scheme was added.

## Deployment sequence after review

1. Complete the W30 non-root same-volume procedure. Back up current trust data;
   preserve the stable session epoch and all custody backups. If active versioned
   configuration includes hash-only key v1, retire that entry from the new
   service configuration; retain its historical backup separately. Only versions
   2+ are supported, and their permanent nonce reservations must stay intact.
2. Prepare the reviewed encoder image from `services/api/Dockerfile.encoder`.
   The proposed `services/api/fly.encoder.toml` has no public service. Confirm
   the app name/region and one warm Machine (`--ha=false`); `.internal` DNS
   reaches running Machines and does not autostart them. See
   [Fly private-network semantics](https://docs.fly.io/networking/private-networking/).
3. Set only a dedicated service token on the encoder. Set that same token on
   the API; do not print it or commit it. No API/master/signing/Pinata secrets
   or volume may be copied to the encoder. For Fly, bind the IPv6 private network
   and retain platform isolation; the local rehearsal does not prove live mounts.
4. As UID 1000, explicitly provision the new custody directory **once**, using
   the reviewed API image and existing mounted volume:
   `node dist/scripts/initializeStreamingJobs.js /data/contributions/streaming`.
   It refuses an existing root; never use it to repair missing/restored nonce
   data. This is not a Fly release command, which has no mounted volume.
5. Deploy the API with both worker URL and token, the custody path, 1 GiB and
   upload concurrency 2. Single API writer only. Production activation refuses an image that is not UID 1000, so an unmerged W30 prerequisite cannot silently run as root. Partial worker configuration,
   unreadable custody or unreviewed crash state stops startup. Verify non-root
   UID, readiness, worker access, durable restart and existing denial/session gates.
6. Coordinate the new-directory configuration (#317), signaling and Web/Product
   publication during a quiet window. An old frontend does not understand 202
   upload jobs or v3 playback. Do not enable real artist publishing during mixed
   versions. Preserve the new empty frozen bootstrap until the new API is healthy.
7. Create an actual artist runtime, publish a new release and verify Web plus
   physical Product Desktop/mobile: progress/reload/retry, actual pinning, first
   audible playback, seek/repeat, gain/mute, host stream and walletless guests.
   Existing Classic denials and contribution timing must still pass. Keep W13/#88
   open until these live/native measurements exist.

## Recovery and rollback

Back up the entire queue plus the **union** of permanent nonce reservations
with key custody. Restoring an older ledger while its keys remain usable is
unsafe, even if contracts were redeployed. Do not wipe the volume or rotate
secrets to make an upload start. The old three-file W30 ownership utility refuses
this new subtree: do not bypass it with recursive chown. Once W32 is active,
keep the non-root runner and review any future custody ownership migration.

For an encoding outage, retain the v3-aware API/client, disable new streaming
admission by removing **both** worker settings in a reviewed rollback, and keep
all queue/ciphertext/nonce state. Audio upload then returns 503; it never writes
an old container. Published v3 releases still use their authenticated
manifests/segments and existing keys. Bringing
back the same state and worker resumes queued work. Never roll back to a client
that treats v3 as legacy ciphertext. Old internal releases are retired by the owner decision in ADR 0033; this
client has no old-directory playback rollback. Retain historical contracts/pins
and custody safely; do not erase them as part of an application rollback.
