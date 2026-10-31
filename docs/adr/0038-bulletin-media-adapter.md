# ADR 0038: Bounded Bulletin media adapter with durable job ownership

Date: 2026-10-31. Status: **implemented as an unselected server-side adapter**.
Refs #288 / #287. [ADR 0034](0034-media-cdn-and-native-storage.md) remains the
active delivery decision; this does not activate a replacement provider.

## Context and decision

The [protected rehearsal](../backlog/implementation/evidence/bulletin-protected-rehearsal-2026-10-31.md)
joined real custody and key checks to simulated Bulletin, but its inline callback
had generated-fixture limits and no long-lived owner for completed-job receipts.
Storage metadata must survive the streaming job's ready-state cleanup. Native
mobile reads alone also cannot establish ordinary Web delivery.

Provide three small server modules at the existing seams:

- `bulletinGraph.ts`: validate the complete current streaming layout, build its
  directory and readdress it to the physically tested BLAKE2b form. Ciphertext,
  manifest authentication and key scope remain unchanged.
- `bulletinMedia.ts`: expose `pin(files, streamJobName, signal)` and durable
  `inventory(jobName)`, with an explicitly supplied account/network, transport,
  private state directory and immutable per-job allowance. Retention inventory
  is independent of the streaming queue and holds no key or audio bytes.
- `bulletinReader.ts`: expose the existing API reader shape over injected raw
  block reads. The existing catalog-gated media route supplies manifests and
  encrypted init/segments to Web clients. It is not a general IPFS gateway.

The protected rehearsal now uses these modules, comparing the directory root
against the previous implementation and keeping real Web/Product signatures,
canonical access resolution and AAC decoding. No app composition/default,
provider environment variable, signer, deployment or public endpoint changes.

## Ownership, submission and failure

Provision a new directory explicitly; opening a missing directory/owner marker
must not recreate it. The owner marker records genesis, account, admitted job
names and an unresolved-account barrier. Each job binds that identity to its
root, release scope, generation, block sizes and exact budget.

An exclusive writer lock serializes the selected custody directory. This is a
**single-writer volume boundary**, not distributed signer coordination: one
state directory and one writer must own the account, with no other CLI/wallet
transactions while it operates. A crash leaves the lock for operator recovery;
there is no timeout-based lock stealing or automatic deletion.

Before a broadcast, fsync the account barrier, pending CID and cumulative
attempt counters. Even definitive rejected attempts count toward the job's
allowance. On an uncertain result, a different job is blocked. Retry of the same
job reconciles finalized metadata and exact raw bytes; a missing pending CID
never authorizes resubmission. Only a trusted transport that knows it did not
broadcast may mark `definitelyNotSubmitted`. Never copy that flag from an
untrusted provider error body.

Readiness requires every block, including archive/directory children, to pass
CID, size, finalized-position and lifetime checks. Re-audit all dependencies
after writes and check their lifetime against the final observed head. Reserve
one complete renewal cycle in both transaction and byte quota. That reservation
is a preflight observation, not an on-chain hold or scheduled renewal.

The module caps a publication at five minutes and each transport call at thirty
seconds. Deadline/cancellation ends application waiting; it cannot revoke a
broadcast. Injected transports must also honor the signal and bound their own
network resources. The pending intent/account barrier protects later retries
if the original operation finishes late.

## Bounds and Web delivery

Current-format bounds admit at most 773 files (manifest, archive, three inits
and up to 256 segments per rendition), 132 MiB of file bytes, 2,048 DAG blocks,
512 KiB per block and 134 MiB of graph bytes. There is a 4,096-job inventory cap.
These are explicit admission ceilings, not tested upload throughput or memory
capacity claims. Encoding/importing retains a graph in memory; measure peak
custody memory and publication duration with a representative release before
activation. Receipt histories have no automatic deletion policy.

The Web reader permits only the current manifest/init/segment paths, with
bounded object sizes, sixteen raw reads per object, two concurrent application
reads and a twelve-second whole-object deadline. Every dependency is verified
against its CID. The existing route still rejects unknown/inactive releases,
queries, ranges and archival-master paths, and replies `no-store`. It supplies
no content keys. No additional resident gateway service is introduced.

Writes are deliberately sequential in this slice. Larger graph admission is not
proof that a real release fits the five-minute upstream publication window. A
live composition must measure that limit and use separately reviewed durable
nonce-aware pipelining if needed; do not relax finality checks or raise timeouts
silently to obtain a successful upload.

## Alternatives and consequences

A fixture-only callback was simpler but cannot own retention after completed
jobs disappear. Direct browser RPC for every Web client would add another
transport/capability rollout before proving the storage seam. A new public
gateway or immediate provider switch would introduce operational commitments
without live cost/delivery evidence. The existing API reader is the bounded
Web bridge; native direct reads remain a separate client activation gate.

This reduces storage-vendor coupling; it does not decentralize key custody or
prove permanent storage. Four pinned IPFS dependencies already exercised by the
prototype are added to the API, without upgrading existing lockfile entries.
There are no new service instances or hosting commitments in this change.

Before activation: separately review the live transport/signer composition,
state provisioning/backup and crash-lock recovery, exact canary allowance,
account authorization, Web/Desktop/mobile protected playback, representative
resource costs and recurring retention. Preserve current ciphertext and nonce
ledgers; no existing release is migrated or discarded. See the [adapter
verification](../backlog/implementation/evidence/bulletin-media-adapter-2026-10-31.md).
