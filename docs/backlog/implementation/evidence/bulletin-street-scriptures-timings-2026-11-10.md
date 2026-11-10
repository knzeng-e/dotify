# Street scriptures publication timings, 2026-11-10

Refs #407. The owner confirms **publication OK / listening OK**, with approximately
**49 minutes 54 seconds** of preparation. Host is not specified in this result.
This establishes a useful successful release, but preparation latency is not
acceptable and #407 stays open. No repeat publication is needed for diagnosis.

## Correlated observations

Read-only inspection matches the exact approved owner/runtime/source/v3 identity:
one ready job, one preparation attempt, 151 attempted stores / 24,284,515 bytes,
151 blocks and zero pending outcomes. The job's create-to-ready clock is
**3,053,633 ms (50 min 53.6 s)**. Keep the owner's approximate observation
separate from this server clock, not as a conflicting or identical timer.

A captured audio publisher report succeeds with 151 stores and 151 finalized
observations. Its observation time matches this job's ready timestamp within
1 ms; counts and the admitted graph match. The source graph differs slightly in
byte size from the local codec sizing, as that rehearsal explicitly allowed.
No raw log, inventory, receipt, identifier or key material is committed here.
The later bounded log buffer no longer provides a job-filtered repeat of the
same observation; the original allowlisted capture and readiness correlation
are retained privately, rather than pretending a missing log means zero time.

| Observation | Recorded value | Meaning |
| --- | ---: | --- |
| Audio publisher attempt | 3,025,895 ms | Includes its publisher queue wait; excludes preceding job work and later wallet/catalogue stages |
| Shared publisher queue | 197,902 ms | Waiting for this publisher's serialized turn; prior task is not identified by this sample |
| Publisher prepare phase | 1,912 ms | Profile/admission/graph preparation here; not the entire codec/encryption phase |
| Store calls | 151; peak concurrency 2 | All succeed; aggregate 5,006,143 ms, mean 33.15 s |
| Submit through finalization | 151; peak concurrency 2 | Aggregate 4,906,701 ms, mean 32.49 s |
| First inclusion milestone | 151 observations | Mean 4.87 s from transaction watcher start, not finalized readiness |

These nested/concurrent totals **must not be added as sequential wall time**.
The roughly 27.7-second difference between ready-job and publisher clocks is
other pre/post publisher work, not an isolated encoder measurement. The current
buffer contains no complete cover report or wallet/catalogue phase trace.

## Diagnosis and next correction

The active pipeline allows two direct stores / 512 KiB in flight. The publisher
waits for a wave's finalized and independently verified receipts before issuing
the next wave. Repeated finality waits dominate this sample. Earlier parallel
proof-read gains do not remove that structural cost. One successful preparation
is not a before/after throughput benchmark, and the longer timeout is not a fix.

Do not assume `Utility.batch_all` can combine storage writes. The previously
[inspected upstream extension](https://github.com/paritytech/polkadot-bulletin-chain/blob/e0190de902b41b820844ec530ec21f5af04d1f11/pallets/transaction-storage/src/extension.rs#L167)
rejects nested stores because indexing requires direct extrinsics. That pinned
source was rechecked read-only; metadata exposing Utility alone is insufficient
proof that a future live runtime supports storage batches.

The next #407 slice must evaluate a larger **bounded direct-write window** while
keeping proof reads separately bounded, and quantify how many waits the actual
graph requires. Verify current runtime/pool/byte bounds read-only first. Compare
schedules offline, then choose and implement the smallest useful window; no
live speed claim follows from the model. Fewer/larger fragments may be compared
as a separately versioned geometry, preserving archive and playable renditions.

The current profile and existing inventory pipeline bindings are immutable.
Do not hot-edit their concurrency, re-encrypt an existing job, reset counters or
reuse a claimed identity as a new benchmark. A candidate needs an explicit
compatibility/activation boundary for future jobs. Before any funded follow-up,
exercise explicit nonce reservation, sibling failure, partial inclusion/reorg,
response loss/restart, read-lane saturation, byte bounds and parent/root-after-
verified-child ordering. Unknown outcomes remain durable and block new admission;
no automatic gap filling, refund or blind re-signing. Readiness still requires
finalized storage, exact sender/call/event proof, fresh retention and CID bytes.

## Scope and remaining gates

This diagnosis performs no store, renewal, signature, policy change or service
restart. The successful release remains available through its existing path.
Publication/listening acceptance is now recorded; acceptable latency and a
measured improvement remain #407 work before #395/#388 and CASH research.
