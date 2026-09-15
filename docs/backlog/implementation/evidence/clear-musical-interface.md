# Clear musical interface — evidence

Reviewed base: `dev` at `c9583abc36afa1f86a2227ed482e94970bef5860`.
Branch: `feat/clear-musical-interface`. Partial #151 and #90.

The [audit and benchmark](../../../design/clear-musical-interface-2026-09-15.md)
records observed behavior, the public sources, implementation decisions and
boundaries. This pass combines actionable artwork, quiet room states and
artist/personal hierarchy. It adds no payment or identity authority.

## Verification

| Command / evidence | Result and scope |
| --- | --- |
| `npx playwright test --trace=retain-on-failure` | 62/69 passed; seven audio/3D scenarios hit the 30-second test budget during full tracing. |
| `npx playwright test --last-failed --workers=2` | All seven passed on unchanged code/assertions (41.1 s). This is a focused recheck, not a claim that the traced run was green. |
| Publication diagnostic: happy-path `--repeat-each=3 --workers=1 --trace=on` | 3/3 passed after an earlier unexplained publication-modal timeout; the subsequent 69-scenario run also passed publication. |
| Room-exit regression | Failed before the local-role correction (Play stayed paused/disabled); passed after it, including silence on exit, local Play/seek and surviving host room. |
| `npx playwright test --config playwright.webkit.config.ts --workers=2` | 27/27 passed, including seven new interface/exit scenarios. Browser/geometry evidence, not physical iPhone certification. |
| `npm run test:unit` | 450/450 passed across 59 files. |
| `npm run lint` / `npm run fmt:check` | Passed; lint has three existing hook-dependency warnings in `App.tsx` and `ArtistShell.tsx`, no errors. Extra Prettier check covers new CSS and changed browser tests/config. |
| `npm run build` | TypeScript and ordinary web build passed. |
| `npx vite build --config vite.product.config.ts --mode product-devnet` | Product build passed using the checked-in bootstrap, without catalog regeneration. |
| `npm run smoke:production-env` | Passed: missing endpoints and browser-exposed secrets fail closed; safe public configuration builds. |
| `git diff --check` / offline backlog check | Passed; existing backlog warnings: 24 unmapped items and duplicate numbered 08 docs. |
| Visual inspection | Actual 390px mobile and 1440px desktop renders, plus enlarged-text capture. [Screenshots](../../../design/clear-musical-interface-2026-09-15.md#visual-evidence). |

Builds retain existing large-chunk and dependency-annotation warnings. No new
bundled library was added. Timing failures remain recorded; no assertion or
production timeout was weakened to obtain a pass.


The meaningful new checks cover actual current-source resume, media-element
identity, centered touch/keyboard actions, protected selection opening the access
gate, returning catalog focus, useful artist/You content, honest room offline
feedback, reduced motion and 200% text sizing. A further regression reproduced
a disabled player after room exit: clearing the room left the guest transport
role targeting a removed remote stream. Restoring the local role fixes explicit
Play/seek without autoplay on exit or terminating the host room. Existing
publishing coverage now checks the real description in its release disclosure. The negative Classic
payment test still requires a payment record while playable access stays denied;
it no longer expects a content hash or catalog price to be a receipt.

An intermediate full Chromium run had one publication-modal timeout (67/68
passed). The publication flow then passed three consecutive focused runs without
changing or relaxing that flow; the initial timeout was not explained. The final
local run and focused recheck are reported above; CI is recorded on the PR.

Initial validation found an incorrect new test selector, two expectations tied
to intentionally moved/relabelled UI, and the real text-resizing overflow caused
by `html/body` minimum widths in `rem`. These were corrected; the audio/access
assertions were not relaxed. The screenshot review also reduced unused card
space and restored the missing visual hiding for screen-reader announcements.

No physical iPhone, native Product-host, real-payment or assistive-technology
certification is claimed. The WebKit suite is browser/geometry coverage. No
benchmark conversion rate or performance improvement is invented. No new
environment configuration, deployment, catalog regeneration, contract or storage
migration is required. Broader W10/W12/pilot acceptance remains open.
