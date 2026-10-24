# Scoped 3D galaxy restoration: local evidence

Date: 2026-10-24. Issue #329. Implementation tested locally:
`eef03168c1bbf384bf667bd62148b535ecdc995a`, based on tested `dev`
`f49e017b56d08f4c61c77f3fe3feac434371423c` (merged #328).
No publication or contract change was performed for this evidence.

## Behavior and boundary

The room page now offers Radar / 3D / List. Radar remains the initial view.
The explicit 3D choice lazy-loads its scene and Three.js and receives the same
scoped public discovery cards as the other views. It does not fetch global rooms,
request another location, reconstruct a full room/player object, or request keys.
Inspection, Join, Hide/restore and own-room return retain their existing owner.

The camera centers the initial and keyboard-selected room, with an explicit
navigation control for crowded views. This corrects an intermittent marker
overlap exposed by randomly generated room identifiers during browser testing.
The scene bounds pixel ratio and decorative instances; these are implementation
limits, not hardware performance measurements.

## Checks

| Check | Result and what it establishes |
| --- | --- |
| `npm run test:galaxy` | Four Chromium scenarios plus the separate operational-off scenario pass. Nearby and Worldwide public rooms appear; link-only rooms do not. Common preview, exact presence, Hide/restore and live removal remain usable. |
| Graphics failure and mobile scenario | A 390 px viewport has no horizontal overflow and pixel ratio is capped at 1. Reduced motion, unavailable WebGL, context loss and a failed scene import return to Radar. Context loss restores focus from the removed scene. Walletless joining still works. |
| Host/guest continuity scenario | Switching Radar/List/3D and returning to the host's own room retains the guest's same live `MediaStreamTrack`, does not increase host capture stops, and causes zero guest content-key requests. This is stream continuity evidence, not a physical audibility measurement. |
| `adaptive-rooms.spec.ts` and `room-presence-visual.spec.ts` | Five existing Chromium cases pass: automatic radar, settings and focus, non-WebGL joining, reduced motion, mobile inspection and verified artist identity. |
| `npm run test:unit` | 990 tests in 126 files pass on the final implementation, including updated default/off graphics flags. |
| `npm run build` and `npm run build:product-devnet:frozen` | Final scene and fallback source compile in ordinary Web and Product DevNet profiles. Scene/Three remain separate lazy chunks. |
| `npm run build:bulletin` | Final source builds and self-contained artifact smoke passes. The single-file packaging profile intentionally inlines its dependencies: index 5,892.38 kB, gzip 3,074.50 kB. It does not provide the normal Web/Product network chunk separation. |
| Formatting and lint | Full frontend formatting passes. Full lint reports zero errors and two existing `App.tsx` hook-dependency warnings; final touched scene/picker/test/config lint reports zero findings. |
| Backlog checks | Offline and live manifest checks pass; #329 is assigned and has matching Project 5 scope fields. |

Desktop and mobile synthetic-room screenshots were inspected locally. Test
identities and positions are synthetic. The browser uses software WebGL and fake
audio devices; these results do not certify physical Product graphics or audio.

## Release and remaining acceptance

- No change to Nearby consent, location delivery, public visibility, room
  authorization, contract policies or audio transport is included.
- Physical mobile/Desktop Product graphics, device FPS, thermal/battery behavior
  and long-duration sessions remain unverified. Existing #274, #85, #88, #89 and
  #158 gates remain open.
- Radar is the initial view on every mount. A graphics import failure remains
  unavailable for that page lifetime, while Radar/List stay usable.
- `VITE_DOTIFY_ROOM_GALAXY=off` removes the optional choice on the next build;
  it does not disable ordinary room discovery or joining. The independent
  rollback browser profile is now part of CI.
- Merge and publish this fix before asking users to test the restored view.
  Product 0.1.60 publication traceability (#327) is still a separate open PR;
  the next package must advance beyond the version already published.

## Review follow-up: reduced-motion focus

[Review finding](https://github.com/knzeng-e/dotify/pull/330#discussion_r4367761744)
identified that enabling reduced motion while a scene control was focused could
discard focus before the Radar fallback inspected it. The new browser assertion
failed on the reviewed revision, confirming the regression.

The scene now lets its owner inspect focus before removing the scene DOM; the
reduced-motion stylesheet no longer hides that DOM ahead of the effect. Rendering
resources still dispose during the transition. The browser scenario verifies both
restoration to the Room view picker from a scene control and preservation of
focus on Search settings outside the scene. It also retains the context-loss and
initially reduced-motion cases.

All four 3D scenarios and the independent operational-off scenario pass after the
fix. Touched-file lint/format checks and the Web build pass. These checks extend
the evidence above; they do not add physical-device certification.
