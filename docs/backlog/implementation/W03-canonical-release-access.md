# W03 — Bind key delivery to the canonical release

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W03** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/canonical-release-access` created from the latest tested `origin/dev` when work starts.
- Dependencies: W02.
- Release stage: Pilot.
- Existing issue: #141.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A release cannot obtain another release’s key or lose availability because an unrelated runtime reverts.

## Read first

- `services/api/src/services/chainAccess.ts`
- `services/api/src/services/keyVault.ts`
- `services/api/src/services/catalog`
- `services/api/src/routes/keys.ts`
- `services/api/src/services/signatures.ts`
- `docs/explanation/access-control-model.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reproduce the reviewed full-directory scan, duplicate-contentHash ambiguity, and warm/cold-cache differences. Establish the authoritative release identity from confirmed chain/catalog data.
2. Bind chain ID, artist runtime, release identity, encrypted object identity, and key version across signed requests, policy checks, and key lookup. Do not accept a caller-supplied runtime as authoritative without registry validation.
3. Bound unrelated runtime failures and lookup work while failing closed for the requested release. Define invalidation on policy changes, upgrades, reorgs, and index lag. Never cache authorization beyond its justified freshness boundary.
4. Provide an explicit compatibility/migration path for existing hash-only requests and registered media. Reject ambiguity without issuing a key. Keep Free zero-address verification and host-only protected key delivery.

## Acceptance and meaningful verification

- Two artists register equal hashes with different policies; neither can unlock the other’s protected object.
- An unrelated runtime reverts; the target remains resolvable when authoritative evidence permits.
- Warm/cold cache, stale index, reorg, upgrade, signature tampering, and expired grant produce consistent safe outcomes.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No arbitrary runtime allowlisting supplied by the frontend; no whole-catalog rewrite or DRM claim.

## Release condition

Required before broad protected catalog publication. Migration fixtures must cover existing releases.

## Handoff

Write `docs/backlog/implementation/evidence/W03.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
