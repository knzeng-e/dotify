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

- 19 targeted unit tests passed: existing/new Product and extension sessions,
  changed identity/network, missing session service, busy and disconnected
  transport, acknowledgements and exact session scoping.
- Three real-browser room-life scenarios passed, including a guest kept on
  fetch polling with POSTs delayed 250 ms, concurrent typing and three distinct
  chat messages delivered exactly once and drafts cleared after confirmation.
- Ordinary and frozen Product builds and targeted lint passed. Existing bundle-size and upstream
  annotation/Browserslist warnings remain.
- Product 0.1.46 is a frontend candidate, not deployed. Physical Product Host
  artist entry and room chat validation remain required after publication.
