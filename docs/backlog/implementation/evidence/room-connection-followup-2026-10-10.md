# Artist entry and room chat recovery — 2026-10-10

Scope: #257 room-life implementation, #89 room reliability. Source: tested dev
`a1866dd8497a64052bfc03b3d367be7a5f30f002`. Owner reported an artist visit
blocked by a reconnect message and intermittent room chat delivery failures.

## Findings and correction

Artist entry only read the cached Dotify session, although account connection
does not itself create a backend session. Announced Join now reuses the exact
account/chain/signing-identity session or opens the normal reusable sign-in
session after that explicit action. Valid sessions require no further approval.
Ordinary entry remains unsigned. Account/network mismatch, closing the sheet,
unmounting or a failed sign-in cannot continue the pending artist navigation.
The server still verifies identity and registered release ownership before
announcing the artist; the frontend cannot grant a badge.

Chat and catalog suggestions used volatile requests, which Socket.IO drops
when a polling POST is already in flight. Connected-only acknowledged requests
now survive that backpressure. Disconnected requests remain unbuffered, missing
acks retain the draft, and no uncertain send is retried automatically. Ephemeral
typing and reactions keep volatile semantics.

## Evidence and release boundary

Follow-up owner report: Product tips requested an EVM wallet. The published
0.1.45 release used the default viem profile, while earlier native-tip releases
explicitly used product-cdm. Release 0.1.46 now pins `product-cdm`/`devnet` in
the tracked Product environment and rejects other adapter settings at build
time. Ordinary web remains viem; native signer mapping, finality and historical
receipt checks are unchanged. This prevents the profile regression from silently
shipping again and never retries existing pending payments.

- 19 targeted unit tests passed: existing/new Product and extension sessions,
  changed identity/network, missing session service, busy and disconnected
  transport, acknowledgements and exact session scoping.
- Three real-browser room-life scenarios passed, including a guest kept on
  fetch polling with POSTs delayed 250 ms, concurrent typing and three distinct
  chat messages delivered exactly once and drafts cleared after confirmation.
- Ordinary and frozen Product builds and targeted lint passed. Existing bundle-size and upstream
  annotation/Browserslist warnings remain.
- Native contribution flows, receipt reconciliation, Product runtime writes and
  writer selection: 53 tests passed. Product profile/journey/CASH guards:
  44 tests passed. CASH remains externally blocked; this uses native Revive
  payments rather than an unsupported CASH-to-access shortcut.
- All PR and post-merge `dev` CI gates passed, including Playwright and the live
  Product Host configuration check.

## Published release

- Product version: 0.1.46; clean source
  `e5d92b5af2a8f9c2b9860db8d0ee91163c2f08b3`.
- Executable CID:
  `bafybeif3sjmbjz3hmpcnozz2btkewimxr3a4xy5pjia47pxgqfe636voty`.
- Bulletin stable upload: block `1159609`, transaction
  `0x948a75fe6a73827203d8958df9210faaab0afc9d54c8dae68fa739108ac97003`.
- Bulletin full-CAR root: block `1159612`, transaction
  `0x4255259f8134c7a0edc5f23a9ede4b8484e28e26aa1ac17ac95318de786ea7a0`.
- Asset Hub content link: block `14274629`, transaction
  `0xc3724b5ccb63d0d5be278bcafd53d3d1dd4d2db9e66dc99c9ee9b9e96dfc3f3f`.
- Atomic executable manifest transaction:
  `0x59fa755d7761c39ef21a8f658f61ef3266eba8ebeb0f7da111233a0831d60acd`.
- All 24 content nodes reached GRANDPA finality; P2P retrieval passed in 44 ms.
- Independent public CAR read: 14,599,935 bytes; all 77 files match the local
  published artifact byte-for-byte.
- Remote Config matched before/after publication. Netlify serves the same
  application source SHA and passes a mobile Chromium load without page errors.
- The public Product wrapper loaded its application frame without page errors;
  the served entry bundle contains the exact source SHA, `[0, 1, 46]` and
  `product-cdm`. This confirms the release profile actually served, not a
  completed installed-host payment.
- Frontend-only deployment; API, signaling, contracts and payment journals were
  not migrated. The locally supplied signer environment was removed afterward.

Installed Product Desktop/mobile artist entry, native payment approval/finality
and chat during transport interruption still require device observations. Check
the loaded 0.1.46 source SHA before attributing those results to this release.
