# Concurrent Bulletin proof reads — 2026-11-13

Refs #407. Candidate implementation `2bbca4e92ac3a98b384382e5e2373c848052e169`,
from tested dev `93e990427f12acdb1588871ad4cfa6cd198ea007`.
[ADR 0058](../../../adr/0058-coordinate-bulletin-proof-loads.md) owns the design;
[measured counters and module digests](bulletin-cold-proof-2026-11-13.json) bind
this local replay to both source versions. No service is deployed by this record.

## Observed work, not elapsed publication time

Four concurrent confirmations replay the same captured public receipt. The body
response is held until all callers have independently selected their canonical
mapping; this exposes simultaneous cache misses without a timing threshold.
The regression fails on the baseline with **4 body reads instead of 1** and
passes with the candidate.

| Local RPC observations for four confirmations | Baseline | Candidate |
| --- | ---: | ---: |
| Body downloads | 4 | 1 |
| Event downloads | 4 | 1 |
| Fresh finalized-head observations | 4 | 4 |
| Fresh canonical candidate mappings | 4 | 4 |
| Fresh retention reads | 4 | 4 |
| Total RPC calls | 50 | 38 |

These are repeated checks of one public fixture, not four newly submitted
transactions, funded throughput or a 24% reduction in artist waiting time. The
current custody proof-reader window is two; the raw transport replay uses four
to expose its concurrency behavior. Finality/store count and the cover/metadata
stages are unchanged. Cold reads for distinct hashes can still run in parallel.

## Validation and limits

The focused transport suite passes 32 tests, including same-hash reuse,
distinct-hash overlap, queue capacity, cancellation before entry, cancellation of
a loader, an abort-ignoring provider and late-response cache eviction control.
Failed or unmatched loads remain uncached. Cache-hit bypass, fresh expiry,
wrong sender/nonce, changed canonical hashes, oversize data and independent
body/event overlap remain covered. Typecheck and the compiled API build pass.
The final complete API run passes **653 tests / 43 suites**, with no failures,
skips or cancelled cases, using local IPv4/IPv6 loopback where required. The
earlier intermediate 651-test pass did not yet include the distinct-hash coordinator.

Reproduce the candidate counters and focused regressions after installing API
dependencies:

```sh
cd services/api
node --import tsx scripts/measure-bulletin-cold-proof.mjs
node --import tsx --test src/services/bulletinTransport.test.ts
npm run typecheck
npm run build
npm test
```

The counter script uses only the local public fixture and prints its source
module digest. It accepts no input and never selects a network source or signer.
Baseline counts were measured with the same four-caller barrier against the
baseline transport module; the JSON retains its exact source digest.

Hosted memory, matched deployment and actual Publish-to-wallet latency remain
unverified. No artist source, private master, real data recovery, RPC to a live
chain, renewal, admission/quota change or musical write was used. The owner has
deferred the recovery rehearsal; this change does not resume it. #407 remains
open, with independent Room/artwork work following the selected product order.
