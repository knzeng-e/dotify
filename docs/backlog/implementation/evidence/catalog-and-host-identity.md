# Catalog actions and Product host display identity

- Scope: follow-up to W10 / #151 and the delivered wallet identity card.
- Base: `8ff75de4a61269c4bf1f353f2b11c670ba7d5a1b` (`dev`, merged #169).
- Branch: `fix/catalog-play-and-host-identity`.
- Implementation commit: `2ce8ad11d8a5c214415b38c46865e3074f2c7756`.
- PR: [#170](https://github.com/knzeng-e/dotify/pull/170), targeting `dev`.
- Design and SDK decision record: [clear covers and a personal connection](../../../design/catalog-and-host-identity-2026-09-15.md).

## Boundaries

No contract, payment-policy, backend, deployment or environment configuration
changes. The optional host profile read is presentation only. Real access checks,
explicit payment confirmation, guest stream isolation and accepted room aliases
remain authoritative. Product account names are not identity attestations.

## Validation

- Unit suite: 458 tests / 59 files passed, including optional host profile reads.
- Chromium core suite: 71/72 initially passed. The remaining test still expected
  the price on the card; after moving that assertion to the existing access
  screen, all four Classic scenarios passed (including zero key requests before
  access, price before payment, verified unlock and paid-but-denied behavior).
  Final-SHA CI reruns the complete 72-scenario suite.
- WebKit: 30/30 responsive/discovery/player/room scenarios passed.
- Product identity: 10/10 browser cases passed across Chromium and WebKit,
  mounting the real app and installed SDK adapter. Covers optional naming,
  refusal, same-account reconnect, late reply after disconnect, saved aliases,
  another account, long names at 360px, draft preservation and extension events.
- Lint: no errors; three pre-existing hook dependency warnings in App/ArtistShell.
- Formatting and diff whitespace checks: passed.
- Web and Product DevNet builds: passed on the implementation commit, without
  refreshing the catalog bootstrap. Existing large-chunk and dependency PURE
  annotation warnings remain.
- Production environment smoke: passed (missing endpoint/secret exposure guards
  and safe public build). Test fixture strings absent from both built outputs.
- Backlog offline check: passed with baseline warnings (24 unmapped items and
  duplicate numbered 08 documents).
- Visual inspection: clear touch covers at the end of the row, one desktop Play,
  room guest release details and host name in the editable room sheet. Captures
  are linked in the design record. The catalog artwork is deterministic test data.

Initial test adjustments were assertion-only: an ellipsis format, the room
sheet's Cancel label and the deliberate move of catalog prices. No checks for
payment, key access, room continuity or naming were removed.
Native Product Mobile / physical iPhone acceptance is not run in this environment.
The deterministic browser fixture uses the installed SDK adapter and an explicit
test host, not a real wallet or signing device.

## Follow-up

W10 remains open for physical-device and native-host acceptance. This PR does not
close the wider pilot checklist or start another strategic feature sequence.
