# W04 — Make purchased access and ownership claims truthful

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W04** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `fix/access-promise` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01.
- Release stage: Pilot.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Before paying, listeners understand what access grants and what an artist can subsequently change.

## Read first

- `web/src/components/AccessGateOverlay.tsx`
- `web/src/features/access`
- `contracts/evm/contracts/pallets/MusicAccessPallet.sol`
- `contracts/evm/contracts/pallets/MusicRegistryPallet.sol`
- `docs/explanation/access-control-model.md`
- `docs/explanation/royalty-settlement.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reproduce paid access after deactivation and mode changes against current contracts. Build a small policy table covering Free, Classic, Human free, active/inactive, previously paid, and runtime upgrades.
2. For the fastest pilot, retain current on-chain semantics and replace unsupported durable/permanent promises with accurate plain language before payment and in receipts. State that a payment record is not a guarantee of perpetual media availability.
3. Explain separately the original artist, runtime owner, NFT owner, and royalty beneficiaries. Do not imply NFT transfer changes policy control or runtime ownership changes directory binding unless demonstrated.
4. Record durable entitlement semantics as a separate decision if desired; do not silently change existing purchases. Keep primary UI short with accessible expandable details.

## Acceptance and meaningful verification

- Contract tests reproduce the policy table; UI tests verify the correct price, asset, duration/conditions, and recipient disclosure.
- Canceled and failed payments never show acquired access; deactivated previously purchased tracks give honest feedback.
- Check wording on mobile and Product hosts.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No retroactive change of rights, automatic contract upgrade, or legal ownership guarantee.

## Release condition

Required before accepting pilot payments. A truthful existing policy can ship before a redesigned entitlement system.

## Handoff

Write `docs/backlog/implementation/evidence/W04.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
