# Dotify Constellation - UX/UI direction

Design direction for the next visual chapter of Dotify, extending the delivered
Living Light track (backlog 13-17). Living Light gave every work its own light
(the aura engine in `web/src/shared/utils/aura.ts` derives a deterministic hue
per track and paints the whole field via `applyAura`). Constellation pushes that
system to its conclusion: Dotify as a night sky where works and people are
points of light, and listening together is visibly gathering around one.

This document is the source of truth for the Constellation phases. The build
work is tracked in `docs/backlog/19-constellation-design-track.md`.

## Naming and metaphor

- A **dot** is a work: a sphere of light colored by its aura. Polkadot, Dotify,
  dotification: the vocabulary was already there.
- A **constellation** is a room: human dots (real presences) orbiting a musical
  dot (the host's current track).
- The **sky** is the catalog and rooms field: calm, deep navy
  (`--color-background: #050D1A`), where light only appears when something true
  happens.

Explicit anti-goal: a decorative spinning galaxy backdrop. That is the generic
crypto aesthetic `CLAUDE.md` forbids. A constellation is the opposite of a
galaxy backdrop: every visible point maps to real data.

## Three principles

1. **Light is presence, never decoration.** A dot glows only because something
   real is happening: a track plays, a human is connected, a payment settled.
   This is the visual translation of the design-track honesty rule (no UI
   element may imply a capability the backend does not have).
2. **One hero moment per surface.** Each view gets exactly one signature
   effect; everything else stays Light Console: sober, typographic, surfaces
   over borders. Two hero effects on screen at once is a bug.
3. **Darkness is the stage floor.** `lights-down` is not a dark mode, it is a
   theater. What matters is lit; everything else recedes.

## Surface specifications

### A. Listen / Home: "The Stage"

The catalog becomes a stage rail: covers arranged on a shallow arc, tilted
toward the center like works facing an audience.

- **The lamp**: on hover, keyboard focus, or tap, a cone of light descends on
  that track. The cone's color IS the track's aura (`--aura`-style variables
  fed by `auraForTrack`). The rest of the rail dims to roughly 40 percent.
  Exactly one track is on stage at a time. Inspiration: the Aceternity lamp
  component, reinterpreted with per-track aura color instead of a fixed hue.
- **The glare**: reserved for the unlocked state. A holographic sweep crosses
  the cover on hover only when the wallet actually has access (the real
  `catalogAccessByTrackId` map). A locked card never glares: it shows a calm
  aura outline and its DOT price. Inspiration: glare-card, demoted from
  decoration to meaning.
- **The arc**: a horizontally scrollable rail where each card's elevation,
  tilt, and scale derive from its distance to the rail center. Inspiration:
  circular-gallery, flattened to a stage arc so it stays readable and
  scrollable on trackpad and touch.
- The existing hero (live room feature) stays the opening act; the stage rail
  is the catalog's presentation layer. The dense catalogue grid remains below
  as the library view (it also carries the e2e `track-card` selectors, which
  are load-bearing).

### B. Rooms: "The Sky of rooms"

- Each open room is a **dot-sphere** in the navy sky: the core is the current
  track's cover, the halo is its aura, and the halo pulses only when playback
  is actually live (same real signal as the existing sound bars, no fabricated
  waveform).
- Listeners are **light petals orbiting** the sphere: one petal per genuinely
  connected presence (`listenerCount` is honest today; keep it that way).
  A room of 12 reads as more alive than a room of 2 without printing a number.
  Inspiration: digital-petals-shader, constrained to real presence data.
- **Joining a room = entering its halo.** On click the sphere grows and its
  aura floods the screen (this is what `applyAura` already does), landing in
  the immersive player. The transition tells the product story: you step into
  someone's light.
- Rooms with no playback are embers: small, dark, present but unlit. The
  manual room-code field stays, sober, always reachable.
- Filaments between spheres (cultural propagation made visible) are explicitly
  deferred until the ambassador model (ticket 12) gives them real data.
- Mobile and reduced-motion fallback: a card grid with static halos. The sky is
  an enhancement, never the only path.

### C. Player / Room: "The Theater"

- Full lights-down: app chrome drops to minimal opacity; cover and aura own the
  screen.
- Reactions rise as **aura-tinted petals** from the cover (the room-reactions
  mechanic exists; the emoji rides inside the petal).
- The honest 42 percent preview gets a visual language: as the cutoff nears,
  the lamp visibly narrows on the cover, and the unlock CTA appears inside the
  remaining cone. Partial access reads as partial light.

### D. Artist studio: "Into orbit"

- The artist's aura avatar becomes a central dot; releases are its satellites.
- Publishing plays one short, unique animation: the new work's dot leaves the
  workbench and takes its orbit, with the content hash inscribed beneath it.
  Sovereignty made visible: the work enters the artist's own sky, not a
  platform's.
- Royalties: each real payment is a petal joining the artist's dot. The exact,
  Blockscout-verifiable table remains the record; the petal is only the echo.

### E. Micro-moments: one loading vocabulary

One vocabulary declined everywhere, instead of a zoo of loaders:

- **Dot birth**: scattered particles converge into a sphere that lights up.
  Used for catalog load, runtime resolution, IPFS upload. Three sizes (inline,
  panel, full screen), one implementation.
- **The unlock ritual**: on wallet signature then key delivery, a ring of light
  travels the track's dot and its halo goes from outline to full. Paying an
  artist is the product's most important moment; it gets the most care.
- Rejected: permanent animated pattern backgrounds (pattern-cloud style). They
  violate the one-hero rule; their DNA (organized point fields) is already
  covered by the Sky of rooms.

## Motion grammar

- Micro-interactions: 150-220 ms. Scene transitions: 400-600 ms.
- One signature easing everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`.
- At most one WebGL canvas per view; unmount it when the view leaves.
- `prefers-reduced-motion`: every effect has a dignified static state (lamp
  becomes an aura highlight, orbits become fixed avatars). Non-negotiable.
- Budget: 60 fps on a mid laptop; graceful degradation on mobile.

## Technical constraints (these decide, not taste)

- **The Bulletin build is a single-file artifact.** three.js costs roughly
  150 kB gzipped more than needed. Use OGL (about 15 kB, the base of the
  circular-gallery reference) or bare-canvas shaders, lazy-loaded outside the
  critical bundle, with a CSS fallback. Phase A needs no WebGL at all.
- **The aura engine is the single color source.** Shaders and CSS effects read
  the `--aura-*` variables; the 3D inherits the existing system instead of
  inventing a second one.
- **21st.dev components are points of departure, not imports.** Lamp and glare
  patterns adapt as CSS/transition work; gallery and petals get rewritten on
  our stack and our tokens.
- **The 10 Playwright specs are the net.** Effects are purely presentational;
  existing testids (`track-card`, `track-card-open`, player states, room code)
  keep their meaning and uniqueness. Every phase ships with the suite at 10/10.

## Phasing

| Phase | Surface | Content | WebGL |
| --- | --- | --- | --- |
| A | Listen | Stage rail: arc + aura lamp + unlocked glare | none (CSS + rAF) |
| B | Rooms | Sky of rooms: dot-spheres + presence orbits, grid fallback | one lazy OGL canvas |
| C | Cross | Dot-birth loader, unlock ritual, reaction petals, studio orbit | none |

`docs/index.html` (the public page) follows when a phase changes the outward
visual identity, per the GitHub Pages alignment rule.

## Decision filter (from the philosophical north star)

Before shipping any effect, it must pass: does this strengthen shared
listening, does it strengthen artist sovereignty, does it reduce friction, does
it stay honest about security, and does it serve the human relation rather than
technical vanity. An effect that fails one of these is decoration; cut it.
