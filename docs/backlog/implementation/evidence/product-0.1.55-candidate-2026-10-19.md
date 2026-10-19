# Product 0.1.55 live-presence candidate, 2026-10-19

Prepared from merged and tested `dev`
`893418de06b9eda8379a350b3bca8912a8ebb4b8` after #303 and #304.
Refs #88, #89, #274, #257 and #229. The owner requested deployment for testing.
This is candidate preparation, not evidence of publication or installed-device
acceptance. A separate rollout record must identify the signed commit and CID.

The [subsequent rollout record](product-0.1.55-rollout-2026-10-19.md) now captures
publication from this exact packaging commit and its independent verification.

## Package and rollout boundary

- Executable `[0, 1, 55]`, `product-cdm` on `devnet`, existing permissions,
  origins, contracts and content-key policies.
- The public catalog fixture and generated Product bootstrap are refreshed
  together, with 13 releases. Publication builds from this committed snapshot.
- Deploy the v5 signaling update before Product. Existing API code/configuration
  is unchanged by #304 and already serves the required receipt/media endpoints.
- Preserve one signaling worker and the existing API writer/volume/session epoch.
  Check aggregate active rooms/listeners/solo sessions immediately before any
  service restart; do not interrupt another person's session.
- Product 0.1.54 is the client rollback artifact. Withdrawing the new background
  hold policy requires a compatible client and signaling rollback, following
  the existing active-session checks.

## Acceptance to capture

Preparation passed 20 publication-guard tests and a live Host Remote Config
alignment check with deploy CLI 0.20.0. The refreshed fixture retains the exact
13 release identities. The merged-dev quality gates are green in
[run 39236219354](https://github.com/knzeng-e/dotify/actions/runs/39236219354).

Record exact-candidate CI, frozen Product build, publication guards, endpoint
checks and Host configuration alignment before signing. After publication verify
finalized root/app DotNS contenthash and executable version, then independently
compare public CAR index/entry bytes with the signed build. Verify the Web source
identity separately because its hosting and release path are independent.

Exercise live v5 room appearance, profile changes, counts, scope changes, opt-out
and closure with temporary synthetic-location sessions; close all test rooms.
Native screen lock/app switching, location permission/revocation, prolonged audio
and funded native tip receipt/chat acceptance remain physical gates. A test
fixture or an indexed-transaction miss cannot establish payment settlement.

The DotNS owner signer stays local and ephemeral. Never place it in a frontend
environment file, repository, CI, hosted service, process argument or report.
