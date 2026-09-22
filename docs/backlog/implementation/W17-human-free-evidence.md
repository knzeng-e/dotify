# W17 — Bind Human free access to real private personhood

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W17** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/human-free-evidence` created from the latest tested `origin/dev` when work starts.
- Dependencies: W03, W11.
- Release stage: Later feasibility.
- Existing issue: #12 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Human free has a demonstrated proof and identity-binding story without turning room participation into surveillance.

## Read first

- `contracts/evm/contracts/libraries/LibPersonhood.sol`
- `contracts/evm/contracts/test/MockPersonhoodPrecompile.sol`
- `web/src/features/identity`
- `docs/backlog/11-proof-of-personhood-integration-research.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reconcile stale mocked-registrar documentation with current precompile code and live evidence. Verify the current official Humanity/Individuality interfaces, tiers, context/domain, proof expiry, revocation, and supported hosts.
2. Document how a proof binds to the listening identity and how Product sr25519/H160 representations relate. Test replay across contexts and account switching; never infer proof from a connected wallet.
3. Assess linkability and data minimization before persistence. Keep raw sensitive proofs and identity documents out of analytics, room discovery, and public evidence. Provide understandable unavailable/expired/denied paths.
4. Implement only the supported bounded path once the research establishes it; otherwise retain an honest beta/unavailable state and specify the external dependency. Update the ticket’s delivery notes with implemented versus mocked versus live-verified status.

## Acceptance and meaningful verification

- Wrong account/context, expired/revoked proof, unsupported host, stale cache, tier mismatch, and mocked-precompile versus actual-chain distinction.
- Live proof verification requires authorized identity interaction; never fabricate it.
- Ordinary room guests still join without proving personhood.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No identity-document collection, universal human-verification gate, or claiming production readiness from a local precompile mock.

## Release condition

Optional after pilot. Enable Human free only on demonstrated supported surfaces with privacy boundaries documented.

## Handoff

Write `docs/backlog/implementation/evidence/W17.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
