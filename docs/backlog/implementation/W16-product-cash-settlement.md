# W16 — Prove a real Product CASH settlement path

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W16** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/product-cash-settlement` created from the latest tested `origin/dev` when work starts.
- Dependencies: W05, W11.
- Release stage: Later feasibility.
- Existing issue: #85 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Determine whether Product CASH can safely grant the intended Asset Hub listening entitlement, then implement one proven path.

## Read first

- `web/src/features/runtime`
- `web/src/features/productHost`
- `docs/design/dotify-product-stack-alignment.md`
- `docs/explanation/royalty-settlement.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Recheck current official Product payment APIs, asset identifiers, chain topology, receipt authenticity, and finality. Produce a dated decision record comparing supported settlement/attestation options and their trust assumptions.
2. Model quote, payer/recipient binding, payment submission, finality, entitlement issuance, timeout, reconciliation, refund/dispute responsibility, and replay prevention. An off-chain receipt alone is not a runtime entitlement.
3. If an authoritative supported mechanism exists, implement a bounded adapter behind a disabled-by-default feature with deterministic tests and a testnet rehearsal plan. Store stable receipt IDs and make retries idempotent across restarts.
4. If no safe supported mechanism exists, finish the research result and integration harness, state the external dependency precisely, and leave CASH unavailable. Do not substitute a trusted relay without explicitly documenting that trust and obtaining the design decision.

## Acceptance and meaningful verification

- Wrong payer/asset/recipient/chain, reused receipt, reorg, delayed finality, duplicate retry, crash between payment and entitlement, and unreconciled payment.
- With authorized funds, one real receipt results in exactly one correct entitlement and value accounting reconciles.
- UI never says access acquired on an unverified payment signal.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No implicit exchange rate, fake CASH settlement, unauthorized funds transfer, or coupling all listening to a cross-chain service.

## Release condition

This does not block the native-runtime-payment pilot. Research completion is not settlement implementation completion.

## Handoff

Write `docs/backlog/implementation/evidence/W16.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
