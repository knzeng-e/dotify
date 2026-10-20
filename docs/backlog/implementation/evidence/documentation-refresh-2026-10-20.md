# Documentation refresh before release, 2026-10-20

Refs [#158](https://github.com/knzeng-e/dotify/issues/158) and
[W13](../W13-pilot-release.md). This is release preparation, not pilot acceptance.

## Candidate and scope

- Branch: `docs/release-readme-refresh`, created from tested `dev`
  `4582e37e0de1890dc96671271eba35d389e73d70`.
- Application source tree: `e6a759e14b2d50f47e2159402438c8e2cfd165c3` (`web/src`).
- Root README: 573 to 142 lines. Web README: 750 to 109 lines.
- New task guides cover shared listening, local development and uncertain
  payments. The documentation map links to canonical references and runbooks
  rather than duplicating deployment histories and secrets-related instructions.
- Current architecture, room and access explanations replace stale claims about
  public room enumeration, unimplemented Nearby, capture-only media support,
  manual personhood registration, component independence and asset permanence.
- The public project page uses the same gallery and links, with responsive image
  sources and wrapping for long technical identifiers on small screens.
- Existing dated screenshots and rollout records remain at their original paths.

No application, API, signaling, contract, dependency or deployment configuration
behavior changes. The operations document changes one link to the payment guide.

## Capture provenance

Five JPEG captures show Music, the room galaxy, a shared room on desktop and
mobile, and the artist Releases view. Their combined size is approximately
300 KiB. The [gallery record](../../../images/release-preview/README.md) explains
synthetic releases, participants, artwork and browser-emulated location.

The opt-in Playwright recipe uses existing browser adapters, synthetic registry
reads and real local room signaling. Three rooms run concurrently: two Worldwide
and one Nearby, with 2, 3 and 1 connected sessions. It blocks external HTTP delivery, provides local synthetic artwork,
and records source/tree, browser and time in `capture.json`. It is excluded from
the default browser suite. No real participant, production key, wallet signature,
upload or payment is involved. A documentation-only server uses the normal
registry metadata path with synthetic reads, without a signer or live chain.

Review correction: the gallery was regenerated from committed recipe revision
`964eaab320400abef240938c942cb4b39cde08f8`, which contains the three-room flow
and its shared registry fixtures. `capture.json.source` now points to that
revision rather than the earlier one-room recipe. Generated artifacts are stored
in a subsequent commit; the capture guide makes that ordering explicit.

## Verification

- `npm run build` in `web`: passed; existing large-chunk/Browserslist notices.
- `npm run lint` in `web`: passed, with the two pre-existing App hook warnings.
- `playwright test --config playwright.docs.config.ts`: passed; the room,
  participant count, messages and selected release view settle before capture.
- Default Playwright discovery: 254 tests in 29 files; documentation capture is
  absent from that list.
- Chromium gallery checks at widths 390, 768 and 1440: all images load; no
  horizontal document overflow. The narrow view selects the mobile room image.
- Changed Markdown and capture TypeScript formatting: passed.
- Local paths and anchors in changed/new documentation: checked.
- `git diff --check` and `node scripts/backlog-sync.mjs --check --offline`: passed.

These checks cover documentation and the capture recipe. They do not establish
physical-device behavior, native Product compatibility, audio audibility,
settlement or live production configuration. Other specialist references were
not exhaustively audited. W13 remains open for candidate-bound deployment,
physical-device and pilot evidence.

## Handoff

Review the entry points first, then corrected system boundaries, then capture
provenance and the isolated recipe. After merge, select a release candidate and
follow the existing Web/API/signaling and Product runbooks. This change does not
publish a build or authorize a release decision.
