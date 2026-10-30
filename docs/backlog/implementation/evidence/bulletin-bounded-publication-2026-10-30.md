# Bounded Bulletin publication, 2026-10-30

**Outcome: an opt-in direct-transaction pipeline can overlap verified uploads
without changing the deployed app or #355.** Base `dev`:
`5b6ddec51ba4dfdc2383d7afbaf17996dfdda1a6`. This is an independent publication
increment while [#355](https://github.com/knzeng-e/dotify/pull/355)'s native
AAC/addressing experiment is reviewed. No storage transaction is sent by this
implementation's tests or capability inspection.

## Decision and state flow

The previous writer waits for each transaction to finalize before starting the
next. The new command permits two direct transactions at once (one to four
configurable), with a separate byte ceiling. This reduces serialized waiting
opportunities while keeping one account nonce allocator and bounded work.

A nonce is the account's transaction sequence number. The finalized account
nonce starts allocation; each `(CID, nonce)` intent is durably persisted before
signing/submission. Every successful write needs a finalized `Stored` event,
matching finalized CID/codec/hash/size/retention metadata, and exact raw-byte
readback. The event's storage index is distinct from the block's extrinsic
index. A parent waits for all child receipts; the root waits for the complete
graph. Parent admission also checks that earlier receipts still have enough
retention remaining.

The first failure stops admission. Already-started operations are drained;
verified siblings are saved, while uncertain intents remain. Restart performs
fresh chain and byte checks, not receipt-count trust. Missing content does not
prove a signed transaction failed. There is no timeout retry, automatic
re-signing, nonce-gap filling or journal erasure recovery. Manual reconciliation
is deliberately required after unknown or partially admitted failures.

The schema is `dotify.bulletin.pipeline.v1` in `pipeline-checkpoint/`. Existing
sequential/renewal commands use their original schema and refuse the new one.
The operator holds both a fixture lease and a local account lease; an abrupt
exit leaves locks for audit. Only cooperating pipeline invocations are covered
by the account lock. The operator must keep other tools/wallets and the old
writer idle for that account. External nonce conflicts fail the run; they are
not silently repaired. Production storage needs a dedicated account and a
separate operational ownership/renewal design.

## Why not atomic batches?

A read-only finalized metadata probe sees `Utility.batch_all` and the account
nonce API. That does not prove nested storage calls are valid. The inspected
[official extension, revision e0190de9](https://github.com/paritytech/polkadot-bulletin-chain/blob/e0190de902b41b820844ec530ec21f5af04d1f11/pallets/transaction-storage/src/extension.rs#L167)
rejects `store` / `store_with_cid_config` when nested: node indexing requires
payload bytes at the end of a direct extrinsic. We choose direct writes and
do not submit a speculative batch. The inspected source revision is not a
claim that the deployed runtime bytecode equals that revision.

## Validation and limits

The **19 pipeline tests**, alongside **27 existing prototype tests**, cover:

- overlapping direct writes with durable, distinct nonces and bounded bytes;
- dependencies/root ordering, out-of-order observations and retention expiry;
- lost acknowledgements, draining siblings on failure, filesystem persistence
  failure, pending intents and a fresh Node process recovering multiple intents;
- finalized success vs best-block inclusion, failed dispatch, missing/duplicate
  storage events, stream completion, deadline/error cleanup and no retry;
- pinned finalized nonce reads, direct call data/hash/codec binding,
  serialized local quota reservations, lagging counters and no double charging
  after finalized counters catch up;
- explicit CLI opt-in, read-only refusal of signers and private account leases.

The synthetic 19-block / 870,498-byte scheduling model has 19 serial waves,
11 waves at concurrency two, and seven at four under the same 512-KiB byte
ceiling. **A wave assumes equal-duration operations. This is not a measured
network speedup or a time estimate.** Node mempool/finality behavior, nonce
conflicts, concurrent storage admission and real throughput still require a
bounded approved live test. Default concurrency remains two, not four.

The capability observation and model are in the accompanying JSON evidence.
They contain public identifiers and counters only, no key, signer, ciphertext
or artist recording. Production SDK pins, encryption/nonces, access rules,
Pinata configuration, servers, paid resources and DotNS are unchanged.

## Compatibility with the separately reviewed reader

An isolated temporary assembly combines #355 revision
`7b6d4d224f3a317bbd493b556bca604aca321194` with pipeline code `4dd555014eb2424ea6ca3f392166aeaea939cf76`.
It changes neither branch. **57 automated tests pass** in that assembly:
38 reader/codec/addressing checks and the 19 pipeline checks. The already
prepared 16-block / 713,229-byte BLAKE2b graph also completes the **simulated**
pipeline with a peak of two in-flight operations. Its key is not loaded and
no network write or physical playback is performed by this compatibility run.
This is combined-source evidence, not a merged release build or live speed test.

## Mobile and long-listening handoff

Mobile delivery uses the separately reviewed #355 reader. Do not duplicate
that reader here, bind its local key server to the LAN, tunnel it, or expose a
production content-key endpoint. After #355 merges, prepare a **standalone
generated-only diagnostic Product** at a separately approved test address.
Bundle only the public generated fixture's test key/manifest reference; never
an artist key, production session or operator signer. The known synthetic key
is test data, not an access entitlement. A new Product/DotNS publication needs
its exact destination/build and separate signing approval.

Before any mobile claim, record device/OS/Host version, source revision, network,
known/unknown caches, exact CIDs, raw-reader mode, failure stage and exported
report. Test first playback, Play/Pause, stop, seek, background/screen lock and
re-entry. Do not equate Safari support with the installed Product mobile Host.
First `playing` is not measured audible first sound; confirm hearing separately.

The eight-second clip can prove codec/native delivery, not long-listening
resilience. A longer generated fixture must cross many segments and measured
interruptions/recovery, with an explicit storage plus renewal budget. Compare
against current delivery on the same device/network, and retain failed runs.
No mobile or soak test is reported as run in this PR.

Refs #288 / #287. Native mobile, ordinary-Web delivery, paired audible startup,
scalable publication, renewal ownership and storage activation remain open.
