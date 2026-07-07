# Dotify Living Interface - the room replaces the dashboard

## Why

Dotify's console design was disciplined but it read as a dashboard: 81
hairline-bordered boxes, 4-8px corners, panels declaring their edges. A
dashboard is a tool you operate. Dotify's philosophy says the opposite: a
listening room is a place you inhabit. The interface should feel like a lit
room where music is the light source, not a control surface with music inside
one of the cases.

This is the same argument as the product's Web3 stance: the infrastructure
(keys, policies, chains) must disappear behind the human experience. Borders
are the UI equivalent of exposed plumbing - they explain structure instead of
letting people feel it.

## The five gestures

1. **Light replaces the line.** Panel borders go transparent. Separation now
   comes from tonal layering (`--surface-lit`, `--surface-deep`) and from the
   aura: every major surface is tinted a few percent by the playing track's
   light (`color-mix` with `--aura-a/b/accent`). The room's color IS the
   structure. Borders remain only where the design system allows them:
   inputs, dividers, pills.

2. **Geometry relaxes.** Radius scale moves from console (4-8px) to human
   (12-22px). Padding and grid gaps open up. Soft curvature and air are what
   distinguish a place from a panel.

3. **Floating layers become deep glass.** The topbar dissolves into a scrim
   gradient; the player dock becomes a floating glass capsule tinted by the
   aura; modals become deep translucent slabs; the bottom nav loses its rule
   line. Nothing is "docked into a frame" anymore - layers hover in the room.

4. **Chat becomes a conversation.** Messages become bubbles (asymmetric
   radius, other people bottom-left-anchored, your own messages aura-tinted
   and right-aligned). The request queue deliberately stays a list - it is a
   curated queue, not a dialogue - but sheds its chrome, and the host's veto
   rests at low opacity until intent (hover/focus) shows.

5. **Motion breathes on one curve.** A single easing (`--ease-soft`,
   cubic-bezier(0.22, 1, 0.36, 1)) and two tempos (160ms interaction, 420ms
   entrance). Views open like a room lighting up: panels rise softly with a
   short stagger. Cards lift on hover. Everything is disabled under
   `prefers-reduced-motion`.

## What deliberately did not change

- **Identity.** Palette (deep blue core, cyan action, restrained pink),
  Hanken Grotesk, the aura engine, and all product language are untouched.
  `docs/index.html` therefore remains aligned with the app theme.
- **Behavior and markup.** The layer is pure CSS appended to `styles.css`.
  No component logic, no props, no copy edits, no test changes.
- **Honesty.** Every lit pixel still maps to real state: the aura is the
  actual playing track, bubbles are real people with their real display
  names, the queue shows only what the room holds. Nothing renders that the
  backend did not produce.
- **Boundaries with borders.** Form fields, code fields, status pills, and
  dividers keep their hairlines - the design system's allowed border uses.

## Implementation

One scoped block at the end of `web/src/styles.css` ("LIVING INTERFACE").
It retunes tokens (`--radius-*`, `--ease-soft`, `--dur-*`, `--shadow-float`,
`--surface-lit/deep`) and restyles the recurring surfaces (`.doc-panel`,
`.catalogue-card`, `.modal-card`, `.topbar`, `.player-dock-inner`,
`.bottom-nav`, `.home-featured`, chat rows). Cascade order does the work: no
`!important`, no selector wars, and the block reads as a single reviewable
design decision.

The `room-req-*` rules are dormant until the collaborative-queue PR merges;
they make the queue land already dressed.

## Future work (not in this slice)

- Aura-tinted focus ring option (focus stays cyan for now: recognizable).
- The Constellation phases (Stage, Sky) restyled on these tokens.
- A "quiet mode" (host-side) that dims all non-essential layers during
  playback - one step further from dashboard toward room.
