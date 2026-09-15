# W10 follow-up — keyboard transition

- Base: `ee695caeaf18f4ce52f5ea71f48b8204d909162b` (`origin/dev`, PR #170 merged).
- Branch: `fix/room-keyboard-transition`; Refs #151 (physical Product-host acceptance remains).
- Design and device check: [room keyboard transitions](../../../design/room-keyboard-transition-2026-09-15.md).
- No deployment or contract change; no new config or permission.

Validation on the implementation diff:

| Check | Result |
| --- | --- |
| Unit suite | 458 passed / 59 files |
| Room browser suite | 18 scenarios verified: 15 passed on the implementation; the three restoration tests passed after repairing their invalid simulated `innerHeight` cleanup. The new transition scenario was rerun in that final four-test subset. |
| WebKit suite | 31 passed, including all keyboard cases and catalog/desktop/mobile regressions |
| Lint / formatting | Passed; 3 existing hook dependency warnings |
| Web build + Product DevNet Vite build | Passed; inherited chunk-size / dependency bundling warnings. No live bootstrap regeneration. |
| Production environment smoke | Passed |
| Offline backlog check / diff whitespace | Passed; existing offline mapping warnings |

The old simulation deleted Window's own `innerHeight` accessor even when it had
not overridden it. It now restores 844px; invalid measurements intentionally no
longer drive a layout change in production.

Screenshots inspected: [simulated keyboard](../../../design/assets/keyboard-transition/keyboard-chat.jpg)
and [desktop room](../../../design/assets/keyboard-transition/desktop-room.jpg).
The dark area below the simulated visible viewport is not a rendered native
keyboard. Native iOS/Polkadot Mobile compositor behavior still needs a repeat of
the supplied recording on device. At 310px of visible height, the player and
composer take priority; the message history becomes very short.


Review follow-up: initialize the viewport baseline only from a valid sample.
If the composer is already focused, do not learn browser chrome from that first
keyboard-time frame. Two regressions cover initial zero and NaN geometry followed
by focus, a 310px keyboard viewport, and successful dismissal. The initial
implementation was `f847c8c`; the follow-up is recorded in a separate commit.
The review follow-up passed 11 targeted Chromium scenarios and 10 WebKit
scenarios, including both invalid-start cases. The initial PR's complete remote
quality gates also passed before this follow-up.
