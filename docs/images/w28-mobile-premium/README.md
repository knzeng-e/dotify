# W28 capture index

Local synthetic fixtures, 2026-09-29. These are not physical-device,
Product-host, real-wallet or audible-output evidence.

- Before: Chromium on preparation commit `f8795fc` (44 images).
- After: Chromium on `56bcc1c`, including final readability corrections.
- WebKit: selected corroborating captures from the same final implementation;
  full automated matrix results are in [W28 evidence](../../backlog/implementation/evidence/W28.md).
- Sizes: 320x568, 390x844, 430x932, 768x1024, 1440x1000.
- Filenames: `<width>-<surface>.jpg`. Full-page images can be taller than the
  viewport; fixed overlays/navigation belong to the original viewport.

| Width | Music                                                           | Solo player                                                       | Room                                                        | Context                                                               |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| 320   | [Before](before/320-music.jpg) / [After](after/320-music.jpg)   | [Before](before/320-player.jpg) / [After](after/320-player.jpg)   | [Host](after/320-host.jpg) / [Guest](after/320-guest.jpg)   | [Queue](after/320-room-queue.jpg) / [Dock](after/320-live-dock.jpg)   |
| 390   | [Before](before/390-music.jpg) / [After](after/390-music.jpg)   | [Before](before/390-player.jpg) / [After](after/390-player.jpg)   | [Host](after/390-host.jpg) / [Guest](after/390-guest.jpg)   | [Queue](after/390-room-queue.jpg) / [Dock](after/390-live-dock.jpg)   |
| 430   | [Before](before/430-music.jpg) / [After](after/430-music.jpg)   | [Before](before/430-player.jpg) / [After](after/430-player.jpg)   | [Host](after/430-host.jpg) / [Guest](after/430-guest.jpg)   | [Queue](after/430-room-queue.jpg) / [Dock](after/430-live-dock.jpg)   |
| 768   | [Before](before/768-music.jpg) / [After](after/768-music.jpg)   | [Before](before/768-player.jpg) / [After](after/768-player.jpg)   | [Host](after/768-host.jpg) / [Guest](after/768-guest.jpg)   | [Queue](after/768-room-queue.jpg) / [Dock](after/768-live-dock.jpg)   |
| 1440  | [Before](before/1440-music.jpg) / [After](after/1440-music.jpg) | [Before](before/1440-player.jpg) / [After](after/1440-player.jpg) | [Host](after/1440-host.jpg) / [Guest](after/1440-guest.jpg) | [Queue](after/1440-room-queue.jpg) / [Dock](after/1440-live-dock.jpg) |

The after directory also includes `artist`, `rooms`, `solo-queue`, `support`,
`keyboard` (up to 768px), and `host-200-text`, `player-200-text`,
`room-200-text`, `support-200-text`. At 200% text, the room intentionally scrolls
so its composer remains reachable; not every control is simultaneously fixed
inside a 320px viewport. Keyboard screenshots simulate visual-viewport geometry,
not a real OS keyboard. Artwork/audio and names come from test fixtures.

To regenerate from `web`:

```sh
W28_CAPTURE_DIR=/tmp/dotify-w28 npm run test:e2e -- e2e/mobile-premium.spec.ts --workers=1
W28_CAPTURE_DIR=/tmp/dotify-w28-webkit npm run test:e2e -- --config playwright.webkit.config.ts --grep 'W28 listening surfaces' --workers=1
```
