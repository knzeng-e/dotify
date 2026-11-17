# Public API IPFS cache delivery — 16 November 2026

**Delivered and independently checked on both API replicas; the subsequent phone
check has an initial timeout, a successful retry and a later successful opening.** The public API serves frozen
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

## Matching phone follow-up — 17 November 2026

The two supplied reports identify client `4cbdb4f4` / 0.1.88 and Polkadot app
**0.10.0 (20)**, observed at `2026-11-17T00:01:19.873Z` and
`2026-11-17T00:04:46.795Z`. The owner reports **Pause OK and guest sound OK** for
the combined check, without assigning sound results separately to each opening.
The requested context is existing Adang Fobe, Wi-Fi and no connected wallet;
network/wallet conditions and the client relaunch are not separately restated.
Attempt numbering resets and client cache counts return to ten in the later
report, consistent with a new context, but not proof of serving replica/cache state.
These client reports do not carry an API source or replica identity; the API
source above is the delivery record, not a per-request report field.

The first report contains **both a timeout and a retry in retained client memory**.
It is not a successful first opening. Its earlier solo streaming events are
partially absent from the bounded export, while the complete Room start/error
and later success boundaries are retained. The second report contains one
successful complete Room preparation:

| Supplied report / preparation | Trace result | Authenticated objects | Client cache / successful HTTP objects | Settled HTTP requests / body reads / failures |
| --- | --- | --- | --- | --- |
| First report, attempt 2 | Timeout at **60.178 s** | 60 of the expected 73 | 10 / 50 | 50 / 50 / 0 |
| First report, attempt 3 | Ready at **41.562 s** | 73 | 60 / 13 | 14 / 13 / 1 |
| Second report, attempt 2 | Ready at **29.114 s** | 73 | 10 / 63 | 63 / 63 / 0 |

These are client-side Fetch counters. The API's own gateway attempts, cache hits
and internal recovery are not measured by them.

The owner times the successful retry at approximately **29 s** and the later
opening at approximately **15 s**. Preserve those observations alongside the
instrumented boundaries above; their timing origins differ or remain unconfirmed.
Neither approximate number replaces its report, and no additional run is needed
solely to resolve this discrepancy.

In the failed preparation, authorization takes 168 ms; the manifest is ready at
172 ms. At the 60-second deadline, only 2,945,461 encrypted bytes / 60 objects are
authenticated. Read work is 225,355 ms, including 119,906 ms of relay waiting and
115,236 ms before HTTP response headers, versus 418 ms of body work and 54 ms of
decryption. These settled work totals overlap. An error snapshot can precede
outer-read or sibling completion, so they need not sum to `readWorkMs` or wall
time. Zero recorded HTTP failures at this snapshot does not prove pending calls
succeeded or diagnose why the remaining objects did not finish.

The retry starts about 21.58 s after that timeout, reusing the **60 client-side
ciphertext objects** acquired already. Those are not API cache-hit measurements.
The remaining 13 successful HTTP objects still take until 41.562 s. Fourteen
settled Fetch calls and thirteen body reads with one failure/recovered object
show an additional failed pre-body HTTP attempt followed by recovery; no origin,
status or raw reason is exported. Header work is 83,802 ms, relay work 61,073 ms,
body work 46 ms and decrypt work 54 ms; assembly adds 13 ms. The longest complete
object read is 22,623 ms, including relay and fallback work, not one proven
HTTP response exceeding its individual deadline.

The later report has ten client cache hits and 63 successful HTTP reads with
zero recorded failures. Authorization is 184 ms, decryption 45 ms and assembly
12 ms. The same 3,580,693 encrypted bytes / 73 objects are authenticated.
Header work is 54,810 ms, relay work 50,109 ms and body work 284 ms. Preparation
succeeds in 29.114 s, but the source and causes of the remaining pre-response
waits are not isolated. None of these preparations observes a native-path probe.
The [measurement contract](../../../how-to/measure-room-startup.md#distinguish-transport-phases)
owns these definitions and overlap/unfinished-work limits.

In both reports, solo is **already paused before** Room preparation begins,
at media positions 0.939130083 s and 0.286621792 s. Each position remains paused
through source replacement until an explicit later Play intent. In the first
report the old source is retained through the failed preparation and the retry.
This supports existing-Pause preservation; the traces do not show a new Pause
issued during the preparation interval. Normal prepared-source handoffs follow
the complete successes (attempt 4 in the first report; attempt 3 in the second),
not additional user retries. The owner supplies audible guest acceptance, while
playing events/media clocks alone do not prove it.

Both output exports contain foreground events only; no new lock/background
acceptance is inferred. Artwork PNG assignment returns at 35 ms and 23 ms,
respectively, but native cover appearance is not reported in this feedback.
The previous bounded artwork result is retained separately under #388.

## Remaining diagnosis and acceptance

The first-opening latency check **fails**, despite the subsequent successful
retry and later opening. The expanded server cache still corrects its controlled
replay-eviction case; these phone reports neither establish a server hit nor
attribute the timeout to that change. Cache state, serving replica, upstream
retrieval and network conditions are not controlled. A controlled phone speed
gain is not established, including against the earlier 34.857-second result.

Next isolate API catalogue/reader work and upstream retrieval from the client's
pre-response wait, using bounded evidence before choosing another change. Keep
the 60-second media budget, current capacity and access checks. Do not extend the
timeout or infer a gateway/replica cause from these aggregate counters alone.
No new private inspection, service mutation, deployment, key operation or funded
trial occurs in recording this feedback; the prior maintenance authority remains
consumed.

#395 stays open for reliable initial starts, comparable latency and repeated/
full-track continuity. Hosted memory under real traffic and actual API cache
reuse remain unaccepted; #388 artwork reliability is separate. Real independent
recovery stays owner-deferred. The valid first-failure report is preserved, so
no repeat is requested merely to replace it.
