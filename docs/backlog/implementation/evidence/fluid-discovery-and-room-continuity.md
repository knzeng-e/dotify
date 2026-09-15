# Fluid discovery and room continuity

Reviewed base: `dev` at `6c31170c01d3accc8089f04e38e1701027cd732a`
(PR #167 merged and device-tested by the owner).
Branch: `feat/fluid-discovery-and-room-continuity`.
Partial references: #89 (room reliability), #90 (value before wallet).

## Delivered scope

This is the next bounded pass from the
[premium experience review](../../../design/premium-experience-review-2026-09-15.md):
discovery hierarchy and room arrival, with the reported continuity regressions
addressed before adding more visual changes. Artist/support/account hierarchy,
the broader icon contract and artist onboarding remain separate future slices.

- Music starts with one horizontal catalog on both phone and desktop. The large
  duplicate featured track and repeated philosophy panels are removed. Real room
  cards follow the catalog; zero-count statistics no longer compete for attention.
- Search, row/grid choice, row position, page position and the activated track or
  artist focus survive leaving the catalog. State lives in the mounted listener
  shell only, never local storage, a wallet, analytics or a server. Query or layout
  changes reset the row deliberately. StrictMode effect replay preserves it.
- Rooms puts code/link entry and hosting above discovery. One compact empty state
  replaces the repeated host/join panels. Loading, empty and unavailable remain
  different states; a healthy service no longer adds a technical status pill.
- Logo navigation and "Return to your room" stay within the app. Returning through
  one's own room card bypasses both the name-entry gate and the join protocol.
  An already-joined room is also guarded in the session hook before changing role.
- Keyboard focus alone does not compact the room at full height. Measured keyboard
  occlusion triggers compaction; a smaller closing threshold prevents flipping
  between layouts during intermediate animation frames. Pointer-release guards,
  composer position, player visibility and draft retention remain intact. The
  initial browser inset is excluded from keyboard occlusion, so closing restores
  the resting layout even when browser chrome already reduced the viewport. A
  keyboard-time rotation retains the last known inset, then relearns it once
  editing and keyboard occlusion end.

## Audio diagnosis and implementation

Previously every source change requested a new peer/receiver. This discards the
listener's existing media stream. Merely using `replaceTrack` avoided that reset
but exposed a second native-capture failure: the host kept playing while the
receiver's media clock stopped and the meter retained the previous tone.

The primary capture path now reuses the existing Web Audio element graph and its
`MediaStreamDestination`. The graph already existed as the Safari fallback; it is
now preferred when Web Audio is available. It preserves one audio output track
across source changes. The local monitor gain remains separate from the outgoing
room stream, so host mute remains local. Each source change publishes through the
existing sender, with a new offer only when no sender exists or replacement fails.
This matches the [WebRTC replacement model](https://www.w3.org/TR/webrtc/#dom-rtcrtpsender-replacetrack).
A late asynchronous source fetch also checks the current element/source before
publishing, preventing an obsolete selection from overwriting the new one.

No second player, room protocol, contract, content-key or payment change. Access
failure still stops the outgoing protected source and closes host peers through
the existing gate. The native capture compatibility path remains for browsers
without Web Audio; its cross-track continuity is not validated by this pass.
Normal Chromium and the existing Safari-style fallback use the stable graph.

## Evidence design

The historical room fixture intentionally paused every source on load and its
sync tones were identical. That cannot establish automatic Next behavior. A new
opt-in E2E sequence uses two authorized public tracks with distinct 440/660 Hz
sources and real autoplay. The receiver's frequency, stream identity, offer count,
host role and room code are checked through Next, Previous, Next, Music, the own
room card, the logo and the return control. No microphone, wallet or external
media service is required. Test-only diagnostics attach context, media and peer
state on frequency failure. These fixture flags have no production effect.

With this valid fixture, the old session implementation fails to preserve the
original receiver across a source change. A replacement-only experiment still
failed native element capture while the Web Audio path passed; the stable graph
then passed both standard-browser and no-native-capture scenarios. Early fixture
runs with autoplay suppressed or an inadvertently protected second fixture were
not used as product evidence.

Catalog tests check a usable track action above the dock, restoration of both row
and grid journeys, preserved query/focus and no horizontal page overflow. Arrival
tests check that code, Join and Open a room are reachable above the dock. Keyboard
tests include focus without occlusion, delayed geometry, closing hysteresis,
zoomed/panned viewport, resize, tab taps and draft retention.

## Validation

| Check | Result and scope |
| --- | --- |
| `npm run test:unit` | 450 tests in 59 files passed. |
| `npm run test:e2e -- --workers=2` | 61 Chromium tests passed with CI-style concurrency, including distinct received tones across Next/Previous, room return, catalog and arrival. |
| `npm run test:e2e -- e2e/room-workspace.spec.ts --workers=1` | Final keyboard adjustment: all 17 cases passed, including browser inset and rotation regressions (62 total suite cases now). |
| `npx playwright test --config playwright.webkit.config.ts --workers=1` | 20 WebKit layout/navigation cases passed. This does not emulate a physical iOS keyboard. |
| `npm run fmt:check`, `npm run lint` | Passed; lint retains three existing hook-dependency warnings in `App.tsx` and `ArtistShell.tsx`. |
| `npm run build` | TypeScript and ordinary web production build passed; existing chunk-size warnings. |
| `npx vite build --config vite.product.config.ts --mode product-devnet` | Product bundle built from the checked-in bootstrap, without regeneration or deployment; existing chunk-size warnings. |

Visually inspected Chromium mobile and desktop captures (synthetic catalog art):
[Music, phone](../../../images/fluid-discovery/discovery-390.jpg),
[Music, desktop](../../../images/fluid-discovery/discovery-1440.jpg),
[Rooms, phone](../../../images/fluid-discovery/room-arrival-390.jpg),
[Rooms, desktop](../../../images/fluid-discovery/room-arrival-1440.jpg).
The mobile arrival check additionally asserts a usable input width, rather than
only checking that a severely compressed field is technically visible.

The first CI run found two test assumptions about the shared signaling server:
selecting the first room could target a concurrent host, and comparing scroll
before Playwright's final click positioning was not the departure position. The
continuity test now names/selects its own host; journey restoration compares the
activation position clamped to the current document range. Arrival tests make no
empty-server assumption. Audio frequency and stream-identity assertions remain
unchanged. The subsequent local full run passed with two workers.

PR review also identified losing the browser inset on keyboard-time rotation.
The final regression checks rotation, dismissal, draft/navigation restoration and
reopening with the new resting inset. It passes on Chromium and WebKit.

No physical iPhone, native Product host, TURN-only network, background/lock-screen
or assistive-technology certification is claimed. The stable graph introduces no
new dependency, but desktop host CPU/battery impact has not been benchmarked.
Physical acceptance should combine actual audible output, Next/Previous, pause,
room return, keyboard opening/closing, rotation and background/resume. A live
connection badge alone is not proof of sound.

## Review and delivery boundaries

1. Room continuity and keyboard: `useSession`, `useRoomViewport`, `TopBar`,
   listener navigation and the real audio/keyboard specs.
2. Discovery and arrival: `CatalogBrowser`, `ListenView`, `RoomsView`, shell-owned
   journey state, `discovery-focus.css` and the navigation/arrival specs.

These are separate review units in one coherent change. No queue, nearby feature,
new analytics or community memory was added. The next eligible design slice is
artist/release/support hierarchy, retaining the distinction between payment proof
and playable access. This pass does not close either epic.
