# Restore the scoped 3D room galaxy

Issue #329. Priority P1; Track Room reliability; Phase Now; Type Work.
Owner-requested correction, started 2026-10-23 after merged #328.

## Outcome

Rooms offers Radar / 3D / List through one compact native picker. Radar is the
initial view; 3D is an explicit presentation choice in normal Web/Product builds.
The graphics renderer consumes the same public, scoped Nearby/Worldwide results
as the radar, with the same common inspection, Join, Hide/restore and own-room
return. It has no independent global-room lookup, account or location request.

## Boundaries and acceptance

- Never reconstruct full room/player/track authority from a discovery card or
  expose link-only rooms through the graphics path. Precise coordinates, protected
  source references and keys stay outside the renderer.
- Lazy-load the scene/Three.js only after choosing 3D. The scene and GPU resources
  unmount when leaving 3D; mounted audio and discovery subscriptions stay intact.
- Support keyboard/touch, current room/artist identity, exact session counts,
  announced-artist/own-room cues and live Hide/expiry/removal. Public distances
  remain approximate and layout is illustrative, not a map.
- Reuse the shared preview for host/current artist/presence details and Join;
  graphics never invent playback state or bypass full/reconnecting room gates.
- Reduced motion, absent graphics, import failure or context loss returns to Radar
  with a brief explanation; restore focus when it was inside the removed scene.
- Cap pixel ratio (1 on compact screens, 1.5 otherwise), compact rendering near
  30 fps, bound growth, instance at most 128 decorative points per room, and stop
  drawing while hidden. These bounds are not measured hardware performance claims.
- `VITE_DOTIFY_ROOM_GALAXY` defaults available (unset or `on`); `off` or an invalid
  value removes the optional choice on the next build. No URL/storage bypass,
  no automatic 3D launch and no new Host permissions.

## Verification and release

Exercise scoped public/private room discovery, common preview/Hide/removal,
mobile/keyboard/context loss/reduced motion, and host graphics changes while a
walletless guest retains the same live media track. Check Web/Product build
chunking and independent operational-off behavior. Physical Host graphics,
long-duration mobile energy/thermal behavior and hardware FPS remain acceptance
limits, separate from #274 location and #85/#89/#158 native/media/pilot gates.
No deployment, contract change or participant contact is part of this fix.

[Local verification, 2026-10-24](implementation/evidence/room-galaxy-restoration-2026-10-24.md)
records browser, build, rollback and continuity results and the remaining physical
device limits.
