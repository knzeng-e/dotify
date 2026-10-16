# W39 - Scale rooms beyond one signaling machine and decide on an SFU

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Execute **W39** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below. This is a research sequence with a runnable prototype: its decision record and feasibility checks are the deliverable.

- Branch: `research/horizontal-rooms` created from the latest tested `origin/dev`.
- Dependencies: W30, W36.
- Release stage: Later.
- Product purpose: more people listening together, in more places, without making guests sign in or receive keys.

## Problem at audit

- Rooms, nearby leases, and limiters live in one process (`web/server/signaling.mjs`, `web/server/nearby.mjs`); a deploy closes every room and a second machine would split rooms.
- Audio is a WebRTC star from the host, capped at 24 listeners per room (`SIGNAL_MAX_LISTENERS`).

## Questions to answer

1. **Horizontal signaling.** Socket.IO Redis adapter, sticky sessions on Fly, room ownership, and shared limiters and nearby presence. What breaks, and what is the smallest safe design?
2. **Deploy without closing rooms.** Can host resume (`room:resume`) plus a drained shutdown keep rooms alive across a deploy?
3. **SFU beyond 24 guests.** Compare LiveKit, mediasoup, and a managed service on cost, latency, and operations. Confirm the invariant: the SFU receives only the host's stream, never a key or source file.
4. **Regions.** Is a second signaling and TURN region needed for listeners far from Amsterdam? Use pilot measurements.

## Acceptance

- Decision record with measured prototype results (two signaling instances, one room spanning both; one SFU room with more than 24 synthetic listeners).
- Explicit list of follow-up work tickets, or an evidenced "not now".

## Scope boundary

No production change and no new paid service without owner authorization.

## Handoff

Write `docs/backlog/implementation/evidence/W39.md` using `evidence-template.md`.
