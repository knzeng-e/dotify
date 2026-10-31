# Bulletin media publication pipeline — 2026-10-31

## Result and source

The owner requested the next Bulletin slice after merging #366. The server
adapter now overlaps independent direct stores with durable account nonces,
exact submission reconciliation and bounded payloads. API provider composition
is still unselected: no signer, network storage, DotNS update, renewal or
production switch was used to validate this work. Refs #288 / #287; neither
acceptance ticket is complete.

- Base: tested `dev` `55ef3a51133e3ce8546bad41b3c529ec8a07702c`, merge of #366.
- Base quality run: [41225142997](https://github.com/knzeng-e/dotify/actions/runs/41225142997), successful.
- Implementation: `c6a53407ec7bcaf431a1b8da95c0a93f7954e233`.
- Branch: `feat/bulletin-media-pipeline`.
- Design: [ADR 0039](../../../adr/0039-bulletin-media-pipeline.md).

## Review path

1. `services/api/src/services/bulletinMedia.ts`: finalized nonce observations,
   sender/nonce/CID reconciliation, owner/job persistence before broadcast,
   all-task observation on failure, and final lifetime/readiness checks.
2. `services/api/src/services/bulletinPipeline.ts`: two stores by default,
   maximum four; default 512 KiB / maximum 1 MiB in-flight payload; independent
   waves; verified children before parents and the complete graph before root.
3. `services/api/src/services/bulletinMediaState.ts`: extracted private-file
   persistence, v2 owner/job schemas and immutable job limits. Keep the original
   no-follow, owned-private-file, atomic rename/fsync and crash-lock boundaries.
4. `services/api/src/services/bulletinMedia.test.ts`, then
   `research/bulletin-prototype/protected-release.test.mjs`: adversarial recovery
   tests and the existing real-encoder/key-delivery rehearsal over a storage model.

## Verification

Node 22.13.1; unchanged API/research dependency lockfiles. Local API socket tests
ran with loopback permission. No external storage or chain transport is present
in the test fixtures.

| Check | Result | What it establishes |
| --- | --- | --- |
| Full API suite, `npm --prefix services/api test` | 261/261 pass, including 26 Bulletin adapter cases | Existing API behavior plus bounded stores/audits, private ownership, current ciphertext paths and injected recovery failures |
| Final targeted adapter run | 8/8 pass | Final idle-account rule, fresh-process continuation, read-only recovery, quota changes, reordered confirmations and retention at the final nonce head |
| `npm --prefix research/bulletin-prototype run test:protected` | 8/8 pass | Real FFmpeg encoding/decoding, existing custody and nonce reservations, real Web/Product signature checks, canonical access denials and lost-acknowledgement retry using the nonce-aware storage model |
| API strict typecheck and production TypeScript build | pass | Public transport/state contracts and production module compilation |
| Import built `dist/services/bulletinMedia.js` | pass | Extracted state/planner modules resolve in the compiled ESM adapter |
| Prettier on changed code, offline backlog sync and `git diff --check` | pass | Formatting and backlog mapping consistency |

The full API and protected runs preceded the final refinement permitting
monotonic, finalized DotNS nonce progress **between fully settled jobs**. The
8-case targeted run and final typecheck/build cover that refinement at the
implementation SHA above. No broader application behavior changed. Test durations
are local model execution, not Bulletin upload benchmarks.

### Failure evidence

- Gated model writes demonstrate two simultaneous store calls only after both
  durable nonce intents exist; observed payload stays within the selected cap.
  A separate byte-cap case limits otherwise permitted four-way concurrency.
- Later nonces can confirm first. Parents still wait, and root remains last.
- Lost acknowledgements stop admission and retain exact pending nonces. The
  successful sibling finishes and is checkpointed before the operation returns.
- A fresh Node process loads two pending nonces from disk, verifies their model
  submissions and continues with one store per CID and one use per nonce.
- CID presence with no matching sender/nonce receipt, stale nonce observations,
  cursor rollback, external progress during active recovery, duplicate intents
  and null errors all fail closed. An untrusted `definitelyNotSubmitted` flag
  does not release an uncertain nonce.
- Failure while persisting a sibling reservation prevents its invocation; only
  that provably uninvoked trailing nonce may be released. Attempt/byte accounting
  remains conservative. A failed journal rename drains already-started tasks,
  preserves the uncertain/unsent state and does not publish the root.
- Cancellation with two uncooperative in-flight model stores keeps both intents
  and blocks another job. Their late completion cannot edit the journal; a later
  explicit retry reconciles them without duplicate stores.
- Exact initial transaction/byte allowance succeeds while preserving one renewal
  cycle. Quota shrinkage prevents the next wave. Retention expiry at the final
  nonce observation prevents readiness even after all blocks were stored.
- Read-only reconciliation can finish an already committed graph and cannot
  store missing data. V1 owner state is rejected byte-for-byte unchanged.

The v2 schema is a pre-activation contract change, not a migration of deployed
state. V1 records lack authoritative account nonce ownership. Preserve them and
review a fresh state/account plan; never reset the same account's directory to
bypass a barrier. No existing ciphertext or encryption-nonce ledger is changed.

## Operational and remaining boundaries

The owner may reuse the same account for finalized DotNS operations between
fully settled jobs. During publication, no other tool or external pending
transaction may use that account. The account-wide cursor rejects rollback;
active jobs require exact equality. This does not coordinate distributed writers.

Publication remains capped at five minutes and individual transport calls at
thirty seconds. Waves intentionally wait for their slowest started member before
admitting another wave. This is simpler to audit than a continuously filled
queue, but may leave throughput unused. Abort bounds application waiting, not a
broadcast's lifetime or an injected transport's resource use. Graph construction
still retains the graph in memory; in-flight payload bounds are not a memory cap.

Before any live canary:

1. Implement/review the explicit live transaction transport and bounded lookup of
   finalized sender/nonce store receipts from each recorded `afterBlock`. Prove
   lost-acknowledgement and cancellation behavior against actual chain data.
2. Prepare the private state/account isolation and coherent backup/restore plan,
   representative encrypted fixture, exact bytes/transaction/renewal budget and
   separate owner approval. Previous diagnostic budgets are already completed.
3. Wire only the reviewed isolated custody callback/read path, preserving signed
   canonical key access and existing catalog gating. Rehearse real registration,
   denied/authorized access and protected playback on Web and physical Hosts.
4. Measure upload duration, first audible sound, continuity, peak worker memory,
   quota consumption/cost and recurring retention. The model and earlier lab
   listens do not establish real-release throughput or protected device acceptance.

See [deployment configuration](../../../operations/deployment-configuration.md#prepared-v2-publication-pipeline).
