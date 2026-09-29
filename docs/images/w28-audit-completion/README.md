# Original mobile audit completion captures

Synthetic local fixtures, 2026-09-29, implementation
`39784e6407bede3f5d69e0ed8e0f7ca65916b203`. These are browser-rendering evidence,
not physical-device, Product-host, real-wallet or audible-output proof.
See the [verification record](../../backlog/implementation/evidence/W28-audit-completion.md).

The listening matrix was regenerated with capture-only test commit `086cd61`:
fixed room workspaces use viewport screenshots, not full-page screenshots that
can resize the browser during capture. The application source is identical to
`39784e6`. Studio examples retain the earlier full-suite capture. Full reporter
summaries below describe the full-suite runs, not the subsequent capture reruns.

[Chromium results](chromium-results.json) preserve per-test outcomes, retries,
duration and the visible-text contrast summary from the final reporter output.
[WebKit results](webkit-results.json) preserve the 20 targeted outcomes.
[Capture reruns](capture-reruns.json) record the five Chromium and five WebKit
journeys after the capture-only correction.

The [original W28 comparison](../w28-mobile-premium/README.md) remains unchanged.
This directory shows the additional complete-audit implementation, not a
replacement or relabeling of those earlier images.

| Width | Music                            | Player                             | Shared room                      | Live dock                           |
| ----- | -------------------------------- | ---------------------------------- | -------------------------------- | ----------------------------------- |
| 320   | [Music](chromium/320-music.jpg)  | [Player](chromium/320-player.jpg)  | [Guest](chromium/320-guest.jpg)  | [Dock](chromium/320-live-dock.jpg)  |
| 390   | [Music](chromium/390-music.jpg)  | [Player](chromium/390-player.jpg)  | [Guest](chromium/390-guest.jpg)  | [Dock](chromium/390-live-dock.jpg)  |
| 430   | [Music](chromium/430-music.jpg)  | [Player](chromium/430-player.jpg)  | [Guest](chromium/430-guest.jpg)  | [Dock](chromium/430-live-dock.jpg)  |
| 768   | [Music](chromium/768-music.jpg)  | [Player](chromium/768-player.jpg)  | [Guest](chromium/768-guest.jpg)  | [Dock](chromium/768-live-dock.jpg)  |
| 1440  | [Music](chromium/1440-music.jpg) | [Player](chromium/1440-player.jpg) | [Guest](chromium/1440-guest.jpg) | [Dock](chromium/1440-live-dock.jpg) |

Each width also has artist, rooms, host, solo-queue, room-queue, support,
host-200-text, room-200-text, player-200-text and support-200-text captures.
Keyboard geometry captures cover widths up to 768. The viewport heights are
568, 844, 932, 1024 and 1000 respectively; full-page images may be taller.

Studio task captures live under `studio`, including 200% text. Selected WebKit
images live under `webkit`. The test suite generates the full matrix; only
representative Studio and WebKit images are committed to bound repository size.

At 200% text, the shortest screens allow vertical scrolling to reach every
control rather than shrinking text or hiding commands. A composer-focused
capture can therefore show the player above the visible viewport. Keyboard
captures simulate viewport geometry, not an OS keyboard. Session names, art,
track records and media are fixtures, not invented production popularity.

To regenerate (from `web`, with Playwright browsers installed):

```sh
W28_CAPTURE_DIR=/tmp/dotify-audit-captures npm run test:e2e -- e2e/mobile-premium.spec.ts --workers=1
npm run test:e2e -- e2e/artist-publish.spec.ts --grep 'artist task navigation' --workers=1
W28_CAPTURE_DIR=/tmp/dotify-audit-webkit npm run test:e2e -- --config playwright.webkit.config.ts --grep 'W28 listening surfaces' --workers=1
```

No deployment, payment or physical observation is performed by these commands.
