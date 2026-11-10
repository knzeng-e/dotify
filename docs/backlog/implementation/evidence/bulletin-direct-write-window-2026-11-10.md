# Bounded direct-write window candidate, 2026-11-10

Refs #407. Starts from tested dev `5c2b58f3` after merged #423, whose
[dev CI 42750881604](https://github.com/knzeng-e/dotify/actions/runs/42750881604)
is green. Custody remains deployed `cd7ed569`; Web/Product/public APIs remain
0.1.82. No service, policy or musical allowance is activated by this candidate.

## Result and scope

[The real measurement](bulletin-street-scriptures-timings-2026-11-10.md) confirms
successful publication/listening and unacceptable preparation latency. This
candidate makes direct-store concurrency explicitly selectable for a future
exact release, with separate proof-read pressure and unchanged graph/crypto.
[ADR 0049](../../../adr/0049-bounded-direct-write-windows.md) explains persistence,
failure and compatibility. [Machine-readable model](bulletin-direct-write-window-2026-11-10.json).

A synthetic 151-block geometry retains an approximately 17-MB archive and three
25-segment renditions. Data is random, not artist audio/ciphertext. The existing
wave planner produces:

| Direct stores | Data in flight | Proof readers | Equal-duration finalized waves |
| ---: | ---: | ---: | ---: |
| 2 (legacy) | 512 KiB | 2 | 77 |
| 4 | 1 MiB | 2 | 40 |
| 8 | 2 MiB | 2 | 22 |
| 16 | 4 MiB | 2 | 13 |

These are dependency/byte-bounded scheduling counts, not seconds, achieved
speedups or inclusion-capacity evidence. Every candidate still stores the same
151 blocks. No bytes, archival data or proofs are dropped. Sixteen is a hard
candidate maximum; activation must select a reviewed value, not silently use it.

The explicit public read-only runtime inventory at finalized block 1,585,172
finds normal block length 9,437,184 bytes, max store data 2,097,152 bytes and
512 stored transactions per block. The app still caps each block at 512 KiB.
The complete canonical receipt-body cap is corrected from 8 MiB to the observed
runtime total maximum of 10 MiB; individual CID reads stay capped at 512 KiB.
A synthetic body above 8 MiB retains the same exact own-store proof, while
aggregate/per-extrinsic bodies above 10 MiB are refused. The inventory
establishes neither node-pool capacity nor available inclusion
bandwidth; no store, signing operation or benchmark transaction is performed.

## Implementation/review path

1. `bulletinPipeline.ts`: original profile schema and read limits stay intact;
   journal pipeline optionally adds a bounded write window. The same dependency
   planner powers runtime and the offline model.
2. `bulletinReadLane.ts` / `bulletinPapiTransport.ts`: bounded FIFO proof RPCs,
   cancellation and draining, separate from up to sixteen SDK transaction watches.
3. `bulletinMedia.ts`: persist each intent before its one direct store, retain
   wave/nonce/retention barriers, then bound complete receipt/byte proofs by the
   original read limit. Unknown writes stay pending and readiness stays closed.
4. `bulletinAdmissionExtension.ts` / release composition: the optional setting
   belongs only to a new exact extension. Audio, cover and metadata resolve the
   same setting. Complete journal binding survives restart; edits fail closed.

The immutable profile/normalized digest, existing budgets and prior claims do
not change. Compatible code accepts historical v1/v2 records without this field.
Old strict code rejects window-bearing state: after activation preserve it and
use compatible code or disable publication. The execution is not yet deployed.

## Validation and remaining gates

- Full API regression: **409 tests pass**, 42 suites. Typecheck and production
  build pass. Local HTTP/socket cases run with the required local permissions;
  no test accesses production keys or submits a network store.
- New cases verify sixteen overlapping stores with fsynced intents, proof reads
  capped at two, root-last publication, response-loss reconciliation without a
  duplicate, missing-nonce refusal and cancellation retaining all sixteen intents.
- Transport tests saturate sixteen readers behind four explicit RPC slots,
  retaining canonical proof calls. FIFO/queue-bound/cancellation/close tests pass.
- Exact-window composition covers audio/cover/metadata and restart, byte-identical
  profile/nonce preservation, legacy fallback and retrospective-edit refusal.
- Scheduling checks independently cover byte pressure, upper bounds and root
  barriers. The synthetic model produces the table above without original files.
  Offline backlog, documentation links, formatter and whitespace checks pass.

The full model uses no original artist file, production key, signing or network
writes. The runtime inventory is public/read-only. Ordinary successful release
acceptance is already recorded; actual lower publication latency with a chosen
window remains unverified. Deployment needs a concrete compatible custody image,
quiescent checkpoint, coherent snapshot and separate maintenance/exact-release
budget approval. No claimed identity or old admission is a new test slot.
Keep #407 open before #395/#388 and CASH research.
