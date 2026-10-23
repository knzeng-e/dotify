# W13 — Ship and evaluate the first coherent pilot

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W13** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/pilot-release` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12.
- Release stage: Pilot gate.
- Existing issue: #158. Reuse this release gate; do not create a duplicate pilot issue.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Candidate and prerequisite correction, 2026-10-23

W30's non-root cutover and the new streaming services are deployed in the
[0.1.58 reset](evidence/product-0.1.58-rollout-2026-10-22.md). The latest Product
compatibility publication is 0.1.60 ([#327](https://github.com/knzeng-e/dotify/pull/327)),
but API/signaling/Web are not thereby redeployed to the same source. Select and
record a coherent candidate before a pilot claim. Historical 0.1.25/0.1.26
rollback targets and old DAV2 measurements do not validate the reset catalog.
Use current v3/schema-6 first-sound evidence and a compatible rollback that
preserves the latest custody, revocations and permanent nonce reservations.
#274 retains native location; #85/#89 retain native signing/network/media checks.
The owner's 42-person limit below supersedes the earlier proposed sample.

## Owner update: trusted pilot from 2026-10-17

The owner plans a trusted pilot of at most **42 consented participants on
several continents**, starting 2026-10-17. It replaces the proposed
3 artists / 5 hosts / 20 listeners sample below; the evidence and go/no-go
rules are unchanged.

- **Blocking prerequisite:** W30 merged and deployed, with its read-only checks
  recorded (real client address seen by both services, one signaling machine,
  TURN grants returned). W31 is recommended, not blocking.
- **Distance:** API and signaling run in one region (Amsterdam). Record each
  participant's coarse region (continent level only), time to first sound,
  join success, and whether a TURN relay was used, so W33 and W39 can be
  decided from measurements.
- **During the pilot:** fixes ship as small PRs from the W30-W35 sequences.
  Record the build SHA for every observation, since the build changes during
  the run.
- **Data minimization:** no wallet-linked listening history, no continuous
  location, no participant contact without the owner.
- **Stop rule:** if key delivery or room joins fail for several participants at
  once, pause the pilot, roll back to the previous recorded release, and record
  the incident.

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
