# W05 — Prevent one royalty recipient from blocking everyone

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W05** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/royalty-failure-isolation` created from the latest tested `origin/dev` when work starts.
- Dependencies: W04.
- Release stage: Pilot.
- Existing issue: #145.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A recipient unable to receive a transfer cannot make an otherwise valid music purchase fail.

## Read first

- `contracts/evm/contracts/libraries/LibMusicRoyalties.sol`
- `contracts/evm/contracts/pallets/MusicAccessPallet.sol`
- `contracts/evm/test`
- `web/src/generated/contracts`
- `docs/explanation/royalty-settlement.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reproduce a purchase with a recipient that reverts on payment. Compare all-pull settlement with immediate distribution plus bounded-gas claimable fallback; choose and document the smallest safe approach.
2. Preserve exact value accounting, rounding rules, authorization, and reentrancy protection. Make paid, pending claim, claimed, and failed states distinguishable in events and receipts. No external call may consume unbounded gas or corrupt the ledger.
3. Test namespaced Diamond storage compatibility, selectors, generated ABI changes, and existing runtime behavior. Produce a local upgrade/redeployment rehearsal and rollback/migration plan before any live action.
4. Implement only the minimal claim/receipt UI needed by affected recipients. An accrued amount must never be displayed as money already received.

## Acceptance and meaningful verification

- Rejecting receiver, gas-consuming receiver, reentrant receiver, dust/rounding, multiple recipients, double-claim, and unauthorized claim.
- Sum of paid plus claimable equals the distributable amount across repeated purchases.
- Old runtime fixtures and a local upgraded runtime retain prior state and access behavior.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No automatic live facet cut, treasury redesign, speculative rewards, or CASH integration.

## Release condition

Required for an unrestricted native-payment pilot unless the affected payment path is disabled and its limitation explicitly accepted. Local correctness does not prove live deployment.

## Handoff

Write `docs/backlog/implementation/evidence/W05.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
