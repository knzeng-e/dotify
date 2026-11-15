# Separate local audio transport waits — 15 November 2026

**Implemented and locally tested; not deployed or a latency improvement.** Refs
#395. Code commit `51a3a4164526d9f2fd1162c300d418b0655d9788` is based on merged dev
`16edd876f4f3b211faff73d9b91a7428a87b7522`, whose tree matches fully tested #474
head `90543216703bbeb3bb99313983903cedeaf68e2a`
([CI](https://github.com/knzeng-e/dotify/actions/runs/43665880222)). The separate
merge-triggered dev CI was running when this branch started.

## Why this is the next slice

The [matching 0.1.87 phone check](product-0.1.87-rollout-2026-11-15.md#matching-phone-follow-up)
succeeds once with Pause and audible guest/short-lock sound, but preparation
takes 36.955 s. Its cumulative read work includes native probes, queueing,
response and body waits. Neither that aggregate nor the earlier different-cache
0.1.86 run identifies which transport phase should change. The missing native
cover remains a separate #388 failure; this candidate changes no artwork behavior.

The existing explicit local report now distinguishes relay admission, native
probes, HTTP headers and body consumption, with settled attempt/failure counts.
The [measurement guide](../../../how-to/measure-room-startup.md#distinguish-transport-phases)
owns exact field meanings, overlap and incomplete-coverage limits. It remains
impossible to infer server processing versus network RTT from header wait alone.

## Design and review path

1. `web/src/features/catalog/streamingReadTimings.ts` wraps each existing promise
   and records its settled duration/outcome in constant-size counters. An observer
   exception cannot replace successful bytes or mask the original rejection.
2. `streamingPlayback.ts` instruments the existing native, relay, Fetch and body
   boundaries, then connects them to each reader's aggregate. Acquiring a slot
   still covers the whole body; cache rechecks still release it without a Fetch.
3. `audioStartupTelemetry.ts` allowlists nine additional finite nonnegative numeric
   counters in the same explicit support export. Old reports remain readable;
   absent fields are not invented measurements.

Keeping access and transport limits fixed permits a matched phase diagnosis.
Increasing parallelism or the media deadline would change the shared resource
contract without first explaining these waits. No new observability service or
server deployment is needed for this client-side boundary.

Counters retain no URL, CID, source/Room/account identity, key or raw error text.
The existing bounded page-memory report and explicit copy action remain; no
persistent history, automatic transmission, extra request, retry or timer is
introduced. Cancelled/failed phases contribute only if settled before a snapshot;
there is no claim to capture unfinished sibling work on a deadline. Host/HTTP
fallback, object authentication, 40-MiB cap, 60-second media budget, solo priority,
two-body relay and four complete-file workers retain their existing behavior.

## Validation on the code commit

- **1,223 unit tests / 158 files pass.** Six new regressions exercise a cancelled
  third relay waiter with independently held headers/bodies, warm-cache silence,
  failed native recovery, non-200 fallback, incomplete-body fallback, observer
  failure isolation and per-reader/export wiring. Export coverage rejects
  injected private fields and negative/nonfinite numeric values.
- **18 Chromium/WebKit real synthetic AAC/crypto cases pass.** The report fields
  are present through authenticated complete playback; existing held-fragment,
  two-body relay, Free denial, solo handoff, explicit/native Pause and failure/
  authoritative-denial checks pass in both engines. They do not prove native
  iPhone audio or artwork behavior.
- Typecheck, changed TypeScript lint/format, Web and frozen Product builds pass
  with Node 22.23.5 and unchanged locked dependencies reused locally. Existing
  Vite chunk-size warnings remain. These validation builds include local changes
  and a temporary dependency symlink, removed before commit; they are not clean
  release artifacts.

The first browser invocation stops before tests because its expected local
synthetic fixture is absent. The synthetic-only artifact from the green base CI
is retrieved, then the 18 selected cases run successfully. No artist audio,
production keys, wallet, live API/Fly inspection or storage writes are used.

## Remaining gates

Review, full candidate CI and separately authorized matching client delivery
precede a new phone phase observation. Web/Product remain 0.1.87 with unchanged
server images, access policies and budgets. No signer, admission, compact/CASH
activation or real recovery is part of this implementation. Keep #395 open for
acceptable/comparable startup and repeated full-track listening, and #388 for
reliable native artwork. The owner's real-recovery deferral remains in force.
