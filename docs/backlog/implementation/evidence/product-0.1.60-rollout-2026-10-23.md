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

Published from clean packaging commit `cb63d0749aba0a43980f1d3dd3f52a3c9866cf66`. All 11 merged-dev
checks pass. The packaging build and 25 deployment/protocol tests pass locally;
packaging CI 39959985162 passes its completed checks, with the browser job still
stalled at **Install Playwright browser**, before executing tests. This is not a
claim that the packaging browser job passed. Existing large-chunk warnings remain.

Live Host Remote Config verification passed before and after signing. Independent
finalized readback at block **14811178** confirms root
`dotify-test01.dot` and executable `app.dotify-test01.dot` both resolve to
`bafybeia2dhkny3yv4oy2dzubqa24qlt2kacnd64sy5mjf3qw47dhdveuum`, with executable manifest `[0,1,60]`.

- Root contenthash transaction: `0x0925f9799b33facec288045faad372e0fca6dfb0666d12f744771b84914fcfaa`.
- Executable manifest transaction: `0x22f8d4930dc4bddefc4f860dd02bc323f00f4039d41b266c8a367dbc4f5a1223`.
- Public CAR downloaded successfully: 12,769,136 bytes; all 127 SHA-256 block
  hashes verified. Archive SHA-256 `db7e5ab434138c6277709820e7b1722cb7e733cf14a8ffe36730b783ab753469`.
- Internal UnixFS directory `bafybeihmom5evkg7czg37fuvr74mazgmwciyyjvatp6f2wsqagfs2c2jpe` matches fresh local merkleization;
  DotNS resolves the transport DAG, not that inner directory root.
- Exact index and entry bytes match the local signed build. Entry `assets/index-Cn02Vu47.js`,
  SHA-256 `9065da406c34e846265e3d26a4ed97ca232cf1c0c9f7dc69701f97f94074c14b`, embeds the packaging SHA above.
- API readiness and signaling health return HTTP 200. No services restarted.
  The local DotNS signer was removed and its absence independently verified.

These checks prove publication and artifact identity, not an installed Host's
cache refresh or physical-device connection recovery.

## Remaining acceptance

Reload Dotify in physical Desktop 0.1.4-rc.3 and mobile 0.10.0 (18), connect
with explicit consent, and verify the previous account and artist runtime.
Then verify signed protected playback, room audio/control and location consent.
Mobile's embedded wire protocol is not independently confirmed by its build
number. A protocol mismatch must fail explicitly rather than switch signers.

Retain 0.1.59's public artifact as historical rollback evidence; its old wire
protocol cannot repair a new Host. No automatic artist write or repeat payment
is part of acceptance. #317 remains open until its live-device gates pass.
