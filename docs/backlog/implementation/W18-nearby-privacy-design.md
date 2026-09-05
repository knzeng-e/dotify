# W18 — Design nearby discovery with explicit privacy boundaries

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W18** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `docs/nearby-privacy-design` created from the latest tested `origin/dev` when work starts.
- Dependencies: W09, W10.
- Release stage: Later research.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Agree on a testable proximity contract before collecting location.

## Read first

- `docs/explanation/listening-rooms.md`
- `docs/explanation/product-devnet-architecture.md`
- `web/src/features/productHost`
- `web/server/signaling.mjs`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Specify separate host opt-in to appear nearby and listener opt-in to search. Include manual area selection and venue QR alternatives, denied permissions, sparse areas, and moving hosts.
2. Threat-model other listeners, abusive hosts, the discovery operator, public beacon readers, query triangulation, and cross-session linking. Coarse cells reduce precision but do not guarantee anonymity.
3. Design device-side coarsening, bounded query area/rate, rotating discovery identifiers, short TTLs, deletion/expiry semantics, and minimum useful density or enlarged areas. Set concrete values as documented tunables justified by simulations.
4. Keep exact coordinates off the network, logs, durable stores, chain, and Statement Store. Specify operator visibility of coarse area/IP, retention limits, and how authentication prevents impersonation without public wallet-location binding.
5. Produce a typed protocol proposal, synthetic-density examples, permission copy, abuse cases, and a Product/browser capability matrix. No real location collection in this research step.

## Acceptance and meaningful verification

- Walk through sparse/rural, crowded venue, grid boundary, roaming host, repeated adversarial queries, permission revocation, and expired presence.
- Verify proposed galaxy positions do not encode physical coordinates and user controls match actual disclosure.
- Use current official browser/Product permission documentation; unavailable host APIs remain unknown.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No assertion of anonymity from geohashing, exact distances, background tracking, or deploying the proposed endpoint.

## Release condition

The design must name which threats it does and does not address before W19 is implemented.

## Handoff

Write `docs/backlog/implementation/evidence/W18.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
