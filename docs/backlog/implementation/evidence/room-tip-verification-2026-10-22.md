# Room tip preparation correction, 2026-10-22

Refs #317. Base dev `9ba2008eb0a9249f7eb630a7139b133cae3c038d`.

## Isolated cause

Read-only quote calls at finalized block 14772476 against the reported runtime
`0xe2E314f369F5dA6A20b7DcE0a4df27812Cc900E7` reproduce the owner feedback.
The active track policy is version 1 with hostBps 1000, but its room authority
and the inherited profile authority are both zero. A direct 2 PAS quote succeeds;
the same amount/work in room context reverts `Contribution: room unavailable`.
This is missing policy configuration, not an outdated runtime. No payment,
signature or policy write was submitted during diagnosis.

## Design

Signaling reads the active work policy and profile fallback. A connected host
with a positive active allocation requires the exact configured proof signer.
Missing/mismatched authority fails explicitly before proof/payment; no silent
redirect removes the host's share. Zero/expired/future host allocation instead
uses direct context, preserving a bounded room intent for verified chat receipts.
Host/track identity is rechecked after asynchronous reads.

`GET /contributions/config` exposes only the configured chain ID and public
attestor address, no secret, with no-store and existing exact-origin CORS.
The artist editor offers explicit selection of Dotify room verification, then
requires the normal signed policy save. A custom authority is never replaced
without that selection. Profile inheritance is preserved; zero effective
authority cannot be saved with host sharing enabled. Generic quote failures no
longer assert that an upgrade is needed or expose truncated contract errors.

## Evidence and remaining gates

- Frontend units: 982 pass, including wrong-network/zero/invalid public authority
  rejection and explicit track versus profile precedence.
- Signaling tests: the full 125-test suite passes; the final targeted rerun
  passes 17 tests including the added public-config HTTP regression. Policy cases cover absent/mismatched
  signer, inherited authority, inactive allocation, host-change races, direct
  tip receipts and exactly-once announcements.
- Chromium: scheduled gift save/reload passes; host-sharing test proves missing
  authority blocks save, explicit selection is not yet a write, then normal
  policy save persists the choice across remount. These are simulated writes.
- Web and frozen Product builds pass. Lint has zero errors and the two existing App E2E hook warnings.

Not deployed. After merge deploy signaling and matching Web/Product, then the
artist selects the work in Rights & support, chooses Dotify room verification
and saves through normal approval. Retry a room tip with a connected host and
verify finalized recipient shares/chat. Do not change live policy as operator.
