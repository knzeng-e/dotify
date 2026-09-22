# Dotify implementation playbook

Twenty-seven agent-ready work sequences for shipping a trustworthy musical commons on Product DevNet and ordinary web, then expanding discovery. Written 2026-09-05 against dev `bb3e2557215ee8628f4c0e107de6d1e984baaccf` and extended with W27 on 2026-09-22; agents must refresh the source before acting. This is a plan, not a claim that these features or branches already exist.

## Current execution state — 2026-09-22

The sequences are recipes; they are not a second workflow board. GitHub Project
5 owns live status, and each evidence file records the delivered boundary.

| State                            | Sequences                    | Meaning                                                                                                                                                                                                                           |
| -------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivered implementation records | W01-W12, W14, W18, W21-W25   | Their acceptance scope is merged into `dev`. Broader live-device evidence belongs to W13 or to #87, #88, and #89.                                                                                                                 |
| Delivered feasibility record     | W16                          | Product CASH cannot currently authorize Asset Hub access with the evidence exposed by the Product APIs; PAS remains the executable pilot rail.                                                                                    |
| Active release gate              | W13                          | Product CDM validation app `[0, 1, 27]` remains published at CID `bafybeihzx3ck2i2zd5uvsq646uchxd563s27scvic5a2slanqsk6wifgca`; tracked release candidate `[0, 1, 29]` includes the mobile host playback fix but still needs publication, payment/access, room, physical-device, rollback, release-profile, and aggregate pilot evidence. |
| Not activated                    | W15, W17, W19, W20, W26, W27 | Do not start before their dependency and pilot gates are satisfied.                                                                                                                                                               |

W14 is complete as an optional implementation with a full 2D/list fallback;
that does not authorize making 3D the default. W18 is complete as a privacy
design and inert scaffold; it does not authorize collecting location or
starting W19. W21's original card-level policy cue was intentionally refined by
PR #195, so its evidence is a historical design iteration rather than an
instruction to restore the cue.

## The branch workflow

Keep all prompts together on `dev`. Create one short-lived implementation branch when its work starts, from the latest tested `origin/dev`. Review and merge its PR into `dev`, then create the next branch. This keeps subsequent agents on integrated code and makes the prompt travel with every branch. Pre-creating twenty-seven branches would freeze twenty-seven increasingly stale starting points.

The documentation branch `docs/agent-implementation-playbook` introduced this
playbook in merged PR #131. New work starts from the latest tested `dev`, never
from that historical documentation branch.

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

## Historical delivery order and current next gate

The original order started with **W01**, then prioritized **W08 (first sound)**
and **W09 (room reliability)** before the trust, Product, artist, and UX slices.
Those implementation slices are now merged. The current next gate is **W13**:
collect candidate-bound Product/room/device evidence, rehearse rollback, choose
the release profile, and run the consented pilot. These IDs identify scopes,
not a mandatory numeric queue.

Historical solo order: **W01 → W08 → W09 → W02 → W03 → W04 → W05 → W06 → W07 → W10 → W11 → W12 → W13**. Do not replay it. Reconcile already-delivered work and use the remaining W13 evidence gates as the source of truth.

For independently staffed work, W08, W02, W04, W06, and W10 can start after W01. Coordinate shared-file edits: W02/W03/W07 touch API trust boundaries; W04/W05/W12 touch access/royalties; W06/W11 touch identity; W10/W14 touch discovery styles. Use separate worktrees and merge shared interfaces first. Do not run multiple agents in one working tree. Parallel staffing is optional, not assumed by these prompts.

The first pilot includes responsive discovery, reliable rooms, an honest artist/support flow, and Product Desktop/Web evidence. Product iOS can only be listed as supported through a tested continuation path until its media capability exists. Missing Product evidence must remain an explicit block on the Product claim; it cannot be quietly waived because web tests pass.

**W14/W15** add the immersive galaxy and measured musical activity. A prototype can begin after W09/W10 without delaying W13. **W16/W17** investigate and implement only proven CASH/personhood paths. **W18/W19** add privacy-preserving nearby discovery later. **W20** chooses cultural/sovereignty expansion from actual pilot learning. None of W14–W20 is a prerequisite for the first pilot.

**W21–W26** come from the [2026-09-17 UX and visual design audit](../../design/ux-design-audit-2026-09-17.md). Run them in the order **W21 → W22 → W23 → W25 → W24**; W24 consolidates styles after the structural and wording changes. W26 (French) is Later by owner decision. These sequences polish the pilot experience; they do not replace the W13 evidence gates.

**W27** is the post-pilot Celerity realtime sprint. Celerity is the Statement
Store protocol already used by the room-beacon slice. W27 adds a transport
boundary and measured dual operation before moving social or session events;
it preserves Socket.IO for anonymous guests and for every guarantee Celerity
has not yet proven.

## Sequences and branches

