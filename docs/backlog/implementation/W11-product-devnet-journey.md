# W11 — Prove the Product DevNet user journey

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W11** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/product-devnet-journey` created from the latest tested `origin/dev` when work starts.
- Dependencies: W03, W04, W06, W05.
- Release stage: Pilot.
- Existing issue: #85 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Product is an explicitly tested destination for discovery, artist support, and room entry.

## Read first

- `web/src/features/productHost`
- `web/src/features/runtime`
- `web/src/components/ProductCdmHostSmokeEvidencePanel.tsx`
- `docs/explanation/product-devnet-architecture.md`
- `docs/operations/product-devnet-deployment.md`
- `docs/design/dotify-product-stack-alignment.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Refresh official SDK/host documentation and installed versions. Inspect existing #129 smoke evidence and adapter implementation; do not rebuild delivered code. Keep SDK upgrades isolated unless a specific incompatibility requires one.
2. Exercise Product account connection, H160 binding, CDM package resolution, native-runtime payment forwarding, transaction inclusion/finality, and post-payment entitlement readback. Retain transaction receipts when readback is delayed or fails.
3. Distinguish submitted, confirmed, and access-verified states. Never resubmit payment merely because a read times out. CASH remains a separate unsupported rail until W16 establishes settlement.
4. Verify manifest permissions, API/gateway/TURN egress, Bulletin/DotNS publication configuration, canonical room links, and per-host capability fallbacks. Confirm devnet network/chain IDs; the reviewed paseo preset targets a different environment.
5. Complete a matrix for standalone mobile/desktop, Product Desktop/Web, and Product iOS. Name build SHA, app executable/version, host version, chain, receipts, and missing evidence. Test WebGL/location availability as feasibility observations, not shipped features.

## Acceptance and meaningful verification

- Permission denial, unavailable host, wrong chain, identity mismatch, canceled payment, reverted payment, delayed readback, and duplicate-click safety.
- With separately authorized test credentials/funds, demonstrate one real Product-signed unlock and entitlement readback; otherwise provide the ready-to-run harness and mark the live gate blocked.
- A Product host shares a canonical link and an ordinary-browser guest joins without account connection.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No implicit CASH-to-PAS conversion, hidden viem fallback for Product signing, unsolicited live payments, or claim that in-app iOS WebRTC is solved.

## Release condition

Product Desktop/Web acceptance is required for the Product pilot claim. If host evidence is unavailable, a web-only pilot may proceed with an explicit label; Product readiness remains blocked.

## Handoff

Write `docs/backlog/implementation/evidence/W11.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
