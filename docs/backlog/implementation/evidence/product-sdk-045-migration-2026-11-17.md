# Coordinated SDK 0.45 candidate — 17 November 2026

**Implemented and locally tested; not deployed or accepted on a physical Host.**
Base: tested dev `8e3138c05dde3647002983296e0a44293c635c10`, whose
[quality run passed](https://github.com/knzeng-e/dotify/actions/runs/44121782934).
Tested application/test source and npm lockfile: `9c40ffe209acb2dfef22488a4949794a8dea5d37`.
The final error-text/format change is also covered by 20 focused unit checks.
The [migration explanation](../../../design/product-sdk-045-migration.md) owns
version selection, patch lifecycle and promotion boundaries.

## Observations

- Latest npm metadata read on 17 November: SDK 0.45.0, Host SDK 0.34.0,
  TrUAPI 0.31.0, tx 0.5.10, statement-store 0.7.10; descriptors remain 0.14.0.
  The umbrella brings its matching packages; old codecs are dev-only fixtures.
- Clean offline `npm ci` installs 817 packages and applies the version/hash-bound
  info patch. Repeated application verifies the installed client/helper unchanged.
- **1,235 unit tests / 159 files pass.** The transaction preflight fails before
  signer creation for an unsupported Runtime; ordinary account mapping and
  access checks retain their tests.
- **64 deployment/protocol guard checks pass**, including 36 current/legacy codec
  checks. Account, username, message-signing, Location/WebRTC/Remote permission
  and Bulletin subscription fixtures preserve their bytes across 0.25, 0.26,
  0.29 and 0.31. Denials and subscription cancellation remain explicit.
- Web and frozen Product builds pass. The generated Product bundle contains
  the strict info decoder. Existing large-chunk build warnings remain.
- **8 Chromium Product identity/About cases pass** through the real SDK adapter
  with a synthetic Host entry. The first sandbox attempt could not bind the
  loopback test server; rerunning with loopback permission passes. No live Host
  or musical asset is involved.
- Lint has zero errors and the two existing App hook-dependency warnings.
  Formatting, offline backlog consistency, whitespace and 354 local links/anchors
  pass. CASH declaration/recovery tests retain the no-go for actual Host support,
  executable units and verified artist-policy settlement.

These fixture responses do not sign anything cryptographically or prove actual
Host capabilities, audio, native approval, finalized settlement or recovery.
The original unmodified-codec laboratory remains separate and unchanged.

## Compatibility limit found by the broader check

The new `createTransaction` V2 wrapper is rejected by published 0.25/0.26/0.29
codecs. Only the informational response receives a compatibility patch; no
signing request is reinterpreted, downgraded or retried. CDM writes and native
PAS contributions require reported Runtime 0.31.x before constructing a signer.
The label selects the reviewed wire family; actual permissions, matching account
and transaction approval remain authoritative. Missing labels/timeouts refuse.

The phone's owner-reported Runtime 0.26 and statically inspected Desktop 0.9.4 /
TrUAPI 0.29 are therefore **not transaction acceptance targets for this
candidate**. Deployed clients keep their earlier behavior. Promotion requires a
named compatible Host and actual same-account signing, native PAS receipts and
protected Bulletin/Room/lock/artwork acceptance. No deployment, Host installation,
pairing change, funded payment, entitlement, key transfer or service change occurs.
CASH remains disabled and #85/#406 remain open.

## Signaling install-hook review correction — 17 November

[Review finding](https://github.com/knzeng-e/dotify/pull/483#discussion_r4604089474):
`Dockerfile.signal` copied only package manifests before `npm ci --omit=dev`,
which now invoked a frontend `postinstall` whose script/helper were absent.
Source correction: `f034a228a2d4176218b6dbbf47a12d164d977feb`.

An isolated manifest/server/shared package reproduced `MODULE_NOT_FOUND` for
`patch-truapi-info.mjs`. The corrected production-only install uses
`--ignore-scripts`; 627 packages install offline, and signaling boots with
passing health, Nearby enabled and zero Rooms without frontend patch files.
All 131 signaling tests pass; the new image-check script passes lint/format.
The frontend retains its ordinary postinstall and previously accepted codec tests.

The local Docker build could not reach any Dockerfile instruction because its
BuildKit `containerdmeta.db` is on a read-only filesystem. No Docker reset or
system-state repair was attempted. The signaling CI gate now builds the actual
production Dockerfile and checks UID 1000/startup/health in a disposable container
without external networking, published ports or mounted state. That image result
is a separate remote gate; the isolated Node check is not an image-build claim.
No service deployment, environment setting or physical Host requirement changes.
