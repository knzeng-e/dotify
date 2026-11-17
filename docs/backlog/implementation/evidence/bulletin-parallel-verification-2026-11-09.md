# Parallel Bulletin verification reads, 2026-11-09

Refs #407. Candidate from tested merged dev `5f797e0b`, after #417.
Live custody remains `f9fdd693`; Web/Product remain **0.1.82**.
No service update/restart, signing-key access or musical upload occurs.

## Evidence before implementation

Read-only inspection finds both earlier audio preparations ready after one
attempt each, with **175 stored blocks / 18,718,962 graph bytes** per job.
Created-to-ready intervals are about **54.7 and 58.8 minutes**, including
queue/encoding/storage but excluding wallet registration/catalogue visibility.
Receipt positions span **526 and 550 chain blocks**, often two receipts in one
block followed by a gap of about six blocks. This does not identify transaction
creation, inclusion or finality delay. No post-#415 timing report exists yet.

Three serial dependencies in the read transport are unnecessary: independent
header/runtime reads after selecting a finalized hash; transaction metadata and
retention at that snapshot; canonical body and parent-runtime events after
selecting the candidate block header.

## Design and failure boundaries

A private two-read helper starts both branches and observes their settled results
before propagating an error, subject to the same caller cancellation/deadline.
It keeps the first branch's error identity/priority. Every branch remains inside
the existing RPC deadline and carries the same abort signal. An unresolved
sibling cannot turn a failed proof into success.

Genesis verification still precedes head selection. Each operation obtains a
fresh finalized head. Paired storage reads use its exact hash; events use the
candidate block with **parent-runtime** metadata. Canonical header/body roots,
sender, nonce, direct payload, successful dispatch/storage event, CID/raw bytes
and current retention are checked as before. No eligibility/head cache is added;
the existing two-runtime-code metadata cache is unchanged.

The cold canonical proof still makes **14 RPC calls**, a warm proof **12**. Four
independent proof callers peak at at most **8 in-flight RPCs**, below the existing
dedicated-client cap of 16. Deployed write concurrency stays two with the same
byte ceiling. No profile, graph, schema, reservation, nonce journal, renewal
reserve, endpoint, SDK or production timeout changes. Failed proofs retain the
existing durable uncertainty/reconciliation rules.

Larger write waves or packing remain separate decisions because they change
immutable configuration or format/recovery requirements. This slice keeps the
existing read/proof set and removes unnecessary serial waiting.

## Read-only comparison

Two interleaved comparisons use one existing **276-byte synthetic marker**.
Each variant sequentially performs status, retained CID lookup and CID-verified
raw read. AB/BA order alternates over six pairs. The first transport-metadata-cold
pair is retained but excluded from warm medians.

| Comparison | Warm pairs | Baseline median | Candidate median | Warm RPCs / check | Peak pending RPCs |
| --- | ---: | ---: | ---: | ---: | --- |
| Preliminary | 5 | 850 ms | 620 ms | 14 for both | 1 → 2 |
| Reproducible CLI | 5 | 1,857 ms | 1,441 ms | 14 for both | 1 → 2 |

The component's warm medians are about **22–27% shorter** in these small samples.
Network conditions were not measured, the WS connection is shared across
variants and remote caches were not reset. Absolute latency varies markedly
between runs. This is **not a publication or finality benchmark** and cannot be
extrapolated to the 55-minute preparations. Full per-store timings and acceptable
publication latency remain open; #407 stays open.

The [bounded result JSON](bulletin-parallel-verification-2026-11-09.json) preserves
all samples, cold/warm distinction, observed heads, request counts and peaks.
Source digests bind the formal comparison to the reviewed transport files;
the baseline blob matches dev. No signer is loaded and only whitelisted read
RPCs are permitted.

## Reproduction and validation

`services/api/scripts/compare-bulletin-reads.mjs` is an operator-only comparison,
excluded from the runtime image. Run against reviewed source worktrees with the
pinned API dependencies. It requires `--live`, both source paths and all public
read inputs explicitly. It never selects an environment signer/provider/account.
A credential-free wss endpoint is required. It refuses to overwrite a report,
limits work to twelve checks under one 90-second outer deadline and destroys
its client on cancellation/completion.

```sh
cd services/api
node --import tsx scripts/compare-bulletin-reads.mjs --live \
  --baseline-source /path/to/baseline/services/api/src/services/bulletinTransport.ts \
  --candidate-source "$PWD/src/services/bulletinTransport.ts" \
  --endpoint "$bulletin_read_endpoint" --genesis "$bulletin_read_genesis" \
  --account "$bulletin_read_account" --cid "$existing_synthetic_marker_cid" \
  --output /tmp/new-bulletin-read-comparison.json
```

Use an existing synthetic marker. Exact comparison inputs stay in the private
operation package, bound by the public input digest. Offline proof correctness
is independently reproducible with the committed captured-receipt fixture.

- **19/19 transport cases** pass: original canonical proof failures plus overlap
  barriers, sibling-error draining, cancellation/error identity, bounded four-reader
  concurrency, unchanged cold/warm call counts, refreshed identity and expired
  retention refusal. Serial reads cannot pass the overlap barriers; CI contains
  no wall-clock speed assertion.
- **378/378 API cases**, API typecheck/build, formatting and whitespace pass.
  The comparison script's syntax/help, pre-import live/credential guards and
  actual read-only execution pass.
- No production DB fault, maintenance, signing or quota/admission change occurs.
  Rollout is a later separately reviewed custody image update.

## CI follow-up: Room measurement readiness

The first candidate CI passed API, builds and the other gates, but one of 331
core browser journeys failed before its first audible-energy assertion
(run `42668686444`, job `129339785720`). Its trace shows a running measurement
AudioContext and a live/enabled receiver track that remains `muted`, meaning
that the receiver has not received media. The **In sync** label is emitted when
`ontrack` attaches the stream; it is not a transport-connection barrier.

`web/e2e/room-sync.spec.ts` now waits for the current receiver's live track to
become unmuted before attaching the meter or driving the host's first Play.
A paused sender can transmit silence, so this condition does not require
starting playback. All audible-energy, repeated host-pause silence, listener
local-pause and stream-identity assertions remain unchanged, as do deadlines
and retries. Failure diagnostics also record current-stream identity and Room
quality events. This is a test setup correction, not a production audio change.

Local validation: the two Room-sync journeys each pass five repetitions with
two workers (**10/10**, pinned lockfile dependencies), preserving real Web Audio
and WebRTC energy/silence checks. Targeted ESLint, Prettier, whitespace and
offline backlog checks pass. The replacement full CI run remains a separate gate.
