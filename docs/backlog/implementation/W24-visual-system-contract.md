# W24 — Consolidate the visual system contract

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W24** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record. Do useful authorized work through a reviewable PR; do not stop at a plan.

- Branch: `feat/visual-system-contract` created from the latest tested `origin/dev` when work starts.
- Dependencies: W21, W22, W23, W25 (consolidate after their structural and wording changes).
- Release stage: Pilot polish.
- Existing issue: #179. Related: #151 (W10 tokens), premium review PR 5 (interaction and icon contract).
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

One legible, documented visual system for type, color roles, links, live state and core components, applied without behavior changes.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (findings UX-40 to UX-46)
- `docs/design/premium-experience-review-2026-09-15.md` (visual system to retain)
- `docs/design/dotify-shared-score.md` (Night Console amendment at the top)
- `web/src/styles/tokens.css` and every sheet imported by `web/src/styles/index.css`
- `web/index.html` (font loading)
- `docs/index.html` (public page identity must stay aligned)

## Work sequence

1. Inventory current usage: font sizes, font families, colors outside tokens, link styles, live/online indicators, icon sizes, z-index layers. Record the numbers before changing anything.
2. Define and document a type scale of at most eight steps with a 12 px minimum (justify any exception), one rule for when the editorial serif is used, and tracking that keeps large letters apart. Give monospace a cross-platform stack and use it only where alignment matters.
3. Define color roles: action (cyan), artist/support accent (pink, used sparingly), link style, one live/available indicator, and status colors. Keep the dark Night Console identity; do not reintroduce a flat light theme.
4. Add a font fallback that renders symbol characters used in artist names (for example `☥`, U+2625) correctly; verify in Chromium and WebKit and note what remains unverified on devices.
5. Unify core components named in the audit (checkbox, back navigation, nested cards, status placement relative to actions, play icon fill) and fix the recorded composition misalignments.
6. Migrate declarations to the tokens and delete superseded override rules instead of adding another override sheet. Stylesheet line count must not grow.
7. Update `docs/index.html` only if the public visual identity description changes.

## Acceptance and meaningful verification

- Documented scale, color roles and link style, referenced from the design docs.
- Captures at 360, 390, 768 and 1440 px for Music, player, Rooms, host and guest room, You and artist studio; 200% text; reduced motion; measured contrast of text over the aura in the brightest supported aura.
- No behavior or copy-policy change; unit tests, lint, build, Product build and the full e2e suite pass.
- Before/after CSS statistics in the evidence file.

Run the relevant command groups in common.md. Record commands, results, actual tested commit, and untested environments.

## Scope boundary

No new UI framework or dependency, no behavior change, no token renames without aliases, no light theme.

## Release condition

Not a pilot gate; lands after W21, W22, W23 and W25 to avoid migrating rules those sequences remove.

## Handoff

Write `docs/backlog/implementation/evidence/W24.md` using `evidence-template.md`. Include the base SHA, implementation SHA, PR, captures, CSS statistics, known risks, and the next sequence. Keep Project 5 as the workflow-status source. End with an implementation summary and the exact next step.
