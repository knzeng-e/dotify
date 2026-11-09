# Publisher latency diagnosis candidate — 2026-11-09

Refs #407. Candidate from tested dev `184806f1` (CI 42554743639), after merged
#414 / verified Web/Product/API 0.1.82. The owner confirms existing-release
visibility and audible Web/Desktop playback. Full-length publication still took
about 55 minutes in the earlier 175-block case; increasing timeouts is not an
acceptable performance fix. This candidate measures the publisher before changing
pipeline or representation choices. **It is not deployed and claims no speedup.**

## Observations and limits

Earlier finalized receipt gaps were often six blocks between successful waves.
That cannot distinguish SDK setup, signing, broadcast, inclusion, finality and
post-store proof/readback. Nor can a successful catalogue read explain how long
indexing took. No write is performed to infer a cause.

[Three read-only root probes](bulletin-publication-timing-probe-2026-11-09.json)
use the candidate transport with `signer: null`, a write-API guard and a 30-second
overall abort. Each sequential sample reads status, looks up the same existing
276-byte root and reads/verifies its bytes. Observed totals: 1,570 / 845 / 775 ms;
status 1,637 ms aggregate, lookup 1,260 ms, raw read 293 ms. Zero transactions,
zero signer access. These are small-root, partly warm process observations, not
cold-cache, bulk throughput, store-finality or 55-minute publication benchmarks.
The existing encrypted root is public; no audio cleartext or key is fetched.

## Data flow and interpretation

`createStreamingPublicationStore` allocates one ephemeral timing collector per
accepted publisher attempt when its private observer is configured. It times
waiting behind the single publisher, then preparation/admission/graph setup.
`openBulletinPublicationSession` passes that collector separately from the
immutable profile. `createPapiMediaTransport` wraps existing transport calls and
records the original one-shot `watchFinalized` interval. No RPC is added, skipped,
retried or satisfied from a new cache.

After success or failure the application emits **one private structured log**
with code `BULLETIN_PUBLICATION_TIMING`, schema
`dotify.bulletin.publication-timing.v1`, scope `publisher-attempt`, asset kind,
optional validated server job UUID, wall `elapsedMs`, and fixed counters:

| Phase | What it measures |
| --- | --- |
| `queue` | Waiting behind the publisher's existing serialization tail |
| `prepare` | Binding/admission/inventory/graph work before opening the session |
| `status`, `nextNonce` | Existing finalized quota/network and cursor checks |
| `lookup` | Existing canonical CID position/retention checks |
| `readBlock` | Existing raw-byte fetch and CID verification |
| `lookupSubmission` | Existing canonical sender/nonce/payload/event proof |
| `store` | Full original store call, including reservations and readback |
| `submitAndFinalize` | Original PAPI create/submit/watch interval, including SDK/signing work and finality |

Each phase has calls, failures, total/max completed duration, peak observed
concurrency and `inFlightAtReport`. A failed attempt may leave unknown on-chain
outcomes; a failure counter never proves a transaction was reverted. An unfinished
call is explicitly reported, not averaged as a zero-duration completed read.

PAPI **3.3.0** lifecycle hints `created`, `broadcasted`, and the first
`inBestBlock` are recorded as separate cumulative milestones from the start of
the original watch. They contain observations, total/max milliseconds only.
Missing hints remain absent. A reorg/re-inclusion does not replace the first
inclusion milestone; **only the original successful finalized dispatch/storage
event and later canonical readback prove publication**. Lifecycle hints cannot
advance a receipt, release an account barrier or grant access.

**Do not sum phase totals into wall time.** Concurrent stores overlap; `store`
contains `submitAndFinalize` and some lookups. Milestones are cumulative, not
successive spans. Compare populations only when observation counts match, keep
failures/unfinished work separate, and use wall `elapsedMs` for attempt latency.
There is no client upload, encoder queue/transcode, or catalogue-index timing in
this scope. A retained ready-job recheck has no new finality milestones.

## Security, persistence and rollout

The collector stores fixed phase/milestone counters, not per-CID or per-event
history. There are no keys, wallet/runtime addresses, CID values, raw errors,
transaction hashes, signing data or uploaded bytes in these reports. Only a
strict `stream-UUID` may become a correlation job ID. The logger/observer may
throw without changing the original result or failure. Milestone observer
failures cannot end a watch early or bypass finalized dispatch validation.

Reports are process-memory snapshots emitted through existing private server
logs; they are not audit journals, retained receipts or an off-volume backup.
Old attempts cannot be reconstructed after restart. Existing log access and
retention policy apply; no public endpoint or third-party telemetry is added.
Pinata is unchanged. Queue/profile/receipt/key/nonce schemas, admission caps,
concurrency/byte limits, deadlines and unknown-outcome recovery are unchanged.
No migration, profile rebinding, reset, signer activation or funded test occurs.

A later reviewed API/custody rollout is needed to collect live reports. Matching
Web/Product release is unnecessary for this server-only change. No environment,
CORS, storage mount or secret setting changes; a custody restart still requires
its own concrete maintenance review. Any future musical write must remain inside
an existing authorized draft or receive a separately reviewed admission/budget.
Keep current ciphertext and journals. Rollback is the previous API image with
the same state; metrics need no persistence conversion.

## Validation and remaining gates

- Targeted diagnostics/publisher tests pass: overlapping wall vs summed time,
  immutable snapshots, missing/repeated hints and unfinished calls, canonical
  RPC-call equivalence, cancellation/error identity, redaction, one-shot PAPI
  submission, failed-finality refusal and throwing-observer isolation.
- Real captured receipt fixture keeps its sender/nonce/direct payload/event proof.
- API suite: 369 cases, 367 pass in sandbox; the two socket cases receive EPERM
  there. Both affected files rerun with local socket permission: 11/11 pass.
- Final 12 focused cases rerun after asynchronous observer-rejection handling;
  API build and typecheck pass. No new dependency or frontend behavior change.
- #412 CI also exposed an existing clear-interface fixture using a live chain-ID
  read: the failed DOM showed `0.5 UNIT` while expecting `0.5 PAS`. The same small
  deterministic Paseo `eth_chainId` stub used by access/publishing tests is included
  here so currency assertions remain strict without relying on public RPC timing.
  Both viewports repeated three times: 6/6 browser checks pass.
- Live per-store stage timings, acceptable latency and catalogue-delay diagnosis
  remain unverified. #407 stays open; read-only root probes do not close it.
