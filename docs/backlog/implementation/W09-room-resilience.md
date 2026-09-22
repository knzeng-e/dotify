# W09 — Keep shared listening alive across real networks

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W09** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/room-resilience` created from the latest tested `origin/dev` when work starts.
- Dependencies: W08.
- Release stage: Pilot.
- Existing issue: #89 (reconcile current state; do not close an epic for a partial slice)
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Room guests can join, recover, and understand interruptions without losing trust or facing wallet prompts.

## Read first

- `web/src/hooks/useSession.ts`
- `web/server/signaling.mjs`
- `services/api/src/routes/turn.ts`
- `web/src/components/PersistentAudio.tsx`
- `docs/explanation/listening-rooms.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Reproduce the current host-to-listener topology and capacity limit. Exercise TURN-only connectivity, reconnection, host disappearance/resume, and background/foreground behavior.
2. Implement bounded retries, accurate states, stale-presence cleanup, and resource disposal where evidence identifies gaps. Keep host authority authenticated and prevent another socket from claiming room ownership.
3. Measure host upstream/CPU and room capacity before considering an SFU. If the existing cap is appropriate for the pilot, enforce it honestly with a clear full-room state.
4. In Product iOS, detect the documented pre-ICE WebRTC boundary and preserve canonical room continuation. Verify the external browser actually rejoins the intended room; do not label this native in-app audio.

## Acceptance and meaningful verification

- Two real devices/networks, forced relay, host refresh, network loss/recovery, duplicate joins, stale counts, and room-full behavior.
- Verify no guest requests a protected source key/file and an unauthorized host sends no protected audio.
- Record sync drift and recovery time on named devices, including mobile lock/background limitations.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No unconditional SFU migration, global room-size increase, unsupported host handoff, or permanent listening-history analytics.

## Release condition

Required before pilot. A stated device limitation is acceptable only with a tested supported route; endlessly connecting is not.

## Handoff

Write `docs/backlog/implementation/evidence/W09.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
