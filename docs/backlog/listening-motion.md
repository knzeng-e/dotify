# Listening navigation and queue motion

Owner-requested mobile refinement from the supplied 67.6-second UX reference
video, reviewed locally on 2026-11-05. The video and notification/reference frames
are not committed. GitHub ticket: #392. P2 · Production spine · Next · Work.

## Scope

Make the existing player and queue feel like a continuous listening surface:
short directional player opening/collapse, shared cover continuity where supported,
and a mobile Queue sheet above the still-playing view. Use Dotify's existing
colors, typography, queue and audio ownership. This is a bounded polish pass,
not new playlists, backend work or a public-pilot readiness claim.

Explicit gestures own animation; automatic access/room redirects keep existing
behavior. Unsupported APIs and reduced motion commit navigation immediately.
Opening/closing sheets retains the existing history lease, focus trap/restore
and background inertness. A pull-down handle may dismiss Queue, while list scroll,
seek bars and forms remain ordinary controls. No gesture submits a transaction,
requests a key, changes a queue order, starts playback or leaves a room.

Verify Chromium/WebKit, rapid reversed navigation, delayed captures superseded by
ordinary tabs/profile/portal navigation and browser Back/Forward, fallback/reduced motion,
Back/Escape/focus and short safe-area layouts. Preserve solo and room audio while
minimizing/reopening. Record exact-Host physical feel after matching rollout;
no deployment or storage/service/policy change belongs to this implementation.

## Delivery checkpoint, 2026-11-05

[Web and Product 0.1.75](implementation/evidence/product-0.1.75-rollout-2026-11-05.md) publish
the merged implementation with exact-source CI and independent artifact/record
readback. #392 remains open for matching physical Polkadot app gesture feel and
continuous audio acceptance. This client delivery activates no conservation writer
or scheduler.
