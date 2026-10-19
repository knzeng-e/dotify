# Mobile form continuity: implementation evidence

## Identity and scope

- Date: 2026-10-19.
- Issue: [#306](https://github.com/knzeng-e/dotify/issues/306).
- Branch: `fix/mobile-keyboard-and-sheets`, from tested `dev`
  `893418de06b9eda8379a350b3bca8912a8ebb4b8` (Dev Quality Gates passed).
- [Scope](../../mobile-form-continuity.md) and
  [design/form inventory](../../../design/mobile-form-continuity-2026-10-19.md).
- Presentation and focus management only. No deployment, contract migration,
  contribution, real wallet signature or production service restart in this work.

## What the checks establish

The new browser journeys exercise real forms using synthetic catalog/wallet
fixtures and a local signaling server. VisualViewport events simulate a keyboard
shrinking and panning the visible screen. One artist journey also resizes the
layout viewport, covering the alternative browser layout model. These are not
physical keyboard tests.

The room-name/invitation test preserves Unicode text through valid and empty
viewport frames. The live-room test saves on the first pointer release while
keyboard geometry changes and verifies the saved profile after reopening.
Joining retains the nickname-only invitation threshold. Listener profile fields
inside a room still receive shared scrolling; chat composition retains its
dedicated controller. Artist onboarding and rights-recipient fields remain
reachable. Tip review preserves the entered amount and sends no contribution.
Desktop closing restores the previously focused opener without scrolling.

The bounded layout matrix adds 320 x 640, 430 x 932, 740 x 390 landscape and
390 x 844 with 200% text/reduced motion. It checks both the field and its label,
action hit testing, horizontal overflow and retained drafts. Existing room tests
cover zoom, rotation, resized layouts, transient invalid geometry and tapping
tabs while a keyboard closes. Existing design checks cover navigation and page
reflow at 360, 390, 768 and 1440 px.

## Local verification

Environment: macOS arm64, Node 22.13.1, locked dependencies from `npm ci`.
No dependency or lockfile changes.

| Check | Result and scope |
| --- | --- |
| `npm run test:unit` | 125 files, 1,000 tests passed |
| `npm run fmt:check` | Passed |
| `npm run lint` | No errors; two existing `App.tsx` hook-dependency warnings |
| `npm run build` | Passed, TypeScript and Web production output |
| `npm run build:product-devnet:frozen` | Passed with existing frozen catalog; not Host execution evidence |
| Chromium form and layout suites | 11 passed on final form layout |
| WebKit form and layout suites | 11 passed on final form layout |
| Chromium existing room/design checks | 18 passed in the earlier 25-test batch, including 200% navigation reflow |
| WebKit existing room/design checks | 14 passed in the earlier 21-test batch; its three form focus assertions were corrected and passed in the final form suite |
| `node scripts/backlog-sync.mjs --check --offline` | Passed |
| `git diff --check` | Passed |

The two new suites are `web/e2e/form-keyboard.spec.ts` and
`web/e2e/form-keyboard-layout.spec.ts`. Run both with `npx playwright test`;
repeat with `--config playwright.webkit.config.ts` for WebKit. The existing
checks come from `design-surfaces.spec.ts` and the keyboard/viewport cases in
`room-workspace.spec.ts`. The PR checks remain the authority for remote CI on
its exact head.

Builds retain existing bundle-size, stale Browserslist-data and `@scure/base`
annotation notices. No warning was hidden by a dependency upgrade or suppression.

Selected [WebKit screenshots](../../../images/mobile-form-continuity-2026-10-19/README.md)
were visually reviewed at compact width, enlarged text and landscape. They use
fixture content, not an artist's private data. In the simulated keyboard images,
the area below the shortened visual viewport still shows the underlying page:
Playwright does not draw a native keyboard there.

## Review discoveries

- The shared controller originally exempted every field in a room shell. The
  final selector exempts only chat and track-request composition; People fields
  and dialogs remain covered.
- Invalid initial viewport geometry no longer poisons the resting-height
  baseline. The last valid geometry survives transient zero measurements.
- A dialog's deferred initial focus could steal focus from an already edited
  input. It now leaves an already-focused child alone.
- The enlarged-text capture exposed an existing unbreakable preview title in
  room creation. The preview now wraps within its column.
- On macOS, the test's `End` key scrolled the sheet rather than merely moving
  the caret. The test now appends after `fill`, which already positions the
  caret. Safari pointer clicks do not focus buttons: restoration tests open
  from keyboard focus; the separate save-on-first-tap scenario still uses an
  actual pointer down/up across the geometry change.

## Operations and remaining native gate

`docs/operations/deployment-configuration.md` was checked. This slice adds no
environment variable, hosted setting, permission, origin, storage requirement
or deployment step. Existing Web and Product build paths are retained. Rollback
is a frontend revert/rebuild with no data migration.

Before release acceptance, test the same reviewed build on physical iPhone
Safari, Android Chrome and supported Product Mobile/Desktop:

1. Name a room and type a multiline invitation. Keep the label and entered text
   above the native keyboard, including after rotation and text enlargement.
2. Dismiss the keyboard and save once; reopen and check the retained identity.
3. Repeat nickname joining, chat/request input, artist publishing/editing and
   tip amount/review without submitting money merely to check layout.
4. Check Back/Escape/close, return focus, unchanged page position and uninterrupted
   listening while a sheet opens or editing hides fixed navigation.
5. Record device, OS/Host/browser, build SHA and failures. If a Host's iframe is
   covered without resized geometry, record that native bridge limitation;
   browser simulation cannot certify it away.

Physical-device results are **not yet verified**. No new Product CID or live
release is associated with this change.
