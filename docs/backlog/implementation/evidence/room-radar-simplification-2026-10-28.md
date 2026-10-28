# Room previews and radar simplification, 2026-10-28

Owner-requested presentation follow-up to room life (#257) and the #329 restoration. Implemented from
`bd813f7e49183900a5970f665e4f18e74abd674d` without changing discovery or audio.

Room title and optional invitation now lead both hover and touch previews.
A divider separates host, current music, exact presence and visibility. A music
note replaces visible “Now playing”; its text remains available to screen readers.
Escape dismissal, keyboard focus, own-room markers and verified artist seals stay.

The owner retired the optional 3D view: renderer, lazy wrapper, Three.js and its
transitive packages, graphics-only layout, CSS, flag and dedicated tests/config
are removed. Radar and List consume the existing discovery session. Historical
W14/3D evidence is retained; immersive metaverse work is deferred.

## Release reading experience

The owner also requested a simpler release sheet. Price is shown as a coin icon
and the original native amount/symbol, without “to unlock” or a fee sentence.
Free and human-verification access conditions remain explicit. Network fees are
identified as additional in the approval flow; no new platform commission or
currency conversion is introduced.

Artist descriptions use the existing editorial typeface and comfortable line
spacing. Album facts and credits become unboxed text; release type and year are
shown once beside the cover. Listening/support terms and technical provenance
remain available in separate disclosures. The dialog focus loop now includes
native summary controls, preserving keyboard access to those disclosures.

## Evidence

- Production Web build passes, without a Three.js or RoomGalaxyScene chunk.
- 15 focused unit tests pass: exact presence, own-room visibility, live sweep,
  stable 2D layout and Nearby configuration.
- Nearby browser suites pass: 9 Web and 3 Product-adapter cases, including
  discovery, joining, denial/retry, lifecycle, Hide/restore and room identity.
- Desktop hover and 390px mobile sheet screenshots inspected. The room invitation
  precedes host/music, and the touch action remains accessible.
- Release browsing tests pass at 320px, including keyboard disclosure, dismissal,
  focus restoration, no audio/key/payment request and keeping the selected track.
  The full artist-publish/catalog test passes with a rich release sheet at desktop
  and 390px, plus additional-fee disclosure before approval. Both captures inspected.
- Lint passes with two existing App.tsx hook warnings. Build retains unrelated
  large-chunk and stale Browserslist warnings.
- No deployment in this change. Physical Host visual acceptance remains after release.

The owner confirms Product 0.1.65 now starts audio on mobile, with intermittent
buffering pauses. This is partial physical feedback, not uninterrupted-playback
acceptance. Measure startup and rebuffering before changing audio infrastructure.
