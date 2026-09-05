# Dotify implementation playbook

Twenty agent-ready work sequences for shipping a trustworthy musical commons on Product DevNet and ordinary web, then expanding discovery. Written 2026-09-05 against dev `bb3e2557215ee8628f4c0e107de6d1e984baaccf`; agents must refresh the source before acting. This is a plan, not a claim that these features or branches already exist.

## The branch workflow

Keep all prompts together on `dev`. Create one short-lived implementation branch when its work starts, from the latest tested `origin/dev`. Review and merge its PR into `dev`, then create the next branch. This keeps subsequent agents on integrated code and makes the prompt travel with every branch. Pre-creating twenty branches would freeze twenty increasingly stale starting points.

The documentation branch `docs/agent-implementation-playbook` introduces this playbook. Review/merge its PR into `dev` before starting W01. Do not build features on top of the documentation branch by default.

1. Select an eligible sequence below. Check dependency evidence and Project 5.
2. Give the agent the launcher below, replacing W01/file with the selected sequence.
3. The agent checks local changes, fetches dev, creates the listed branch safely, implements only that scope, tests, and opens a draft PR into dev.
4. Review the PR and merge when its checks and stated prerequisites are met. Update Project 5 and retain its evidence record.
5. Start the next eligible sequence from refreshed dev. A merged PR proves integration; live feature readiness additionally requires its stated release evidence.

### Copy-paste launcher

```text
Work in knzeng-e/dotify. Execute W01 using
docs/backlog/implementation/W01-dev-quality-gates.md.
Read AGENTS.md and docs/backlog/implementation/common.md first.
Inspect the current working tree, latest origin/dev, dependencies, and related
issues/PRs. Create the branch named in the sequence from the latest tested dev
without disturbing unrelated work. Implement only this sequence, run meaningful
checks, write its evidence/handoff record, and prepare a draft PR targeting dev.
Reconcile already-delivered work rather than rebuilding it. Do not merge,
deploy, send messages, or spend funds unless separately authorized in this
session. If a required capability is unavailable, complete the safe local work
and report the precise remaining gate. Do not start the next sequence.
```

The full content of any sequence file can also be pasted directly. It instructs the agent to read the common contract, so the repository must be available. No separate hidden conversation context is required.

## Fastest sensible delivery order

Start with **W01**. Then prioritize **W08 (first sound)** and **W09 (room reliability)** to get real listening feedback early. W02–W07 harden the specific trust boundaries; W10 establishes the responsive interface; W11 proves Product DevNet; W12 connects artist publication and transparent support. Finish with **W13**, the release and pilot gate. These IDs identify scopes, not a mandatory numeric queue.

Suggested solo order: **W01 → W08 → W09 → W02 → W03 → W04 → W05 → W06 → W07 → W10 → W11 → W12 → W13**. If an outcome already works on current dev, verify and record it; do not manufacture a rewrite or empty feature PR. W02 may use two linked implementation slices if upload authorization and durable revocation need separate migrations.

For independently staffed work, W08, W02, W04, W06, and W10 can start after W01. Coordinate shared-file edits: W02/W03/W07 touch API trust boundaries; W04/W05/W12 touch access/royalties; W06/W11 touch identity; W10/W14 touch discovery styles. Use separate worktrees and merge shared interfaces first. Do not run multiple agents in one working tree. Parallel staffing is optional, not assumed by these prompts.

The first pilot includes responsive discovery, reliable rooms, an honest artist/support flow, and Product Desktop/Web evidence. Product iOS can only be listed as supported through a tested continuation path until its media capability exists. Missing Product evidence must remain an explicit block on the Product claim; it cannot be quietly waived because web tests pass.

**W14/W15** add the immersive galaxy and measured musical activity. A prototype can begin after W09/W10 without delaying W13. **W16/W17** investigate and implement only proven CASH/personhood paths. **W18/W19** add privacy-preserving nearby discovery later. **W20** chooses cultural/sovereignty expansion from actual pilot learning. None of W14–W20 is a prerequisite for the first pilot.

## Sequences and branches

