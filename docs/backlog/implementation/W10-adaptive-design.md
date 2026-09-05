# W10 — Establish the responsive musical identity

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W10** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan. If this is a research sequence, its decision record and runnable feasibility checks are the deliverable.

- Branch: `feat/adaptive-design` created from the latest tested `origin/dev` when work starts.
- Dependencies: W01.
- Release stage: Pilot.
- Existing issue: No dedicated issue assigned yet; reuse a matching open issue or create a scoped ticket when this sequence starts.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

Dotify feels deliberate and inviting on phones, desktop browsers, and Product hosts while keeping the same interaction language.

## Read first

- `web/src/styles/base.css`
- `web/src/styles`
- `web/src/components/SkyOfRooms.tsx`
- `web/src/components/PlayerDock.tsx`
- `web/src/components/PrimaryNav.tsx`
- `docs/index.html`
- `docs/presentation/dotify-showcase-2026.pdf`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules. Read the matching current issue and earlier dependency evidence.

## Work sequence

1. Audit current styles and the showcase before adding tokens. Keep the useful deep-blue/cyan/Polkadot-pink identity, artwork, and editorial typography; avoid an unrelated generic crypto redesign.
2. Define shared color, type, spacing, focus, motion, and surface tokens. Apply a small vertical slice: discover a room, inspect it, join, and retain playback controls. Use bottom sheets/touch on narrow screens and room details beside discovery on wide screens.
3. Handle safe areas, virtual keyboards, landscape, zoom, long titles, empty rooms, loading, error, and reconnect states. Make controls readable without depending on colour or motion.
4. Preserve the existing 2D sky/list as the usable baseline and create an explicit renderer boundary for later 3D. Do not add a graphics library in this sequence. Update the public page narrative and responsive identity.

## Acceptance and meaningful verification

- Capture actual screenshots at representative 360, 390, 768, and 1440 CSS-pixel widths; verify keyboard focus, 200% zoom, reduced motion, and touch targets.
- Run the guest-join/playback regression suite and inspect a supported Product host.
- No fabricated room counts, broadcast chat, music activity, or persisted preferences.

Run the relevant command groups in common.md and add focused regression coverage for the changed risk. Record commands, results, actual tested commit, and untested environments. A checklist with no evidence does not satisfy these criteria.

## Scope boundary

No full application rewrite, native app packaging, new payment policy, or ornamental onboarding obstacle.

## Release condition

A coherent responsive core is required for pilot. Shared tokens can land early while reliability work proceeds on separate scopes.

## Handoff

Write `docs/backlog/implementation/evidence/W10.md` using `evidence-template.md`. Include the initial base SHA, implementation SHA, PR, artifacts, operational changes, known risks, and the next eligible sequences. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step; do not start another sequence automatically.
