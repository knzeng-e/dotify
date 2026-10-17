# W19 physical-feedback follow-up — 2026-10-17

This follow-up starts from tested `dev` `3b0bb68`. It is not a deployment record.
It responds to physical feedback on Product 0.1.52 and Web: missing cover planets,
inconsistent sweep, changing visibility, native location failures and artist
activity that excluded private/out-of-range rooms. Refs #274 and #257.

## Delivered behavior and limits

- The radar and list show circular cover artwork and exact connected presence.
  Presence includes the host; it is not unique people or measured listening.
  Decorative orbit points match ordinary room capacity, bounded at 128 for
  unusually large operator-configured rooms; the numeric label remains exact.
- The center reuses the header's actual SVG mark at the same size, rendered in
  cyan neon. At rest, room labels show just the track title and artist. Hover
  or keyboard focus reveals full title/artist, host, exact presence and scope/
  distance in a superimposed card; Escape dismisses it without moving focus.
  Touch opens the existing room preview. Cards align inward/upward at outer
  slots and can cross the decorative circle without clipping. Globe/radar
  icons accompany scope metadata. The own-room badge uses the active room ID and
  returns to playback without rejoining. Eight illustrative radar slots retain
  stable positions; the full list retains all returned rooms. Above four rooms,
  smaller cover planets leave space for the two-line labels on mobile.
- A live sweep runs between scan acknowledgements, respects reduced motion and
  pauses when discovery/background state requires it. It is an illustration of
  the active discovery subscription, not a measured physical sweep.
- Host intent is separate from its short server lease. Nearby/Everyone remains
  selected across expiry, backgrounding and disconnects; explicit Link only or
  room closure clears it. Recovery requires a fresh permitted fix, never stale
  coordinates. Denial, unknown permission or unavailable native location shows
  an honest unavailable/retry state. No background location collection.
- Discovery v4 adds exact `listenerCount` (excluding host) and validated public
  canonical `imageRef`. V2/v3 retain their original response shapes. Artwork
  enrichment waits at most 300 ms, so a slow registry does not hide invitations.
  Coalesced metadata reads have a 30-second cache and bounded concurrency.
- The separate `artist:rooms` read validates the existing signed session and
  artist-runtime ownership. Aggregates include hosted rooms carrying canonical
  releases, including private rooms and paused playback. Only opted-in public
  rooms return invitation details, regardless of radius. No private IDs, names,
  location, artwork or participant details leave the server. Connected sessions
  include hosts. This does not measure completed plays or royalties.
- Artist snapshots refresh every five seconds while visible, with account,
  disconnect and unmount cancellation guards. Session verification is cached at
  most 20 seconds and never beyond signed expiry. Up to 100 public cards are
  returned; aggregate totals can exceed that list. Failure displays unavailable,
  not a fabricated zero. Missing sign-in requires an explicit user action.

## Native Product location audit


- Exact installed Desktop checked read-only: `/Applications/Polkadot Desktop Dev.app/Contents/Info.plist` and embedded `app.asar/package.json` both report 0.1.3. The embedded main.cjs maps Electron geolocation to DevicePermissionType Location and calls the asynchronous per-product permission gate. Its synchronous permission-check handler returns false except clipboard, matching current public source. No real location or permission prompt was requested.
- Public Desktop source: https://github.com/paritytech/polkadot-desktop-community/blob/7843faea2c2cf180cc98bc95e68b50c61e810395/main/sandbox/index.ts and `main/sandbox/lib.ts`. Public releases/tags did not establish a source tag for the installed 0.1.3 package, so HEAD must not be presented as the exact installed build.
- Both locally installed Desktop bundles (Dev0.1.3 and public1.0.0-rc.1) lack NSLocationWhenInUseUsageDescription/NSLocationUsageDescription in Info.plist. Embedded Dev main.cjs contains no GOOGLE_API_KEY setup string. Neither observation proves that a runtime-injected key is absent, but a frontend SDK permission grant cannot supply an Electron location provider.
- Electron documents the required host geolocation service configuration at https://www.electronjs.org/docs/latest/api/environment-variables#google_api_key. This is a Host responsibility; do not add credentials or IP-location fallbacks to Dotify.
- Trinity inspected commit a12214e1332b853afe8c65e1295354554614451d. iOS `OSPermissionAsker` explicitly returns true for .location while a TODO says the native bridge and real OS prompts are still to be implemented: https://github.com/paritytech/trinity-user-agents/blob/a12214e1332b853afe8c65e1295354554614451d/hosts/ios/polkadot-app/Modules/Products/Permissions/OS/OSPermissionAsker.swift . This explains why a positive SDK grant is insufficient; it is upstream evidence, not physical proof of the user's mobile0.10.0 package.
- Android `ProductWebChromeClient` handles camera/microphone PermissionRequest but does not override onGeolocationPermissionsShowPrompt in the inspected file: https://github.com/paritytech/trinity-user-agents/blob/a12214e1332b853afe8c65e1295354554614451d/hosts/android/feature/products/impl/src/main/java/io/paritytech/polkadotapp/feature_products_impl/domain/webView/ProductWebChromeClient.kt . No claim is made that all Android paths are unsupported; native-coordinate evidence remains required.
- Public Trinity0.10.0 tags refer to TruAPI packages, not the mobile app version; mapping user mobileApp0.10.0 to an exact native source was not established. No Host was updated or permission setting changed.