| Prompt                                  | Outcome                                                     | Branch created when work starts  | Dependencies                                               |
| --------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| [W01](W01-dev-quality-gates.md)         | Make dev a tested integration branch                        | `chore/dev-quality-gates`        | —                                                          |
| [W02](W02-upload-session-boundaries.md) | Protect upload resources and session revocation             | `feat/upload-session-boundaries` | W01                                                        |
| [W03](W03-canonical-release-access.md)  | Bind key delivery to the canonical release                  | `feat/canonical-release-access`  | W02                                                        |
| [W04](W04-access-promise.md)            | Make purchased access and ownership claims truthful         | `fix/access-promise`             | W01                                                        |
| [W05](W05-royalty-failure-isolation.md) | Prevent one royalty recipient from blocking everyone        | `feat/royalty-failure-isolation` | W04                                                        |
| [W06](W06-returning-identity.md)        | Make returning accounts and wallet-later UX safe            | `feat/returning-identity`        | W01                                                        |
| [W07](W07-key-custody-recovery.md)      | Version content keys and rehearse recovery                  | `feat/key-custody-recovery`      | W03                                                        |
| [W08](W08-first-sound.md)               | Make artwork and first sound dependable                     | `feat/first-sound`               | W01                                                        |
| [W09](W09-room-resilience.md)           | Keep shared listening alive across real networks            | `feat/room-resilience`           | W08                                                        |
| [W10](W10-adaptive-design.md)           | Establish the responsive musical identity                   | `feat/adaptive-design`           | W01                                                        |
| [W11](W11-product-devnet-journey.md)    | Prove the Product DevNet user journey                       | `feat/product-devnet-journey`    | W03, W04, W06, W05                                         |
| [W12](W12-artist-support-experience.md) | Make artist publication and support understandable          | `feat/artist-support-experience` | W02, W04, W05, W10, W11                                    |
| [W13](W13-pilot-release.md)             | Ship and evaluate the first coherent pilot                  | `feat/pilot-release`             | W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12 |
| [W14](W14-room-galaxy.md)               | Build an optional immersive 3D room galaxy                  | `feat/room-galaxy`               | W09, W10                                                   |
| [W15](W15-live-musical-presence.md)     | Make the galaxy respond honestly to music                   | `feat/live-musical-presence`     | W14                                                        |
| [W16](W16-product-cash-settlement.md)   | Prove a real Product CASH settlement path                   | `feat/product-cash-settlement`   | W05, W11                                                   |
| [W17](W17-human-free-evidence.md)       | Bind Human free access to real private personhood           | `feat/human-free-evidence`       | W03, W11                                                   |
| [W18](W18-nearby-privacy-design.md)     | Design nearby discovery with explicit privacy boundaries    | `docs/nearby-privacy-design`     | W09, W10                                                   |
| [W19](W19-nearby-rooms.md)              | Implement opt-in nearby room discovery                      | `feat/nearby-rooms`              | W13, W18                                                   |
| [W20](W20-community-sovereignty.md)     | Choose the next community and sovereignty increment         | `docs/community-sovereignty`     | W13                                                        |
| [W21](W21-first-listening-screen.md)    | Make the first listening screen trustworthy                 | `fix/first-listening-screen`     | W08, W10                                                   |
| [W22](W22-room-hosting-clarity.md)      | Make hosting and joining a room unmistakable                | `fix/room-hosting-clarity`       | W09, W10                                                   |
| [W23](W23-player-support-clarity.md)    | Keep the solo player immersive and the support prompt plain | `fix/player-support-clarity`     | W04, W12                                                   |
| [W24](W24-visual-system-contract.md)    | Consolidate the visual system contract                      | `feat/visual-system-contract`    | W21, W22, W23, W25                                         |
| [W25](W25-artist-workspace-language.md) | Make the artist workspace plain and truthful                | `fix/artist-workspace-language`  | W04, W12                                                   |
| [W26](W26-french-localization.md)       | Offer Dotify in French (Later)                              | `feat/french-localization`       | W13, W24                                                   |
| [W27](W27-celerity-room-realtime.md)    | Prove Product-native room realtime with Celerity            | `feat/celerity-room-realtime`    | W09, W11, W13, merged room-beacon discovery                |

`sequence.json` records these dependencies for inspection. It intentionally contains no workflow status. For pilot outcome gates, use W13 rather than treating every proposed enhancement as mandatory. Research sequences can finish with an evidenced unsupported result; this never means the corresponding feature shipped.

## Relationship to the existing backlog

These are detailed execution recipes for the current backlog, not a competing sprint board. Existing scopes remain linked: #85 Product, #87 artwork, #88 audio startup, #89 room reliability, #90 wallet-later UX, #12 personhood, #13 cultural propagation. Reuse those tickets where appropriate. At activation, create a narrow issue only for genuinely new scope, add its local Markdown path to `docs/backlog/backlog.json`, and associate it with Project 5. For an epic, create a scoped child ticket if needed and use `Refs`, not an accidental closing keyword.

The playbook preparation itself has a separate backlog item. Future sequence branches are not created in advance. `common.md` defines the execution contract; `evidence-template.md` defines handoff evidence.

## What to measure

The pilot must show real first sound, successful guest joins, recovery, successful support and understood value flows. Record device/host versions, sample counts, failures, and exact builds. W08/W13/W14 define proposed performance targets, which are goals rather than current measured claims. Mocked contract calls and synthetic audio cannot stand in for real settlement or real-device playback.

Keep the first feedback loop small. When a measured result contradicts the plan, fix the observed problem and update the next prompt. The roadmap should serve the room, not become another room people get trapped in.
