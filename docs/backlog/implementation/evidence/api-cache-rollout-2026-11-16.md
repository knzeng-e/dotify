# Public API IPFS cache delivery — 16 November 2026

**Delivered and independently checked on both API replicas; matching listening
and hosted cache/memory acceptance remain open.** The public API serves frozen
`72e28eba7b57ab41a58766f935a3be438ef38dcc` after #477. Web/Product remain **0.1.88**; the API package
version remains 0.1.0 and its public `commitSha` identifies this new server source.
Refs #395. [Structured evidence](api-cache-rollout-2026-11-16.json) contains allowlisted identities and
aggregate checks. Raw machine configuration, technical fingerprints and operator
intentions remain private; no database, audio or key is exported.

## What changes for listening

The [source-bound correction](ipfs-rendition-cache-replay-2026-11-16.md) lets a
small 73-object rendition survive an ordinary IPFS reader replay within the
existing 16-MiB ciphertext payload bound. The entry cap is 128 rather than 64;
its bounded metadata allowance increases. The controlled second pass avoids
73 additional upstream reads. Two cold reads, current catalogue admission,
purpose/key authorization, authentication and no-store responses remain.
The [reusable contract](../../../explanation/continuous-listening.md#adaptive-delivery)
owns cache semantics and separates frontend, ordinary IPFS and Bulletin readers.

An empty-cache first pass is unchanged in that controlled test. Another API
replica, process restart, competing releases or a larger working set may still
miss. This delivery does not establish a reduction of the prior 34.857-second
phone preparation or resolve the remaining cold/pre-response delay. An improved
repeat within one client can also come from its own memory cache.

## Exact candidate and validation

[Exact merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/43794765162)
passes. Compared with the delivered `91f25c77` API, the only runtime diff is the
cache-entry bound; the remaining API source diff is three regression tests.
The Dockerfile, pinned Node base, dependency lock and schema are unchanged.

| Fact | Observed value |
| --- | --- |
| Registry image | `registry.fly.io/dotify-api@sha256:820605c48dccfa0046c70724474767c0bc9e7dee2c151943fb2d0df64b372a69` |
| Registry config / locally tested image | `sha256:d79554a633b7a3862656936b62585c6ae4c2bc072d5db503ccb3da489fd53b58` |
| Platform/runtime | Linux/amd64, Node 22.23.5, UID 1000 |
| Exact compiled-image checks | 196 tests / 11 files pass; no failures or skips |
| Broader code checks | 656 API tests pass, typecheck/build and changed-code format pass |
| Operator checks | 11 synthetic guard tests and Python syntax pass |
| Local container envelope | One CPU / 1 GiB; read-only root, no external network, synthetic inputs |
| Local cgroup memory peak | 179,118,080 bytes; not a hosted traffic or production-memory result |
| Local startup / SIGTERM | Health 200 / exit zero in 105 ms under isolated test configuration |

Compiled-image cases include cache replay, independent byte and entry eviction,
current catalogue denial on warm bytes, cancellation, real local HTTP disconnect,
key/session access and schema compatibility. Local tests use no production
PostgreSQL, secret or artist data. Hosted health/readiness, below, are a separate
observation with the preserved production settings.

## Approved rolling operation

The owner authorizes one exact registry upload, two API image replacements and
conditional return to the previous pinned image. Fresh private inspection finds
both expected API replicas started and healthy, with stable configuration and
default launch behavior matching the previous delivery. The operator retains
only selected runtime/health facts and configuration fingerprints locally.

The existing Fly registry receives the exact local image. Independent manifest
readback binds its config digest to that tested image; the previous immutable
rollback image is also available and verified before any machine update.
One replica is replaced while its peer is healthy. The second update waits for
two successful health/readiness checks on the first. Intentions are persisted
before each update; an uncertain CLI outcome blocks automatic repetition.

**Both replacements succeed; zero rollback updates occur.** Final independent
checks confirm the new immutable image/source, unchanged stable settings and
launch configuration, and two health/readiness passes per replica. Public
`/version` reports source `72e28eba7b57ab41a58766f935a3be438ef38dcc`. These checks establish identity
and readiness, not uninterrupted requests, actual audio or a hosted load envelope.
The maintenance authority is consumed after final verification.

No custody, encoder or signaling command is issued. Their earlier delivery
record remains the reference; this operation does not freshly inspect those
services. No source layout/reference, existing secret/key, role, CPU/RAM,
origin, mount or shared-state schema is changed. There is no private-writer
stop, database migration/reset, Bulletin operation, DotNS signature, musical
upload, automatic renewal, compact/CASH activation or real recovery. Existing
Web/Product publication is retained without a new client rollout.

## Next measurement and remaining gates

Use the existing Adang Fobe on the same Wi-Fi and 0.1.88 client. Preserve one
Room-opening report before any retry/reload. Then relaunch only the client,
without clearing its data, and preserve a second opening/report. Relaunching
limits reuse of the client's in-memory audio; it does not guarantee a particular
server replica/cache state. Record Pause and audible guest behavior separately.

The [measurement guide](../../../how-to/measure-room-startup.md#distinguish-transport-phases)
defines overlapping relay/header/body work and its limits. Do not add those
totals to elapsed time or identify a server hit from client HTTP counts alone.
Actual cache reuse, hosted memory under traffic, comparable first/repeated
starts and extended/full-track continuity remain to be evidenced. #395 stays
open; #388 artwork reliability remains separate. The prior bounded 0.1.88
positive phone result remains attached to the earlier server state. Real
independent recovery stays owner-deferred.