Implemented frontend response: distinguish a denied location from a Host that grants but cannot return a fix; retain the chosen host visibility while marking it unavailable; offer explicit Find Nearby in browser using the existing Host navigateTo API and configured public app URL. Copy says hosting/account remain in Product. Only the public route/room ID transfers, never session/host tokens or location. No automatic handoff, IP geolocation, or fake/coarse fallback location. Native location inside these builds remains unverified/unfixed until the host provides a working native coordinate path.

## Validation

Visual-refinement follow-up to `7154fb1`: all six RoomRadar unit tests, Web build,
targeted ESLint and formatting pass. The real two-room Chromium scenario passes
with hover transfer, focus, Escape, accessible descriptions, axe, exact counts
and mobile preview/return. An isolated eight-room fixture with long title/artist
strings was inspected at 390 and 1440 px: no label/neighbor-cover intersections,
no horizontal overflow, and all 16 animated node-to-tooltip transfers pass.
The unchanged mark geometry is checked against the header. Screenshots and
geometry/accessibility evidence: `/private/tmp/dotify-radar-refinement/`.
The broader validation below records the preceding implementation; backend
behavior is unchanged by this visual refinement.

- Full frontend unit suite: **986 passed** across 125 files. It covers stable
  visibility intent, permission/fix failures, stale callbacks, schema negotiation,
  exact presence, own-room UI, artist session lifecycle and strict snapshots.
- Full signaling suite: **114 passed**. Live sockets prove private aggregates are
  owner-only, public Nearby invitations cross the artist's radius, exact counts
  change with presence, and opt-out/track changes invalidate pending results.
  Invalid claimed releases cannot poison the entire artist dashboard.
- Discovery browser scenarios: **6 Web + 3 Product fixture cases passed**.
  The own-room scenario was run separately after fixing its test navigation:
  immersive hosting requires Browse before Rooms. The original five Web cases
  passed together. These exercise real guest WebRTC audio, absence of content
  keys/precise coordinates, live animation after fast replies/navigation,
  reduced motion, two same-track rooms, own-room return and missing native fixes.
- Room-life and mobile-accessibility suites: **40 passed** at 390 px and 1440 px,
  including artist invitation/announcement, chat interactions and contrast.
- Web and frozen Product builds passed. ESLint passed with two pre-existing
  `App.tsx` dependency warnings; existing bundle-size warnings remain.
- Desktop/mobile galaxy screenshots were inspected at
  `/private/tmp/dotify-feedback-visuals/cover-galaxy-desktop.png` and
  `/private/tmp/dotify-feedback-visuals/cover-galaxy-mobile.png`. They use fixture
  fallback artwork; canonical IPFS artwork is covered by server/schema tests.
- Firefox was installed and attempted, but its process could not initialize in
  this execution environment (`sandbox_extension_issue_file_to_process`,
  framebuffer error, launch timeout). No Firefox application assertion ran;
  a real Firefox check remains required.

Native prompt/fix/revocation behavior still requires the user's exact Desktop
and mobile builds; browser fixtures do not establish those capabilities. The
installed Desktop audit and upstream sources are evidence of boundaries, not a
claim that native geolocation is now repaired. The PR records the final tested
implementation SHA.

## Rollout

Deploy signaling with v4 and `artist:rooms` support before Web/Product. Existing
session API, directory and RPC configuration are reused. No new credential,
location service or Redis store is introduced. Keep the native-coordinate gate
open until an actual authorized fix, revocation and foreground recovery are
observed on both target Hosts. Do not claim nearby matching from shared Wi-Fi.
