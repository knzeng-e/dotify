# 13 - Living Light design foundation

## Sprint
Design track - Living Light experience (presentational, parallelizable with the spine)

## Priority
P1 (UX), non-blocking for the production spine

## Status
Delivered on `main`. This doc records what landed.

## Objective
Bring the "Living Light" art direction (see `design/Dotify-design/Dotify - Redesign Brief.html`) into the React/Vite app: the track playing now lights the whole room, web3 is felt as trust, and the surface is warm humanist glass. Behavior is preserved; the aura is pure presentation (one CSS-var write on track select).

## Delivered

- Album-aura engine. `web/src/utils/aura.ts` derives a stable `{a, b, accent}` aura from a deterministic hue hash per track; `applyAura` writes `--aura-a/-b/-accent/-hue` onto `:root`. `web/src/App.tsx` re-applies the aura whenever the active track (or viewed artist) changes.
- Aura background. `web/src/components/AuraBackground.tsx` renders the CSS `.aura-bg` drifting halos + `.grain`, replacing the old node/warp canvas (`AmbientCanvas` is no longer rendered).
- Locked direction. `aurora` ambient + `lights-down` body classes applied globally (matches the designer's locked Tweaks).
- Presence. `web/src/components/Presence.tsx` (`Avatar`, `AvatarStack`, `roomPresenceNames`) renders photo-style, per-person hued portraits; used on home room cards, the room cluster, public profile live rooms, and the rooms list.
- Player dock. `web/src/components/PlayerDock.tsx` is a persistent "now playing / resume" bar on discovery and rooms.
- Immersive room presence. `web/src/views/PlayerView.tsx` gained an aura cover-glow (breathes on play), a presence cluster with live EQ bars and host marking, and a local reactions bar.
- Hanken-only app type. `web/index.html` loads Hanken Grotesk only; code-like surfaces use system mono and numeric stats use tabular numerals without switching into a decorative mono face.
- Aura cover fallback. Generated fallback cover images now use the track aura instead of a static blue SVG.
- Living Light stylesheet. `web/src/styles.css` carries the aura/grain/ambient/lights-down system, presence avatars, dock, and immersive-room styles.

## Completed polish

- Retire unused type families. Delivered on `main`; app and public docs load Hanken Grotesk, with system mono reserved for code-like content.
- Featured aura hero on Home. Delivered on `main` via `ListenView`'s live/featured hero surface.
- Generated aura Cover. Delivered on `main`; `coverImage()` in `useCatalog.ts` derives the fallback palette from the same aura engine used by the room and page background.
- Remove dead canvas. Delivered on `main`; `AmbientCanvas.tsx` and `StarfieldCanvas.tsx` are no longer present.

## Constraints

- No behavior change. Aura/presence are presentation only.
- Straight ASCII quotes only; never em/en-dashes in source or copy (use a hyphen).
- Respect `prefers-reduced-motion` (already guarded).
- Keep base floor + vignette so aura never drowns text contrast (a brief-listed UX risk).

## Acceptance criteria

- No unused font families load; no price/access number renders in a mono face.
- Home opens with a featured aura tile, then Happening now, then Discover.
- `tsc -b`, lint, and `vite build` stay green (Node 18+ required by Vite 6 / ESLint 9).

## Non-goals

- Presence variants (orb / initials) and live Tweaks panel: the locked direction is photo + aurora + lights-down + green; variants are out of scope unless exposed as a real user setting later.

## Senior-engineer notes
The aura is the soul of this redesign and it is in. The rest of this ticket is housekeeping. Do not regress the "music lights the room" feel while cleaning up.
