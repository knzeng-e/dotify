# Product 0.1.60 Host compatibility publication, 2026-10-23

Refs #317. Packages merged dev `a60a89fda4f62819ec2b7bb16c4d4c71bfe176b7`,
including #326, with executable `[0,1,60]` under the existing
`dotify-test01.dot` identity.

## Scope and boundaries

The SDK 0.39 / TrUAPI 0.25 pairing matches the inspected Desktop 0.1.4-rc.3
wire codec and schema. The [compatibility evidence](product-host-0.1.4-2026-10-23.md)
records independent wire tests, account mapping, native deposit preparation
and browser-fixture checks. The existing artist runtimes and keys are retained.

This Product-only rollout does not restart API/signaling/encoder, deploy
contribution facets, change artist policies, or update ordinary Web. Media-edge
configuration remains unset, retaining the API fallback. The dedicated gateway
requires working access before activation. The new #324 server authority
endpoint and Solidity changes are not activated by this executable alone.

## Publication status

Prepared, not yet published. Build, live Host profile verification and signed
DotNS/public artifact readback will be recorded after execution. Never infer
live publication from the deployment config version alone.

## Remaining acceptance

Reload Dotify in physical Desktop 0.1.4-rc.3 and mobile 0.10.0 (18), connect
with explicit consent, and verify the previous account and artist runtime.
Then verify signed protected playback, room audio/control and location consent.
Mobile's embedded wire protocol is not independently confirmed by its build
number. A protocol mismatch must fail explicitly rather than switch signers.

Retain 0.1.59's public artifact as historical rollback evidence; its old wire
protocol cannot repair a new Host. No automatic artist write or repeat payment
is part of acceptance. #317 remains open until its live-device gates pass.
