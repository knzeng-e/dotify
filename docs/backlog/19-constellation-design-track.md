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
- Phase B prototyped on branch `design/constellation-phase-b`: new
  `web/src/components/SkyOfRooms.tsx`, rendered in `RoomsView` above the
  existing board when rooms exist. Each open room is a dot-sphere (cover core,
  real-aura halo) laid out on a deterministic golden-angle spiral with
  roomId-hashed jitter; the halo pulses only when `playerState.playing` is
  genuinely true; one petal orbits per real presence (visual cap 10, true
  count always printed); rooms with no track are embers; `playbackMode:
  'preview'` shows an honest tag. Joining is entering the halo: the sphere
  grows and floods for 420 ms before `onJoinRoom` fires (immediately under
  reduced motion). DOM + CSS only, no OGL: at realistic room counts the
  dependency was not justified (decision recorded in the design doc); the sky
  is hidden on mobile and reduced motion where the card grid below remains the
  complete experience. Verified with the full gate (72 unit, 10/10 e2e) plus
  live two-page screenshots (host room + viewer sky, hover and join-flood).
