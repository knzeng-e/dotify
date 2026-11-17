# ADR 0039: Bounded Bulletin publication with durable account nonces

Date: 2026-10-31. Status: **implemented, provider composition still unselected**.
The subsequent [direct-store transport](0040-bulletin-direct-store-receipts.md)
adds bounded RPC receipt verification without activating publication.
Refs #288 / #287. Extends [ADR 0038](0038-bulletin-media-adapter.md); it does not
activate Bulletin storage or alter the existing access/key boundary.

## Decision

Replace the adapter's serial store loop with small independent waves: two direct
store calls by default, at most four, with a default 512 KiB / maximum 1 MiB of
block payload in flight. The limits are copied, validated and bound into each
job's immutable inventory. Initial and final block observations use the same
concurrency limit. There is still a five-minute publication deadline and a
thirty-second deadline for each transport call.

A wave waits for all its started operations before admitting another wave. This
sacrifices some throughput compared with immediately filling every free slot,
but keeps quota accounting and journal updates serial and reviewable. Directory
parents wait for verified child receipts; the root waits for the whole graph.
No finality or retention check is relaxed. These bounds apply to submitted
payloads, not total process memory: encoding/importing still retains a graph.

## State and transport contract

The prepared adapter now uses `media-owner.v2` and `media-job.v2` inventories.
The owner records a **next nonce**, the account's transaction sequence number,
shared across all jobs in its one custody directory. A job records its matching
cursor and pending intents keyed by CID. Each intent contains the explicit nonce
and the finalized block observed before reservation (`afterBlock`).

The injected transport must provide:

- finalized account nonce and head observations, without an implicit signer;
- one direct store call using the supplied nonce, with no internal retries;
- a finalized receipt for the **exact sender, nonce and direct store**, obtained
  through `lookupSubmission(intent, signal)`, as well as ordinary CID metadata;
- exact raw block bytes and bounded, cancellation-aware network operations.

`afterBlock` supplies a lower bound for future receipt lookup; it is not a
transaction hash or proof by itself. The future live transport must implement
and bound that lookup against authoritative extrinsic/event data, including
lost acknowledgements. The current prototype's CID-only SDK store method is
insufficient. This PR introduces no live transport, SDK or signer.

Before each broadcast, persist and fsync the owner barrier/cursor, then the job
intent/cursor and cumulative attempt counters. A crash between these two files
can leave mismatched cursors: reject and require operator reconciliation.
Never guess which file should win or recreate missing state.

After a successful store, verify its returned identity/position, independently
look up that exact submission and its CID metadata, and verify the raw bytes.
Receipt positions must be after the reservation's observed block. Only then can
the serialized wave checkpoint clear the intent. Successful siblings are saved
even when another member fails.

On restart, a pending CID being present is insufficient: the exact sender/nonce
receipt must agree, and the finalized account nonce must have consumed it. Any
missing or conflicting evidence stops the job. Before another wave or clearing
the account barrier, require the finalized nonce to equal the durable cursor.
While a job remains active, unexpected external nonce progress is rejected.
Between completely settled jobs, the next finalized nonce may advance
monotonically: the owner can therefore reuse the same account for DotNS without
resetting its storage history. No other tool or pending transaction may use it
during publication. This is an exclusive-use operating contract, not distributed
signer coordination.

## Failure and allowance boundaries

An error stops new admission. Every started application operation is observed
before releasing the writer lock. Deadline/cancellation cannot revoke an
underlying broadcast: its intent and account barrier remain until a later
explicit reconciliation. A late transport result never edits the journal.
A lost acknowledgement can resume without another store only after the exact
submission and block bytes are verified.

There is no automatic retry after a store error, including a
`definitelyNotSubmitted` flag. With parallel nonces, later transactions could
already be queued behind the failed one; safely replacing or releasing that
nonce needs a separately reviewed operator procedure. Only a trailing intent
whose `store()` was **never invoked** may be rolled back after a sibling fails
during its persistence. Its attempt/bytes remain charged. If saving or rollback
fails, keep conservative state and stop; do not invent success.

The initial allowance covers all missing stores plus one complete renewal cycle;
each wave rechecks live transaction/byte quotas and dependency lifetime. At
readiness, audit the complete graph and renewal reserves again. Check child
lifetime and authorization against the final nonce observation's head too.
The reserve is an observation, not an on-chain hold or scheduled renewal.

A crash still leaves `writer.lock` for operator review. Normal failure removes
that process lock after bounded tasks settle, but its durable account barrier
blocks other jobs. Read-only transport can reconcile an entirely committed
graph; it cannot fill missing blocks or clear an uncertain nonce from absence.

## Compatibility and activation

No deployment has selected this server adapter. V1 experimental inventories
lack account nonce ownership and cannot be upgraded by inferring a starting
nonce. Preserve them and their account's duties; the v2 opener rejects them
without mutation. Provision v2 only with a separately reviewed new state/account
plan. Do not point the same account at an empty directory to bypass a barrier,
or delete old receipts, ciphertext or encryption-nonce custody.

Pinata defaults, `app.ts`, public configuration, catalogs, content keys and
DotNS records are unchanged. The real-encoder protected rehearsal now injects
an explicit nonce-aware **storage model**, preserving signed access checks and
all-bitrate decode verification. It is not a live settlement or storage test.

Before activation, finish the bounded live transport and receipt lookup,
persistent account-state provisioning/restore, exact canary budget, real
runtime/catalog registration, protected Web/Host listening and recurring
retention. Measure representative publication duration and memory on the target
worker; parallelism alone does not prove that a real release fits five minutes,
reduces hosting costs or survives uncached network interruption.
