# W15 — Make the galaxy respond honestly to music

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W15** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/live-musical-presence` created from the latest tested `origin/dev` when work starts.
- Dependencies: W14.
- Release stage: Experience expansion.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A room visibly breathes with its music without broadcasting private audio or inventing activity.

## Read first

- `web/src/components/SkyOfRooms.tsx`
- `web/server/signaling.mjs`
- `web/src/hooks/useSession.ts`
- `web/src/components/PersistentAudio.tsx`
- `docs/reference/socket-events.md`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Distinguish playing-state animation from measured music energy. Start with coarse track-derived energy from the authorized host playback pipeline; any beat/BPM signal must have a documented estimator and uncertainty.
2. Make sharing measured activity an explicit host control. Send a compact bounded payload at a low configurable frequency and interpolate locally; include timestamp/sequence and reject stale, oversized, out-of-order, or non-host updates.
3. Publish aggregate presence counts only. Treat counts as connected sessions unless unique-human evidence exists. No individual location, wallet identity, source keys, microphone input, or audio samples in discovery events.
4. Display stale/paused/disconnected states honestly, and ensure disabling activity removes it after a bounded expiry. Inspect existing globally readable beacons before adding any metadata; do not put high-frequency telemetry in Statement Store.

## Acceptance and meaningful verification

- Paused/ended track, disabled sharing, host disconnect, reordered messages, spoofed publisher, and reconnect.
- Measure signaling volume and audio/render CPU impact on the W14 mobile profile.
- Public discovery payload inspection proves no audio content or identifying listener list is included.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No ambient microphone capture, emotion inference, permanent listening telemetry, or assertion that session count proves human attendance.

## Release condition

Ship only when opt-out, expiry, spoof resistance, and performance are demonstrated. Decorative fallback must not be labeled measured sound.

## Handoff

Write `docs/backlog/implementation/evidence/W15.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
