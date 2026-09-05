# W02 — Protect upload resources and session revocation

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W02** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/upload-session-boundaries` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01.
- Release stage: Pilot.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Public upload capacity is bounded by authenticated authority, and logout has an explicit durable meaning.

## Read first

- `services/api/src/routes/uploads.ts`
- `services/api/src/routes/auth.ts`
- `services/api/src/services/sessionTokens.ts`
- `services/api/src/services/replayProtection.ts`
- `services/api/src/app.ts`
- `docs/operations/deployment-configuration.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Trace upload callers first. Require a narrowly scoped, expiring, server-verified upload authorization for artists. Bind it to the requester, purpose, and upload budget; preserve supported EVM and Product identity schemes.
2. Enforce per-principal and global byte/concurrency quotas, validate decoded media and size limits, and clean up rejected or interrupted uploads. Treat MIME declarations as untrusted. Keep Free listening and guest room entry unauthenticated.
3. Reproduce whether the in-memory revoked-JTI set loses logout revocation after restart. Implement persistent revocation compatible with the actual deployment topology, or a clearly documented alternative that invalidates affected sessions safely. Do not pretend an in-memory map is shared across replicas.
4. Keep logs free of tokens, signatures, keys, and uploaded contents. Document quota persistence, outage behavior, token expiry, and operator configuration. Split upload and revocation into two linked PR slices if their migrations cannot be reviewed coherently.

## Acceptance and meaningful verification

- Unauthorized upload, exhausted quota, spoofed type, interrupted stream, valid artist, and expired/replayed authorization.
- Logout followed by process restart; rejection of the old token and successful new login.
- Cross-instance revocation if multi-instance operation is supported; otherwise enforce/document the single-instance limit.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No guest authentication, blanket proof-of-personhood requirement, or production secret rotation.

## Release condition

Required before open public uploads. Tests and operational configuration must agree on persistence topology.

## Handoff

Write `docs/backlog/implementation/evidence/W02.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