| Prompt | Outcome | Branch created when work starts | Dependencies |
| --- | --- | --- | --- |
| [W01](W01-dev-quality-gates.md) | Make dev a tested integration branch | `chore/dev-quality-gates` | — |
| [W02](W02-upload-session-boundaries.md) | Protect upload resources and session revocation | `feat/upload-session-boundaries` | W01 |
| [W03](W03-canonical-release-access.md) | Bind key delivery to the canonical release | `feat/canonical-release-access` | W02 |
| [W04](W04-access-promise.md) | Make purchased access and ownership claims truthful | `fix/access-promise` | W01 |
| [W05](W05-royalty-failure-isolation.md) | Prevent one royalty recipient from blocking everyone | `feat/royalty-failure-isolation` | W04 |
| [W06](W06-returning-identity.md) | Make returning accounts and wallet-later UX safe | `feat/returning-identity` | W01 |
| [W07](W07-key-custody-recovery.md) | Version content keys and rehearse recovery | `feat/key-custody-recovery` | W03 |
| [W08](W08-first-sound.md) | Make artwork and first sound dependable | `feat/first-sound` | W01 |
| [W09](W09-room-resilience.md) | Keep shared listening alive across real networks | `feat/room-resilience` | W08 |
| [W10](W10-adaptive-design.md) | Establish the responsive musical identity | `feat/adaptive-design` | W01 |
| [W11](W11-product-devnet-journey.md) | Prove the Product DevNet user journey | `feat/product-devnet-journey` | W03, W04, W06, W05 |
| [W12](W12-artist-support-experience.md) | Make artist publication and support understandable | `feat/artist-support-experience` | W02, W04, W05, W10, W11 |
| [W13](W13-pilot-release.md) | Ship and evaluate the first coherent pilot | `feat/pilot-release` | W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12 |
| [W14](W14-room-galaxy.md) | Build an optional immersive 3D room galaxy | `feat/room-galaxy` | W09, W10 |
| [W15](W15-live-musical-presence.md) | Make the galaxy respond honestly to music | `feat/live-musical-presence` | W14 |
| [W16](W16-product-cash-settlement.md) | Prove a real Product CASH settlement path | `feat/product-cash-settlement` | W05, W11 |
| [W17](W17-human-free-evidence.md) | Bind Human free access to real private personhood | `feat/human-free-evidence` | W03, W11 |
| [W18](W18-nearby-privacy-design.md) | Design nearby discovery with explicit privacy boundaries | `docs/nearby-privacy-design` | W09, W10 |
| [W19](W19-nearby-rooms.md) | Implement opt-in nearby room discovery | `feat/nearby-rooms` | W13, W18 |
| [W20](W20-community-sovereignty.md) | Choose the next community and sovereignty increment | `docs/community-sovereignty` | W13 |

`sequence.json` records these dependencies for inspection. It intentionally contains no workflow status. For pilot outcome gates, use W13 rather than treating every proposed enhancement as mandatory. Research sequences can finish with an evidenced unsupported result; this never means the corresponding feature shipped.

## Relationship to the existing backlog

These are detailed execution recipes for the current backlog, not a competing sprint board. Existing scopes remain linked: #85 Product, #87 artwork, #88 audio startup, #89 room reliability, #90 wallet-later UX, #12 personhood, #13 cultural propagation. Reuse those tickets where appropriate. At activation, create a narrow issue only for genuinely new scope, add its local Markdown path to `docs/backlog/backlog.json`, and associate it with Project 5. For an epic, create a scoped child ticket if needed and use `Refs`, not an accidental closing keyword.

The playbook preparation itself has a separate backlog item. Future sequence branches are not created in advance. `common.md` defines the execution contract; `evidence-template.md` defines handoff evidence.

## What to measure

The pilot must show real first sound, successful guest joins, recovery, successful support and understood value flows. Record device/host versions, sample counts, failures, and exact builds. W08/W13/W14 define proposed performance targets, which are goals rather than current measured claims. Mocked contract calls and synthetic audio cannot stand in for real settlement or real-device playback.

Keep the first feedback loop small. When a measured result contradicts the plan, fix the observed problem and update the next prompt. The roadmap should serve the room, not become another room people get trapped in.
