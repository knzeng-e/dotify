# W31 Worldwide Report: verification follow-up

## Identity

- Scope: the remaining #286 implementation-verification gap after #297.
- Starting dev: `75d05f1419abeb3580f724e6356f06c5308fa78d`, merged #331.
- Test implementation: `f0ba0915ba3ecf5a365a7d9f4c8d021046a47a53`.
- Branch: `test/worldwide-report-coverage`.
- Code readiness: locally verified; CI evidence belongs to the follow-up PR.
- Release readiness: no production application or service change to deploy.

## Result and authority

The existing shared Worldwide Report flow is now tested from its user interface
to the real local signaling handler. The two scenarios use ordinary Web at a
desktop viewport and the installed SDK's Product Host fixture at a mobile
viewport. They do not contact real people, a moderation service or deployed
signaling, obtain a real location, sign, publish or spend funds.

The tests establish all of the following:

1. An Everyone room is discoverable with location denied and without connecting
   the reporter's account. Product's fixture records zero account requests.
2. Opening/closing the reason picker sends no report and does not hide the room.
   The visible disclosure says no moderator is notified; the open interface
   passes the axe scan on both viewports.
3. Selecting `misleading` emits exactly one `nearby:report` with only the selected
   room's public discovery ID and reason. The ID is independently observed in a
   real server discovery response, not taken from the component's internal state.
4. The local server's anonymous report counter increases by exactly one. A test
   that merely clicked Hide could not satisfy this assertion.
5. The card and radar marker disappear only for that browser session. Hidden
   rooms / Show again restores both without sending a second report.
6. Another independent client still sees and can join the same protected room,
   reaches `In sync` over real loopback WebRTC and makes zero content-key requests.
   A report is not a global ban, durable moderation case or moderator notice.

Text Engine.IO packets are observed over both polling and WebSocket, since an
initial discovery response may arrive before the transport upgrades. Exact
counter assertions run sequentially in this file; no other current browser test
submits reports. Hosts explicitly close the fixture rooms, because closing a tab
alone is a reconnectable disconnect with a grace period.

## Baseline CI correction

Starting dev's [CI 40136091708](https://github.com/knzeng-e/dotify/actions/runs/40136091708)
passed all 261 core browser cases but failed the subsequent Nearby hover case at
`details.hover`. The first centering-only correction passed three isolated
repeats but still failed in the complete suite, so it was insufficient.

Temporary pointer/geometry diagnostics observed the page scrolling while the
popup was open, moving the marker away from the cursor. The hover scenario now
makes only page scrolling immediate and centers the marker before crossing into
the tooltip. Presence/radar animations, real pointer hover, popup visibility,
Escape, keyboard focus, exact counts and growth checks remain active. There is
no forced hover, retry allowance, relaxed assertion, product CSS or runtime fix.
Both host fixture rooms are explicitly closed after that scenario to prevent
grace-period invitations contaminating later tests. Diagnostic logging was
removed before final validation.

## Verification

| Check | Observed result |
| --- | --- |
| New Worldwide Report scenarios | Both Web and mobile Product-fixture cases pass with real local signaling and loopback WebRTC. |
| `npm run test:nearby` | Nine Web/discovery cases, including the two new scenarios and the corrected hover case, plus three Product-location fixture cases pass. |
| Touched-file ESLint and Prettier | Pass on both specs and the Nearby config. |
| Backlog manifest and diff checks | Offline manifest and whitespace checks pass. |
| Application/server/contracts | Unchanged; no dependency, permission, environment, persistence or deployment change. Broader CI still validates the repository. |

One initial local run timed out starting its cold fixture server; the diagnostic
restart and final run started normally. A separate overlapping launch was
rejected because the previous fixture still occupied its port; the final run
was started only after that process exited. Neither setup result is counted as
a passing behavioral run.

## Handoff and remaining gates

Review and merge the follow-up into `dev` to complete #286's missing browser
verification. The implementation closure handoff must also reconcile #286's
manifest/Project record; `dev` is not GitHub's default branch, so a closing
keyword alone does not perform that reconciliation.

Physical Product mobile/Desktop permission and location delivery, prolonged
audio, adversarial transport and pilot evidence remain #274/#85/#89/#158 gates.
The Product fixture is not installed-Host acceptance. Current first-sound and
media-edge activation gates remain #88/#288; this work neither activates the
gateway nor claims performance from HTTP timings. No staffed moderation or
server report persistence is added.
