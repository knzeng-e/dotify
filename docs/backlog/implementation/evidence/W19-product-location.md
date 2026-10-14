# W19 — Product location continuation

## Identity and scope

- Date: 2026-10-14. Existing issue: [#274](https://github.com/knzeng-e/dotify/issues/274).
- Base: tested `dev`, `f0380f8c0d99fc262b66553597eba3a900264986`, including #278.
- Branch / PR: `feat/product-nearby-location` / [#279](https://github.com/knzeng-e/dotify/pull/279).
- Tested implementation: `d74075dd650ddf84939d752635fd0083a04db341`.
- Scope: explicit Product Location permission plus a bounded, coarse position
  snapshot; separate current-position discovery from city-centre exploration.
- No deployment, real-position collection, runtime migration or SDK upgrade.
- Availability now defaults on in Web/Product and signaling; physical support
  is unverified. The owner-default amendment below supersedes the original
  three-flag rollout design and its historical verification record.

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

Product device mode requires a secure context,
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

## Review correction — independent room expiry

- [Discussion](https://github.com/knzeng-e/dotify/pull/279#discussion_r4274024302):
  a nearly expired room incorrectly shortened the whole Product search.
- Tested correction: `1da55ae45bf6819d76897ccbc0a641cfac2c7d38`.
- Response-level expiry now owns the position snapshot. Each room card has a
  separate monotonic deadline, bounded by the response lease and reduced by the
  full request round trip. Expired cards are removed independently, including
  cards already expired during transit. Empty results retain consent until the
  response lease ends; no automatic fix or Host permission request is added.
- Refresh/restart replaces card deadlines; stop cancels both response and card
  timers. Ordinary browser refresh preserves other valid rooms as well.
- Focused session/schema tests: 21/21 passed, including short/long room leases,
  empty-but-valid Product snapshots, transit delay, restart/stop cleanup and
  ordinary browser deadline replacement. Nearby Playwright: 3/3 passed. Web
  and opt-in frozen Product builds, final typecheck, targeted ESLint/Prettier, offline backlog validation
  and diff checks passed. Physical-device gates remain unchanged.

## Owner-default amendment — 2026-10-14

Tested implementation: `5e6741e7f6f6766a0998ead2dbce7cec8a4bf2b6`.

The owner requires the Product application to carry Dotify features by default.
Nearby now defaults available in both Web and Product and in single-worker
signaling. The Product-only build gate is removed. Unset or exact `on` enables
the main frontend/server setting; explicit `off` or an invalid value disables
that boundary operationally. Location permission, search and host visibility
remain explicit user actions. Secure context, observable permissions,
coarse-only transmission, bounded Product snapshots and cancellation are retained.

The normal Product build needs no activation flags. CI checks that normal build,
the rollback build, Web/Product discovery without enabling flags, and a separate
explicit-off browser profile. Existing published artifacts/settings were not
changed. The source-default change is not proof of physical Host positioning.

- Full unit suite: 119 files / 921 tests passed. Focused permission/location/
  session/default-setting tests: 42/42 passed. Default availability does not
  weaken permission/cancellation/expiry or coarse-cell assertions.
- Signaling suite: 93/93 passed, including default configuration, invalid/off
  overrides and live sockets with default-on search/publication and explicit-off
  rejection, disconnect cleanup, wallet-free Join and public-state privacy.
- Nearby browser suite without activation flags: 3/3 passed. Product consent
  is absent before a user action, denial emits no Nearby packets, a granted
  snapshot uses only coarse data, and ordinary host discovery reaches guest audio.
- Explicit-off browser suite: 1/1 passed, proving no Nearby UI, location access
  or packets. Web, default frozen Product and explicit-off Product builds passed. Lint: zero errors,
  two existing App.tsx hook warnings; targeted Prettier passed.
- Existing room/adaptive browser journeys with default availability: 16/16
  passed, including desktop/mobile inspection, protected host-only keys,
  embedded Product guest entry, Web Audio capture and wallet-free Join.
  Offline backlog validation and diff checks passed.
- Physical Product Desktop/mobile positioning and independent-network speaker
  output remain **not run**. No deployment or real-position collection.

## Physical-device validation checklist — not run

Use the default build from
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
   90 seconds at response-level expiry, and explicit renewal at the
   selected radius. Test background/pagehide/off/disconnect without auto-resume.
   Give returned rooms different leases: expired cards disappear independently
   while remaining rooms and the position snapshot stay usable.
6. On a separate client/network, find an opted-in host using both selected
   radii, Join without a wallet, and hear the protected host stream with no guest
   source key. Record discover-to-audio latency and actual speaker output.
7. Inspect coarse-only wire/storage output, touch/keyboard/screen-reader paths,
   unsupported-Host copy, city-centre labels, no startup location/traffic and
   explicit rollback-off.

If a Host exposes Location consent without a usable/observable browser bridge,
this slice does not enable native positioning there. A Host-side bridge or a
future SDK coordinate/revocation API is the required follow-up. Do not relax
secure-context checks, invoke internal authorization APIs, or silently select
a city to pass acceptance. Continuous Product positioning stays unsupported.

## Operations and next step

No contracts, content-key authority, signaling schema, shared store, origin or
manifest change. The Product-only flag is removed; `VITE_DOTIFY_NEARBY` and
`SIGNAL_NEARBY` become default-on operational settings. Rollback uses explicit
`off`; snapshots expire within 90 seconds. Audit hosted explicit-off settings
before the next release. See the W19 privacy and W13/#89 room-release gates.

Next: review this continuation, then prepare an authorized device-validation
session. Do not close physical capability gates from synthetic results. No
other roadmap sequence or Statement Store geographic publication was started.
