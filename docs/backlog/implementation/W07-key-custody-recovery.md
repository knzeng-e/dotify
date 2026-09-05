# W07 — Version content keys and rehearse recovery

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W07** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/key-custody-recovery` created from the latest tested `origin/dev` when work starts.
- Dependencies: W03.
- Release stage: Pilot.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Operators can recover encrypted releases and rotate future key material without silently making older music unreadable.

## Read first

- `services/api/src/services/keyVault.ts`
- `services/api/src/services/audioV2.ts`
- `services/api/src/config.ts`
- `docs/explanation/content-protection.md`
- `docs/operations/deployment-configuration.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Document the existing master-secret derivation, deterministic per-content key behavior, and the distinction between a short-lived grant and a key already learned by a client.
2. Add explicit key-version lookup with a legacy migration path. New encryption can use the active version while old ciphertext remains resolvable with the correct retained version. Missing versions must fail clearly and safely.
3. Provide a backup/restore and local rotation rehearsal with synthetic secrets and ciphertext. Keep production keys out of repository, logs, fixtures, and evidence files. Document that compromise recovery may require re-encryption; changing a config variable cannot retract disclosed keys.
4. Define a concrete artist-export/alternative-operator recovery design as a follow-up, including artist authentication, key custody, and authority continuity. Do not claim full artist sovereignty while the operational key service remains indispensable.

## Acceptance and meaningful verification

- Read legacy ciphertext after adding a new active version; decrypt new ciphertext only with its intended version.
- Restore an isolated service from a documented backup and verify policy enforcement and media access.
- Missing key version, wrong release identity, and Free-to-protected changes never imply revocation of already disclosed material.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No production rotation, publication of real key backups, or speculative threshold-cryptography rollout.

## Release condition

A rehearsed restore is required before depending on the service for pilot catalog continuity; stronger decentralized custody remains a named expansion item.

## Handoff

Write `docs/backlog/implementation/evidence/W07.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
