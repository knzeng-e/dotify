# Bulletin real-AAC reader canary, 2026-10-30

Refs #288 / #287. Base: `5b6ddec51ba4dfdc2383d7afbaf17996dfdda1a6`
(merged #353/#354). This is a reader experiment, not a storage activation.

## Question and design

The previous live canary proved encrypted storage, recovery and immediate
renewal, but its byte patterns were not AAC. A valid generated eight-second
chord now passes through the existing production encoder and permanent nonce
reservation. The isolated test page injects a CID reader into Dotify's existing
player, retaining manifest authentication, AEAD, AAC readers and managed-source
attachment. The shared directory reader uses Uint8Array in Node and browsers;
it preserves the original bounds and CID checks.

The local reference fixture is 16 blocks / 713,199 stored bytes; root
`bafybeia7ddqnsd3kuq7gigaqoppzu7pyjxcib5ijrh6n6pnwlfwrrks3pu`.
It is a new graph/key/nonce reservation, independent of the previous synthetic
canary. Publication would consume 16 transactions. Preflight reserves another
16 and the same byte budget for an immediate renewal cycle. The former canary
left 62 transactions; current finalized quota/expiry must still be checked.
The private directory is not a repository artifact and its key is not published.

## Trust and operational boundaries

The test server is loopback-only, rejects foreign Host/origin/cross-site/write
requests and serves no production configuration. Its one private synthetic key
is delivered only to the local test page. No production content-key route,
artist account, access policy, Pinata configuration, contract or DotNS record is
changed. Native mode uses the pinned Product SDK preimage API with raw reassembly
disabled; a missing Host or failed lookup cannot select the local control.
Reports contain no key and distinguish native retrieval from local decoding.

The existing publication checkpoints, finality checks and uncertain-write
reconciliation apply unchanged. This is not an unattended writer, recurring
renewal scheduler, production adapter or evidence that sequential publication
scales. The earlier roughly twelve-minute publication remains a limitation.

## Validation

- All 27 existing directory/recovery/quota/renewal tests pass after extracting
  the browser-safe reader.
- Real encoder round trip: three renditions decrypt, decode to at least 7.8
  seconds of non-silent PCM and cross a segment boundary; no master is read by
  selective playback. Re-preparing the same private directory is refused.
- Chromium local control reaches the end, releases its source, stops a second
  attempt and refuses native mode with zero local-block fallback requests.
- Server tests reject foreign origin/Host, cross-site requests, writes and the
  earlier non-AAC fixture. CI runs local codec/control tests only, never a signer
  or live write.

First-playing timings are **media events**, not first audible sound. Headless
Chromium is muted; operator audibility remains unconfirmed. Host caches are
unknown, so this tool cannot declare a cold native measurement. The harness
records date, source revision, selected transport, device/OS/Host/network notes,
reader, object metrics and media events for later physical evidence.

## Remaining acceptance

Live publication/readback of this new graph and physical Product native
retrieval are pending. Mobile needs a reviewed test distribution route;
loopback must not be exposed to the network. Compare audible first sound and
continuity with the current path using the same device/network, then extend to
longer clips and retention-window/scheduled renewal. No W32/W33 or pilot gate
is closed by this preparation.
