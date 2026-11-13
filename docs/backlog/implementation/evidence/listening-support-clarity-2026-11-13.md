# Listening support is directly reachable — 2026-11-13

## Result and scope

Implementation `e0f1c8c99390a22d6b9be4b070d933e27bd77573`, based on tested dev
`5ec237bf3b2ed5f62f31a596b525e4fe6b55de1e`
([dev CI](https://github.com/knzeng-e/dotify/actions/runs/43469090568)).
This is a client candidate for [#388](../../listening-controls-and-discovery.md),
not a deployment or proof of native artwork reliability.

The owner copied app details instead of the hidden listening report and restarted
before collecting the failed attempt. About now shows the report action directly,
explains copying before reload, and keeps version-only copying under Technical
details. A named support section reuses the existing cyan primary action. Other
failure-panel report buttons keep their current appearance.

The serializer, report schema and page-memory lifetime are unchanged. Opening About
neither copies nor sends a report; only the explicit button reads the bounded
snapshot. Clipboard refusal still exposes selectable text. No storage, analytics,
account/track identifiers, audio, access or playback behavior is added.

## Verification

- **20/20 browser cases:** Chromium and WebKit; 320, 390 and 1280 px report access,
  clipboard allowed/denied, build identity, private sentinel exclusion, readable
  fallback, closed technical section, no automatic copying, Escape focus return
  and browser Back dismissal. Existing five-line app-details export is preserved.
- The first WebKit run exposed two existing focus-return failures. About now
  focuses its opener before showing Dialog, preserving the shared dialog's
  restoration path even when a WebKit tap does not focus a button. The final
  run passes without retries or relaxed assertions.
- Typecheck, Web and frozen Product builds, and lint pass. Lint retains two
  existing App hook warnings; builds retain existing large-chunk advisories.
- The WebKit listening CI configuration now includes About, so this coverage is
  maintained alongside the existing Chromium core suite.
- Mobile and desktop captures were inspected, including the denied-clipboard
  fallback. [320-pixel capture](assets/listening-support-mobile-2026-11-13.png).
  Automated viewport coverage is not a physical iPhone acceptance claim.

Reproduce from `web/`: `npx playwright test e2e/about-dotify.spec.ts` and
`npx playwright test --config playwright.listening-webkit.config.ts e2e/about-dotify.spec.ts`.
The local equivalent ran both engines with one worker. Reports are local under
`.data/support-clarity/` in the implementation checkout; no private owner report
is committed. See the [artwork collection guide](../../../how-to/check-system-artwork.md)
and [Room collection guide](../../../how-to/measure-room-startup.md).

## Remaining gates

PR CI, owner review and matching delivery remain. The missing-cover cause and
physical Pause/lock behavior are separate acceptance gates. Real recovery remains
deferred; there is no musical write, service maintenance, key or SDK change here.
