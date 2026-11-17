# Room discovery and system context — 2026-11-05

Refs [#388](https://github.com/knzeng-e/dotify/issues/388). The owner confirms
0.1.74 mobile account/disconnect, room release/artist inspection while listening,
and lock-screen cover/controls on Polkadot app **v0.10.0 (18)**. The original
screenshot shows backward/forward glyphs, not ±10-second labels. The next/previous
native action behavior is not inferred from those glyphs. No new OS/device version
is asserted from that screenshot.

## Client candidate

The room release information action sits next to the title, with a dedicated
44px target and a compact two-row grid sharing title/artist height. The cover is
unobstructed. Initial placement exposed short/zoomed-keyboard geometry regressions;
the grid fixes them without shrinking targets or weakening existing assertions.

One existing Media Session owner receives the same room role/status, observed
presence count and chosen host attribution as the dock. Title and artist remain
unaltered; album carries the textual room context. A separate local 640px PNG
frames the prepared cover and adds a Dotify footer with status/presence. The
original shared orbit/clef geometry drives both the header and canvas; there is
no new logo design, external rendering service or duplicate audio player.

The artwork resolver retains bounded public-image/cache behavior, a five-second
decode limit and cancellation. Ordinary external covers require anonymous CORS
for composition; failure keeps the original native artwork candidates rather
than delaying audio. Generated and IPFS/Host-cached covers use the same resolver.
A changing context replaces metadata; a late/retired result cannot restore it.
Leaving, disconnecting or dismissing follows the existing teardown. Reconnect
shows no stale presence count. No room code, participant roster, wallet identity,
key or audio payload is placed in the footer.

## Native boundary

[W3C Media Session](https://www.w3.org/TR/mediasession/#metadata) exposes metadata,
artwork and actions; the user agent selects the platform UI. Dotify cannot choose
native button glyphs, add arbitrary lock-screen controls/avatars, replace the
Host's app icon, or guarantee live updates while backgrounded. The artwork footer
provides a compact fallback where `album` is omitted. It remains a browser
candidate until matching delivery and physical device readback. Full native room
widgets/Live Activities would need a separately scoped Host implementation.

## Evidence

1,080 unit tests pass; Web build and lint pass (two pre-existing App.tsx hook
warnings). The full targeted Chromium suite passes 45 tests; focused final
geometry/poster checks cover non-overlapping information/tip actions. WebKit
passes all five viewport sizes, three zoomed keyboard cases and actual room
poster/exit handling. Generated outputs are evidence of client artwork bytes.
Browser artwork output is illustrative evidence of transmitted PNG bytes, not a
screenshot of iOS. Existing room guest permissions, discovery continuity and
protected audio retirement remain covered. No storage/service/key/policy change,
musical upload, Product/Web deployment or renewal occurs in this implementation.
