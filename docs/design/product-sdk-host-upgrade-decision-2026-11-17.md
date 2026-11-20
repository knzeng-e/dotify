# Product SDK/Host upgrade decision — 17 November 2026

## Subsequent owner observation, 20 November 2026

The [new iPhone screenshots](../backlog/implementation/evidence/product-host-ios-031-2026-11-20.md)
show build 23 with Runtime 0.31.0 configured. #85/#483 resumes qualification of
the coordinated candidate against current dev. This supersedes the old phone
configuration as the next target; it does not turn the dated synthetic results
below into actual signing/payment acceptance. CASH still has its separate gates.

**Hold the default upgrade to SDK 0.45.0; keep CASH work tips no-go.** The latest
SDK builds and passes Dotify's unit suite, but its protocol differs from the
owner's phone and the latest inspected Desktop archive. A real codec experiment
reproduces an older-response decoding failure. This #85/#406 investigation
prepares target-specific migration, not an application or Host installation.

A subsequent owner-selected [coordinated migration candidate](product-sdk-045-migration.md)
now corrects the info decode failure and makes transaction V2's Host requirement
explicit. This record preserves the original unmodified-codec investigation;
it is not a statement that no later candidate exists.

## Versions that must not be conflated

| Surface | Observed identity | Evidence and limit |
| --- | --- | --- |
| Production pins | SDK 0.39.0 / Host SDK 0.28.0 / TrUAPI 0.25.0 | Existing source pins; unchanged by this work. Prior listening acceptance does not establish CASH support. |
| Owner iPhone | Polkadot app 0.10.0 (20), **TrUAPI Runtime 0.26.0** | Owner reads About on 17 November; app label comes from matching prior reports. No new capability or payment call. |
| Locally installed Desktop | Stable 1.0.0-rc.1; Dev 0.1.4-rc.3 | Public Info.plist labels only; no user profile inspection. |
| Official Desktop 0.9.4, published 16 November | Bundles **TrUAPI and TrUAPI Host 0.29.0**, alongside Nova Host API 0.12.0 | SHA-512-verified macOS arm64 archive, selected ASAR package metadata. Static bundle presence does not identify the active backend or prove payments. |
| Published current SDK | **SDK 0.45.0 / Host SDK 0.34.0 / TrUAPI 0.31.0** | npm metadata and integrity-verified archives; the umbrella release is dated 13 November. Not a proof that a named device ships 0.31. |

The [SDK release](https://github.com/paritytech/product-sdk/releases/tag/%40parity/product-sdk%400.45.0)
describes the 0.31 pairing, chain-follow recovery and shared chain clients. The
[official Desktop release](https://github.com/paritytech/polkadot-desktop-community/releases/tag/v0.9.4)
is a different artifact. Its archive reports bundle ID
`io.parity.polkadotdesktop.develop`, distinct from the inspected installed Dev
application's `com.polkadot.desktop.dev`; do not treat installation as a proven
in-place replacement preserving pairing/profile state.

[Selected source/artifact identities](../backlog/implementation/evidence/sdk-host-upgrade-2026-11-17.json)
retain npm integrities, archive metadata and file hashes. The desktop ZIP is
256,585,119 bytes and matches the release update manifest's SHA-512. It was not
installed or launched. The private full candidate lockfile and downloaded binaries
are local operator evidence, not committed application inputs.

## Build success is not protocol compatibility

An isolated experiment from tested dev `510e72a1` updates SDK/Host to
0.45.0/0.34.0, statement-store/tx to 0.7.10/0.5.10, and the TrUAPI override to
0.31.0. **Web and frozen Product builds pass; 1,223 unit tests in 158 files pass.**
The six existing raw-wire checks pass four and fail two: the expected 0.25 API
fingerprint changes, and decoding the fixed old `system.info` response throws.
Those failures are evidence to preserve, not pin assertions to weaken.

The [isolated laboratory](../../research/product-host-compatibility/README.md)
uses exact published codecs and an in-memory provider. Fourteen checks pass,
with a [16-cell fixture matrix](../backlog/implementation/evidence/host-codec-matrix-2026-11-17.json):

- All four versions complete the same codec-3 handshake. It does not negotiate
  or establish agreement on the complete API schema.
- The 0.31 decoder rejects 0.25/0.26 info responses missing its trailing
  `truapiVersion`; older clients ignore that field when receiving a newer response.
- The 0.29 and 0.31 info shapes interoperate despite their different complete
  schema hashes. A whole-API fingerprint difference is not proof that every
  method breaks; one decoded method is not payment/signing/storage acceptance.

This is synthetic protocol evidence, not a binary/runtime or acoustic device
test. No live Host is called. App pins and lockfile are restored unchanged;
only the independent research lockfile adds the codec versions. CI runs the
matrix and uploads its fixture-only report. A clean offline install of the
research lock passes; after restoration, all six pinned wire checks and fourteen
existing CASH recovery checks pass. The backlog manifest and 267 local
documentation links/anchors also pass.

## CASH remains a separate decision

The 0.45 payment manager has a required caller-chosen ID in its request object;
the protocol has partial/terminal status and `AlreadyExists`. That removes the
old declaration-level lost-ID limitation. Dotify's existing
[offline CASH inspector](../backlog/product-cash-tip-feasibility.md) still returns
no-go for actual named-Host support/restart durability, exact amount-unit
provenance and verified artist-policy/Room settlement. No declared API, returned
manager, version label or Completed callback substitutes for those guarantees.

The existing [work-tip decision](product-cash-tip-decision-2026-11-13.md) owns the
durable-ID, unknown/partial outcome and collaborator/host-share boundaries.
The old money-guide URL currently redirects to the general developer home;
that redirect supplies no new unit evidence. Do not infer CASH decimals,
PAS conversion or entitlement from this investigation.

## Next eligible work

Choose a target-specific candidate: SDK 0.40 / Host SDK 0.29 / TrUAPI 0.26 is
the previously identified published phone-aligned set; SDK 0.44 / Host SDK 0.33 /
TrUAPI 0.29 is the published Desktop-aligned set. These are version candidates,
not independently accepted device bundles. A default 0.45 migration requires
reviewed per-method compatibility on the actual target or a verified 0.31 Host.
Do not rotate the production pin merely because compilation passed.

Then perform bounded non-spending identity/wire observations on the chosen
distribution, preserve account/signing/Bulletin/PAS behavior, and establish unit
and status provenance before considering a disabled payment adapter. A funded
trial needs an exact recipient, asset, spend cap and recovery plan after review.
No service, deployment, key, musical upload, CASH payment or access grant is
introduced here. #408 entitlement/royalty settlement and the deferred real
recovery rehearsal keep their separate scope.
