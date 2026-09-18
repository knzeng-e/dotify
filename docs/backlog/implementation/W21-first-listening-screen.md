# W21 — Make the first listening screen trustworthy

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W21** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan.

- Branch: `fix/first-listening-screen` created from the latest tested `origin/dev` when work starts.
- Dependencies: W08, W10.
- Release stage: Pilot polish.
- Existing issue: #176. Related: #87 (cover variants), #90, #170 (amended decision below).
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

A first visit shows recognizable music, honest access cues, and no dead controls on phones and desktop.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (findings UX-01 to UX-06 and the owner decisions)
- `docs/design/catalog-and-host-identity-2026-09-15.md` (#170 touch and price decisions)
- `web/src/components/PlayerDock.tsx`
- `web/src/hooks/usePlayback.ts`
- `web/src/components/CatalogBrowser.tsx`
- `web/src/components/TrackArtworkButton.tsx`
- `web/src/components/CoverImage.tsx`
- `web/src/features/catalog/coverArtwork.ts`
- `web/src/features/access/accessPromise.ts`
- `web/src/views/ArtistProfileView.tsx`

Paths are starting points from the reviewed dev snapshot; locate moved files and inspect current code rather than recreating old modules.

## Work sequence

1. Reproduce the audit at 390 and 1440 CSS px with the live-catalog shape and the e2e fixtures. Record before captures.
2. Remove the dead first-render control: either keep the dock hidden until a person selects music, or make its Play control start the existing selection/access flow. Do not autoplay and do not request a key before an explicit gesture.
3. Keep discovery cards focused on the release artwork, title, and artist. Do not render price, `Free`, or `Verified humans` as persistent card copy. Preserve the access condition in the accessible name, and disclose it in the player/listening options after the listener opens the release. Opening a release still rechecks access.
4. Remove text from generated placeholders and replace late covers without progressive paint over the placeholder (for example reveal on load). Keep the W08 fallback budget; responsive variants stay in #87.
5. Normalize whitespace when displaying titles and names; hide or clearly label directory artists without releases instead of showing a raw address as a name.
6. On the artist profile, make the primary action say what it does (listen to the latest or first playable release) and stop repeating the artist name on that artist's own release cards.

## Acceptance and meaningful verification

- No disabled primary control is visible on first render without an adjacent explanation.
- Access cues match policy for Free, Human free and Classic releases and stay consistent with the player/access gate; a protected release never looks free.
- Placeholders contain no text; covers do not paint partially over placeholders.
- `catalog-browser`, `catalog-journey`, `clear-interface`, `classic-unlock` and `player-presence` e2e specs pass; add focused regressions for the dock, music-first cards, and on-demand access disclosure.
- Screenshots before/after at 390 and 1440 px; 200% text check on Music and artist profile.

Run the relevant command groups in common.md. Record commands, results, actual tested commit, and untested environments.

## Scope boundary

No access-policy change, automatic charge, key request from browsing, cover overlay on touch, responsive image pipeline (#87), or new dependency.

## Release condition

Recommended before inviting pilot listeners; not a W13 gate by itself.

## Handoff

Write `docs/backlog/implementation/evidence/W21.md` using `evidence-template.md`. Include the base SHA, implementation SHA, PR, captures, known risks, and the next sequence. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step.
