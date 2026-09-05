# W19 — Implement opt-in nearby room discovery

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W19** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/nearby-rooms` created from the latest tested `origin/dev` when work starts.
- Dependencies: W13, W18.
- Release stage: Later implementation.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Hosts can invite nearby listeners while keeping their precise position private.

## Read first

- `web/src/features/rooms`
- `web/src/features/productHost`
- `web/server/signaling.mjs`
- `docs/reference/socket-events.md`
- `docs/operations/deployment-configuration.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Implement W18’s reviewed protocol behind a feature flag. Coarsen on-device before every outbound request. Bind publishing to the authenticated room host, with public rotating identifiers rather than wallet addresses.
2. Expose the two independent opt-ins, clear area-level disclosure, manual area/QR fallback, and an immediate visibility-off control. Stop updates on revocation, background policy, room end, and disconnect; server records expire even when clients vanish.
3. Enforce query bounds/rate limits, TTLs, payload validation, coarse aggregation, and retention limits server-side. Keep observability aggregate and strip coordinates/request bodies from logs.
4. Integrate Nearby as a discovery filter in the existing 2D/list and optional 3D renderers. Indicate broad proximity without exact pins/bearings/distances. A venue address appears only through a separate explicit public-venue choice.
5. Verify host geolocation permissions on actual Product surfaces. Unsupported hosts use manual selection or explicit continuation; do not weaken permission boundaries.

## Acceptance and meaningful verification

- Inspect network/log/storage output with synthetic coordinates to prove precise location never leaves the device.
- Opt-out, permission revocation, crash/TTL, replay/spoof, multiple nearby-cell queries, sparse density, and cross-cell boundary discovery.
- End-to-end tests using simulated locations plus an authorized real-device permission check; avoid publishing anyone’s real position in test artifacts.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No public geographic Statement Store beacon, permanent location history, wallet-location index, or claim the operator learns nothing.

## Release condition

Ship last among the requested discovery features, after a reviewed privacy design and pilot evidence. Feature-off must stop collection as well as hide UI.

## Handoff

Write `docs/backlog/implementation/evidence/W19.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
