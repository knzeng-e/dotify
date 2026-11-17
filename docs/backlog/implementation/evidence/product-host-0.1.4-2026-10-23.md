# Product Host 0.1.4 compatibility, 2026-10-23

Refs #317. Branch `fix/product-host-0.1.4` from tested dev
`9ba2008eb0a9249f7eb630a7139b133cae3c038d`. This is separate from #324 and #325.

## Observed failure and independent diagnosis

The owner reports connection failure on Desktop 0.1.4-rc.3 and mobile
0.10.0 (18). The screenshot fails at `getProductAccount`, with an old decoder
expecting three protocol-error bytes but receiving six. No artist transaction
or runtime installation is involved at that point.

Read-only inspection of the installed **Polkadot Desktop Dev.app** bundle finds:

- Bundle version: `0.1.4-rc.3`.
- Embedded `@parity/truapi` and `@parity/truapi-host`: `0.25.0`.
- Exported `TRUAPI_CODEC_VERSION`: `3`.
- Exported `TRUAPI_WIRE_SCHEMA_HASH`: `3c45e49b26c1ab97`.

Dotify's published dependency baseline uses SDK 0.27.0 / host 0.19.1 with an
explicit TrUAPI 0.13.1, codec-1 override. This establishes the Desktop
compatibility mismatch. The screenshot alone could also describe a dropped
channel; the independent installed-package inspection is what isolates the
version mismatch. Mobile's exact embedded protocol has not been inspected;
its marketing/build number must not be treated as a wire-version assertion.

## Upstream changes and chosen pairing

[Desktop change #41](https://github.com/paritytech/polkadot-desktop-community/pull/41)
updates TrUAPI 0.23 to 0.25, adds product chat footer control and custom-message
preview descriptions, migrates product key/value storage to one row per key to
avoid lost concurrent writes, and prevents duplicate product chat deliveries.
These are Host changes, not a claim that Dotify's separate Socket.IO/WebRTC chat
or audio has acquired a new feature.

[SDK 0.39 release](https://github.com/paritytech/product-sdk/releases/tag/%40parity%2Fproduct-sdk%400.39.0)
uses TrUAPI 0.25 and improves timeout classification, rejected-call handling and
transport-interrupt backoff. [SDK 0.40](https://github.com/paritytech/product-sdk/releases/tag/%40parity%2Fproduct-sdk%400.40.0)
requires TrUAPI 0.26, whose schema hash differs despite retaining codec number 3.
The candidate therefore chooses the matching 0.39 family, not npm latest.

Pins: SDK 0.39.0, host 0.28.0, statement store 0.7.3, tx 0.5.3, descriptors
0.14.0, exact TrUAPI override 0.25.0. The Product SDK uses its PAPI 3 graph.
Root `polkadot-api` remains on the existing 1.23 line because the separate
`@polkadot-apps` Bulletin/legacy integrations still use it; these signer/API
types are not substituted for Product's native PAPI 3 creator.

The SDK-facing account adapter still requests `dotify-test01.dot`, index zero,
and derives H160 from the returned sr25519 public key. No alternate signer,
browser-wallet fallback, account migration, contract/CDM address change or
permission bypass is introduced. The peak storage-deposit adapter is retained:
SDK contracts 0.11.3 still prepares a net-charge limit without it. Its integration
fixture now emits PAPI-3 `inBestBlock` then `finalized` through
`createSubmitAndWatch`, proving onboarding cannot advance at best block.

## Verification

- Five independent raw-wire tests pin codec **and schema**, both handshake
  directions and exact account lookup/response bytes with product/index/key plus a typed
  account denial.
  They do not use the installed encoder to generate expected frames.
- 983 frontend units pass, including actual SDK peak-deposit preparation and
  finalized factory-stage sequencing.
- All 25 deploy-environment tests and 26 journey-harness tests pass with the
  matching package pins. Web and frozen Product builds pass.
- Ten SDK-adapter browser scenarios pass in Chromium/WebKit for account/profile
  scoping, connection/disconnection, late responses and extension isolation.
  Three Product Nearby permission scenarios pass in Chromium for denial,
  asynchronous grant, renewal and absent native coordinates. These are fixture
  Hosts, not physical-device evidence.
- Three fixed public-key vectors produce the same H160 under old and candidate
  SDKs. This checks client address mapping, not which key a physical Host returns.
- Lint has zero errors and two existing App E2E hook warnings. The offline
  backlog check and `git diff --check` pass.
- Baseline and candidate npm audits report the same 49 existing advisories and
  no newly flagged package. This scoped compatibility update does not claim a
  dependency-security remediation.

## Rollout and remaining gates

Not deployed. Publish the reviewed client executable after merge. No API,
signaling, contract, factory or CDM deployment is required for this protocol
repair; no signer was activated and no account or on-chain state was changed.
The new bundle targets the observed codec-3 Host, not the retired Desktop 0.1.3
codec-1 pairing. Preserve historical artifacts as evidence; reverting to an old
client cannot make it compatible with a newer Host.

Before claiming recovery: on physical Desktop and mobile, connect with explicit
consent, verify the previous account/public key and existing artist runtime,
sign a fresh auth request and read protected content, then exercise room remote,
WebRTC and location permission denial/grant/retry. Check native factory finality
and contribution recovery without an automatic repeat payment. Record the
mobile embedded protocol/host-info result when accessible; do not promise its
exact build compatibility from a Desktop-only bundle inspection.
