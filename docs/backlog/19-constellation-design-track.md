# 19 - Constellation design track

## Sprint

Design track - successor to Living Light (13-17). Parallelizable with the
production spine; must not block or destabilize it.

## Objective

Deliver the Constellation UX direction specified in
`docs/design/dotify-constellation-ux.md`: works and people as points of light
(dots), rooms as constellations of real presence, one hero effect per surface,
honesty rule throughout.

## Phases

- **Phase A - The Stage (Listen)**: stage rail with covers on a shallow arc, an
  aura-colored lamp that lights the hovered/focused track while the rest dims,
  and a holographic glare reserved for genuinely unlocked tracks. CSS +
  requestAnimationFrame only, no WebGL.
- **Phase B - The Sky of rooms (Rooms)**: open rooms as pulsing dot-spheres with
  presence orbits, join-by-entering-the-halo transition, card-grid fallback for
  mobile and reduced motion. One lazy-loaded OGL canvas maximum.
- **Phase C - Micro-moments (cross)**: dot-birth loading vocabulary, unlock
  ritual, aura-tinted reaction petals, studio "into orbit" publish animation.

## Rules

- Honesty rule: every animated pixel maps to real data (playback state, real
  presence counts, actual access grants). No fabricated stats or waveforms.
- One hero effect per surface; `prefers-reduced-motion` gets a dignified static
  state; existing e2e testids keep their meaning and uniqueness.
- Bundle discipline: the Bulletin single-file build stays deployable; WebGL (if
  any) is OGL or bare shaders, lazy-loaded, with CSS fallback.

## Acceptance criteria

- Each phase ships behavior-preserving: `test:unit`, `lint` (0 errors), `build`,
  `fmt:check`, and the full Playwright suite green.
- Reduced-motion and mobile fallbacks exist for every effect.
- `docs/index.html` updated in the same PR when a phase changes the outward
  visual identity (GitHub Pages alignment rule).

## Delivery notes

- Phase A prototyped on branch `design/constellation-phase-a`: new
  `web/src/components/StageRail.tsx` (stage arc + aura lamp + unlocked glare,
  CSS/rAF only, own `stage-*` testids so the load-bearing `track-card`
  selectors stay unique), integrated in `ListenView` between the hero and the
  commons path; Living Light stylesheet extended with a Stage section.
  `docs/index.html` intentionally not updated yet: the public visual identity
  (tokens, palette) is unchanged by the prototype; alignment happens when the
  direction ships product-wide.
