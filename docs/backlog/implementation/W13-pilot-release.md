# W13 — Ship and evaluate the first coherent pilot

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W13** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/pilot-release` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12.
- Release stage: Pilot gate.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A small real community can use a traceable release, and the team knows what worked.

## Read first

- `docs/operations/deployment-configuration.md`
- `docs/operations/product-devnet-deployment.md`
- `docs/backlog/implementation/evidence-template.md`
- `deployments.json`
- `docs/index.html`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reconcile prerequisite evidence against the exact candidate SHA. Already-satisfied outcomes need verification, not gratuitous new code. Surface unavailable-device/live-host gates explicitly.
2. Prepare a reversible release plan with environment/config diff, contract addresses and bytecode/facets, app executable/CID, service versions, rollback target, monitoring, and known supported surfaces.
3. Use a small consented pilot, proposed as 3 artists, 5 hosts, and 20 listeners. The owner recruits participants; do not send invitations without authorization. Prepare tasks: publish, start room, join from link/QR, recover after interruption, inspect split, support artist.
4. Collect minimal aggregate evidence: time to sound, join success, recovery time, support completion, and whether people understand artist control/value. Do not collect continuous location, wallet-linked listening histories, or fabricate interview responses.
5. Produce a go/no-go record and three prioritized fixes. If deployment or external actions are already authorized, execute within that scope; otherwise finish the concrete release package before naming the specific remaining authorization.

## Acceptance and meaningful verification

- Run relevant automated suites and real-device smoke on the candidate; preserve sample counts and failures.
- Rehearse rollback using a safe environment. Confirm catalog/key compatibility across old/new versions.
- Target >=95% successful supported-device join attempts in at least 20 observed attempts; report uncertainty and actual results. This is a pilot target, not an established SLO.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No automatic main merge, live contract migration, unsolicited participant contact, or requirement to finish W14–W20 before pilot.

## Release condition

Ready code, deployed build, verified live journey, and accepted pilot are separate states. Do not label the pilot shipped until the deployment and real-use evidence exist.

## Handoff

Write `docs/backlog/implementation/evidence/W13.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
