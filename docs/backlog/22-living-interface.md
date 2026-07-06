# 22 - Living Interface: the room replaces the dashboard

## Sprint

Design track - presentational only, parallel to the spine.

## Priority

P2

## Objective

Move the interface from "disciplined dashboard" (hairline-bordered cases,
console corners) to "inhabited room": separation through light and tonal
layering instead of borders, relaxed geometry, deep-glass floating layers,
conversational chat bubbles, and one shared breathing curve for motion.
Full rationale in `docs/design/dotify-living-interface.md`.

## Context

The Living Light track (tickets 13-20) gave Dotify its aura engine and calm
console. A review of the result found 81 hairline-bordered boxes and 4-8px
corners: functional, but it reads as a control panel, not a listening room.
The philosophy ("music as a living common", invisible infrastructure) argues
for a room you inhabit. This ticket is the presentation-layer answer.

## Delivered design

One scoped CSS block appended to `web/src/styles.css` ("LIVING INTERFACE"),
plus the design doc. Five gestures:

1. Light replaces the line: panel borders go transparent; surfaces separate
   via `--surface-lit`/`--surface-deep` gradients tinted by the playing
   track's aura (`color-mix` on `--aura-a/b/accent`).
2. Geometry relaxes: radius tokens retuned 12-22px; grid gaps and panel
   padding open up.
3. Floating layers become deep glass: topbar dissolves to a scrim, player
   dock becomes an aura-tinted glass capsule, modals become deep translucent
   slabs, bottom nav loses its rule.
4. Chat becomes a conversation: asymmetric bubbles, self messages
   aura-tinted right-aligned; the request queue stays a curated list with
   the host veto quiet until hover/focus (rules dormant until the queue PR
   merges).
5. Motion breathes: one easing (`--ease-soft`), two tempos (160/420ms),
   staggered rise on view open, all disabled under prefers-reduced-motion.

## Constraints

- Purely presentational: no markup, behavior, copy, or test changes.
- Identity preserved: palette, Hanken Grotesk, aura engine, product language.
- Honesty rule intact: every lit pixel maps to real state.
- Borders remain where the design system allows them (inputs, dividers,
  pills).
- No `!important`; cascade order carries the layer.

## Acceptance criteria

- Major surfaces (panels, cards, modals, dock, nav) render without hairline
  frames and separate through tonal layering.
- The playing track's aura visibly tints surfaces, dock, and self chat
  bubbles.
- Chat renders as bubbles with self/other asymmetry.
- Motion honors `prefers-reduced-motion`.
- `lint`, `build`, `test:unit`, `fmt:check` stay green (no behavior change).

## Non-goals

- Restyling `docs/index.html` (identity unchanged, so no drift).
- Component/markup refactors, new views, or new interactions.
- Aura-tinted focus ring, Constellation restyle, quiet mode (listed as
  future work in the design doc).
