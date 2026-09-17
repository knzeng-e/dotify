# W25 — Make the artist workspace plain and truthful

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W25** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan.

- Branch: `fix/artist-workspace-language` created from the latest tested `origin/dev` when work starts.
- Dependencies: W04, W12.
- Release stage: Pilot polish.
- Existing issue: #180. Related: #156 (W12 acceptance), #143 (W04), #169 (badge/handle removal precedent), premium review PR 6.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A musician without blockchain knowledge can register, publish and read the studio, and every claim the studio makes is true.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (findings UX-30 to UX-36)
- `docs/design/clear-musical-interface-2026-09-15.md` (badge and handle decision)
- `docs/backlog/implementation/evidence/W12.md`
- `docs/explanation/royalty-settlement.md`
- `docs/explanation/access-control-model.md`
- `web/src/views/artist/ArtistOnboarding.tsx`
- `web/src/views/artist/ArtistConsole.tsx`
- `web/src/views/artist/OverviewTab.tsx`
- `web/src/views/artist/NewReleaseTab.tsx`
- `web/src/features/artist-studio/releaseForm.ts`
- `web/src/components/TransactionModal.tsx`
- `web/src/App.tsx`, `web/src/views/ListenerShell.tsx` (default artist name)

## Work sequence

1. Record before captures of onboarding, each publish step, the confirmation dialog, and the console at 390 and 1440 px using the artist-publish fixtures.
2. Remove unverifiable studio claims: the verified badge, the generated handle, and durability statements that the current storage/indexer architecture cannot guarantee. State Free, Verified humans and priced access accurately.
3. Fix the run-on sovereignty list and any similar inline label/description pairs.
4. Make the primary vocabulary musical (release, listeners, support, your share); move runtime, registry, manifest, archive and address details behind an on-demand technical disclosure or the Advanced tab.
5. Show each pre-publication fact once in the flow, with a compact review and a confirmation that points back to it. Keep publication incomplete until catalog read-back succeeds.
6. Onboarding: no fake default artist name; steps first, with consent placed where it is decided and explained in one short paragraph; themed checkbox; say why the create action is disabled.
7. When all value goes to the artist, say so (for example `You receive 100%`); pluralize recipients correctly; keep split validation unchanged.
8. On mobile, replace the first-screen zero metric cards with a single next step for a new artist, make the tab strip scroll affordance visible, and keep one publish action.

## Acceptance and meaningful verification

- All `artist-publish` e2e scenarios pass (happy, missing-wallet, network-mismatch, upload-failure, transaction-failure, transaction-timeout, catalog-delay, catalog-hash-collision).
- No verified badge, handle, or durability claim without a verifiable source; wording checked against the explanation docs above.
- A newcomer can find who controls the release and where value goes without technical vocabulary (W12 acceptance).
- Captures before/after at 390 and 1440 px in the evidence file.

Run the relevant command groups in common.md. Record commands, results, actual tested commit, and untested environments.

## Scope boundary

No change to uploads, encryption, contracts, split validation, consent meaning, or the catalog read-back publication boundary.

## Release condition

Recommended before inviting pilot artists in W13.

## Handoff

Write `docs/backlog/implementation/evidence/W25.md` using `evidence-template.md`. Include the base SHA, implementation SHA, PR, captures, known risks, and the next sequence. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step.
