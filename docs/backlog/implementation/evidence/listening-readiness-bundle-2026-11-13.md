# Combined listening readiness candidate — 2026-11-13

## Purpose

This candidate brings together #461 artwork return recovery, #462 native-capture
test correction, #463 support-report clarity and #464 pilot checkpoint alignment.
It starts from tested dev `aa9dc45530cdf942b654509c64930eef3d288fd8`
([CI](https://github.com/knzeng-e/dotify/actions/runs/43477070044)).
Refs #388, #395 and #158; none of their physical/public-pilot gates is closed.

A read-only inspection on 13 November finds `dev` branch protection configured
with `required_status_checks.strict = true`. Although each source PR is green,
#462–#464 are behind the current dev. Separate sequential merges would require
fresh branch synchronization and CI. This draft offers one combined validation
and owner merge while keeping the source PRs as the deliberate review path. It
changes no repository protection or required check.

## Source and review path

| Source PR | Included head | Review boundary |
| --- | --- | --- |
| #461 | `445ffb64b9e1c231face53f5246bdc26c157c4bc` | One bounded artwork recovery, metadata ownership/cancellation, no transport command |
| #462 | `921f7813c1cee025e14b69ea4fa2e31edaf78ab4` | Explicit E2E-only 48-kHz fixture and awaited setup Pause; energy/frequency assertions retained |
| #463 | `0d3ebdc189f9f632f1665ac81b03fdec8ba0673e` | Visible manual report export, selectable clipboard fallback and focus restoration |
| #464 | `62660840a94c7b00688a2fc286fdd55f415a0ce1` | Canonical pilot delivery checkpoint and unchanged acceptance gates |

All source branches merge without a conflict. Candidate implementation commit
`eec8a9a20bc449551758de13e0295555d8e8fa1d` has tree
`50c880ea7713a25bfd3afbabd726c32ade9e847b`. The following evidence-only commit
changes no runtime or test source. The already merged Pause correction #459 and
CASH research #460 are inherited through dev; no additional payment or SDK work
is introduced here.

## Validation

- All **1,186 frontend unit tests / 154 files** pass on verified Node 22.23.5.
- The entire `web`, `services` and `contracts` diff against the earlier local
  preview `6d26a746ccdd4b1d275270c301ee47350bcfa329` is empty. Its **40/40**
  About/artwork/host-autoplay Chromium/WebKit cases therefore validate identical
  runtime/test inputs; they were not unnecessarily rerun after documentation
  and history-only changes. That earlier record remains local compatibility
  evidence, not future merged-dev CI or physical iPhone acceptance.
- The inherited [native-capture evidence](native-capture-fixture-2026-11-13.md)
  binds the separate 44/44 repeated mobile-host checks to their source; the
  combined unit run includes its four real-signal/production-guard unit cases.
- Web and frozen Product builds pass. Existing large-chunk advisories remain.
  Backlog manifest, local documentation destinations and whitespace checks pass.
- Each source PR's quality CI passes on the included head. The combined PR still
  requires its own quality CI and owner review; branch protection is retained.

Local logs and source equivalence checks are retained under `.data/bundle-evidence`
in the implementation checkout. No private owner report or key is committed.

## Delivery and acceptance remain separate

This candidate publishes no client/service and performs no musical, Bulletin,
DotNS, payment, key or recovery operation. Matching client publication requires
its own reviewed package and operational authority. Then verify actual phone
Pause before/during Room preparation, native Pause through unlock, explicit Play,
correct cover/artist across immediate/repeated locks and rapid changes, access
teardown, and audible host/Web/Desktop guests. Keep #395/#388 open. Real
independent recovery stays owner-deferred before public-pilot acceptance.

The [artwork collection guide](../../../how-to/check-system-artwork.md),
[Room startup guide](../../../how-to/measure-room-startup.md) and
[selected sequence](../listening-and-publication-readiness.md) own the procedures
and scheduling; the source evidence remains available for focused review.
