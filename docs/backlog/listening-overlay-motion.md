# Listening overlay continuity

Issue #396 · P2 · Production spine · Next · Work. Refs #392/#388.

The owner accepts 0.1.75 solo Queue/player motion and requests matching Room Up
next/suggestions and release details, plus a refined return to Music. Share the
presentation hook and sheet instead of duplicating gestures. Preserve Dotify's
existing typography, deep blue surfaces, audio ownership and access checks.

Room Queue is a modal launched beside the Chat/People tabs. Chat/People stay
in place; dismissing returns to the underlying panel. The queue stays mounted
but hidden while closed, retaining search/suggestion drafts. Hidden dialogs own
no history, inertness, body scroll lock or focus. Visible sheets retain the same
Dialog history/focus boundary and 200 ms exit, with immediate reduced motion.
Only the handle drags; forms, lists and transport controls remain ordinary.
Choosing Play next dismisses immediately before access-related UI may open.

Release details in player, Room and catalog share the same responsive sheet.
Artwork/metadata inspection does not acquire a guest key or leave a room.
Player collapse uses the same softer curve as opening; previous routing
invalidation remains authoritative. Automatic security/room redirects stay
immediate. Queue suggestions remain intent and only the host curates playback.

Verify real draft retention, Back/Escape/focus restoration, keyboard/safe-area
geometry, reduced motion, rapid navigation races and persistent audio identity.
Physical polish follows a matching rollout. #395 owns the mobile-host silence;
this presentation ticket does not claim to fix it or deploy anything.
