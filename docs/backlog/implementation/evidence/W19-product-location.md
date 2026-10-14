# W19 — Product location continuation

## Identity and scope

- Date: 2026-10-14. Existing issue: [#274](https://github.com/knzeng-e/dotify/issues/274).
- Base: tested `dev`, `f0380f8c0d99fc262b66553597eba3a900264986`, including #278.
- Branch / PR: `feat/product-nearby-location` / [#279](https://github.com/knzeng-e/dotify/pull/279).
- Tested implementation: `d74075dd650ddf84939d752635fd0083a04db341`.
- Scope: explicit Product Location permission plus a bounded, coarse position
  snapshot; separate current-position discovery from city-centre exploration.
- No deployment, real-position collection, runtime migration or SDK upgrade.
- Flags remain off in the tracked Product profile; physical support is unverified.

## Capability finding and design

Installed versions: SDK 0.27.0, host 0.19.1, TrUAPI 0.13.1. The SDK exposes
`requestDevicePermission('Location')`, returning a grant rather than coordinates.
It exposes no public silent observer of Product-only revocation or dedicated
coordinate provider. `featureSupported` currently probes chain support, not
geolocation. A permission grant cannot establish WebView capability.

Official sources inspected on 2026-10-14:

- [SDK permission wrapper](https://github.com/paritytech/product-sdk/blob/69c19aecd66779515c5ad2eea5adb742f5251156/product-sdk/packages/host/src/permissions.ts).
- [SDK feature probe](https://github.com/paritytech/product-sdk/blob/69c19aecd66779515c5ad2eea5adb742f5251156/product-sdk/packages/host/src/features.ts).
- [TrUAPI permission contract](https://github.com/paritytech/trinity-user-agents/blob/67cc4b66e9da700fc716cdc420579a1f2a431340/rust/crates/truapi/src/v01/permissions.rs).
- [Android capability handler](https://github.com/paritytech/trinity-user-agents/blob/67cc4b66e9da700fc716cdc420579a1f2a431340/hosts/android/feature/products/impl/src/main/java/io/paritytech/polkadotapp/feature_products_impl/domain/permissions/handlers/DeviceCapabilityPermissionHandler.kt)
  maps Location to an OS permission, while the inspected WebChromeClient handles
  media requests without proving a working geolocation callback.
- [iOS capability handler](https://github.com/paritytech/trinity-user-agents/blob/67cc4b66e9da700fc716cdc420579a1f2a431340/hosts/ios/Packages/Products/Sources/Products/Permissions/Handlers/DeviceCapabilityPermissionHandler.swift)
  checks product/OS grants; that alone is not a coordinate-delivery test.

These main-branch sources do not establish the capabilities of an installed
release. No physical Desktop/mobile Host was queried or upgraded.

`authorizeProductNearbyLocation` lazily loads the SDK only on an explicit start.
It asks for Location, never accounts, signatures or statements. Cancellation,
timeout (15 seconds), denial, unsupported response and transport failure prevent
a fix/search/publication. Raw Host errors are not forwarded to the user.
A late grant cannot restart stopped consent. The app cannot dismiss or undo
the Host's own permission dialog/decision.

Product device mode requires three exact build/server flags, a secure context,
working Geolocation watch/clear methods, and a Permissions query. The browser
permission query has a six-second bound and cancellation; the existing fix
quality/coarsening/watch cleanup boundary remains authoritative. Precise fixes
never leave the device. Missing or unanswered capabilities fail closed.

The absence of a silent Product-only revocation observer rules out honest
continuous native renewal. This implementation takes one fix and publishes or
searches once, using the existing maximum 90-second lease. No automatic SDK
requests, fixes or lease renewal occur. **Update my location** explicitly
starts a new cycle. Browser permission change/background/off/disconnect still
stop immediately when observable; Host-only revocation is bounded by snapshot
expiry. The snapshot policy is captured before the asynchronous handshake, so
a lost Host marker cannot convert it to continuous browser tracking.

Ordinary standalone web retains foreground refresh. Manual city selection is
labelled **Explore a city**, stays collapsed, and requires a separate choice
and action. It searches only the selected radius around the city centre;
denial or capability failure never activates it automatically.

## Verification record

Synthetic coordinates only, Node 22.13.1, macOS and local Chromium. The Product
browser fixture uses the installed SDK fake client together with real browser
Geolocation/Permissions APIs and the real signaling service. This is adapter
evidence, not installed-Host evidence.

| Check | Observed result |
| --- | --- |
| Full unit suite before final strict-state hardening | 119 files / 914 tests passed. |
| Final permission/location/session/flags tests | 36/36 passed, including the added unknown-state rejection, snapshot policy capture and late cancellation/expiry paths. |
| Typecheck and Web build | Passed. |
| Frozen Product build, Nearby and Product location flags on | Passed on the tested implementation above; no bootstrap refresh/deployment. |
| Nearby Playwright | 3/3 passed, 0 flaky: installed SDK fake client plus real browser positioning, denial/missing API, explicit city choice and ordinary protected host → guest audio. |
| Lint / formatting | Zero errors; two existing App.tsx hook warnings. Prettier passed. |
| Offline backlog / diff checks | Passed. |

The final browser run took 23.8 seconds. Wire assertions found no precise fix
or wallet field. Screenshots of current-position and named-city states were
visually inspected at 390 px. Headless audio is not physical speaker evidence.
Existing build chunk/annotation/Browserslist warnings persist. No signaling or
contract code changed. CI results are tracked live on #279.

Artifacts: `/private/tmp/dotify-product-nearby-unit.log`,
`/private/tmp/dotify-product-nearby-build.log`,
`/private/tmp/dotify-product-nearby-product.log`,
`/private/tmp/dotify-product-nearby-lint.log`,
`/private/tmp/dotify-product-nearby-format.log`,
`/private/tmp/dotify-product-nearby-e2e.json`,
screenshots under `/private/tmp/dotify-product-nearby-artifacts/`.
Do not treat temporary local artifacts as a durable public device report.

## Physical-device validation checklist — not run

Use the build-only test profile from
[deployment configuration](../../../operations/deployment-configuration.md).
Publication and real-position collection require an explicitly authorized test
session. Fill this record with observations; do not infer results from a build.

1. Record build SHA, date, device/OS, exact Product Host version, browser engine,
   origin/scheme and network. Check secure context and Geolocation/Permissions
   availability without requesting coordinates or accounts.
2. Open Rooms and change the radius: no permission prompt, search, publication
   or automatic city selection should occur. **Explore a city** stays separate.
3. After an explicit Nearby action, confirm Location consent and successful fix
   delivery, or capture the understandable unsupported/timeout outcome. Never
   record precise coordinates in screenshots, logs or exported diagnostics.
4. Reject Location, stop during its prompt, and grant after timeout: no late
   search/publication. Verify browser/OS revocation and record whether a
   Product-only revocation is visible; do not claim that boundary is immediate.
5. Confirm a single snapshot, no automatic permission/fix/refresh, expiry within
   90 seconds (or earlier matching-room expiry), and explicit renewal at the
   selected radius. Test background/pagehide/off/disconnect without auto-resume.
6. On a separate client/network, find an opted-in host using both selected
   radii, Join without a wallet, and hear the protected host stream with no guest
   source key. Record discover-to-audio latency and actual speaker output.
7. Inspect coarse-only wire/storage output, touch/keyboard/screen-reader paths,
   unsupported-Host copy, city-centre labels, startup-off and rollback-off.

If a Host exposes Location consent without a usable/observable browser bridge,
this slice does not enable native positioning there. A Host-side bridge or a
future SDK coordinate/revocation API is the required follow-up. Do not relax
secure-context checks, invoke internal authorization APIs, or silently select
a city to pass acceptance. Continuous Product positioning stays unsupported.

## Operations and next step

No contracts, content-key authority, signaling schema, shared store, origin or
manifest change. Configuration adds only
`VITE_DOTIFY_PRODUCT_NEARBY_LOCATION=on`, default off. CI builds the opt-in
Product profile and runs both ordinary and Product-fixture Nearby scenarios.
Rollback this profile by rebuilding the flag off; snapshots expire within
90 seconds. See the existing W19 privacy and W13/#89 room-release gates.

Next: review this continuation, then prepare an authorized device-validation
session. Do not close physical capability gates from synthetic results. No
other roadmap sequence or Statement Store geographic publication was started.
