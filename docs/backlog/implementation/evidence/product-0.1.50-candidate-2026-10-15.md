# Product 0.1.50 radar/audio candidate — 2026-10-15

## Identity and scope

- Tested application base: `99658622d120c043854a75c071de6e790623ad47`,
  merged #280/#281. All dev quality gates passed in
  [run 38729444931](https://github.com/knzeng-e/dotify/actions/runs/38729444931).
- Branch: `release/product-0.1.50`; executable `[0, 1, 50]`.
- Domain: `dotify-test01.dot`; runtime `product-cdm` on `devnet`.
- Refs #274, #88 and #89. This release preparation does not close their
  physical-device acceptance gates.

The version bump gives installed Hosts a distinct identity for private room
creation, consented Nearby radar and complete-body audio recovery. The public
bootstrap catalog now contains 13 items and is frozen together with its
reproducible offline fixture. API catalog refresh remains authoritative; the
snapshot grants no access or payment authority. Netlify drops its retired
Paseo IPFS fallback; Pinata remains first and the reader filter remains active.

## Read-only preparation

- DevNet endpoint smoke passed all six checks, including EVM chain 420420417,
  current blocks and the configured directory/factory bytecode.
- Live Product Remote Config matched the pinned CLI 0.20.0 and the tracked
  Host-facing DotNS override. Registry:
  `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73`; content resolver:
  `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5`.
- Netlify already served application base `9965862` at preparation time.
- The API remained healthy on `fc7faf5a49e6d5b3392285bab2ee957d325b4cb6`;
  this follow-up changes neither API source nor contracts.
- Signaling was healthy on release 30 with one worker and zero active rooms.
- The DotNS signer was absent. No signing phrase was read or stored, and no
  publication, paid action or real-location collection occurred in preparation.

Local candidate checks passed: 934 unit tests in 120 files, 20 Product deploy /
Host guard tests, production environment smoke, targeted lint/formatting,
offline backlog and diff checks. The offline fixture reproduces the frozen
catalog byte-for-byte with repository formatting. Product journey static gates
passed; physical payment and room inputs remain blocked/not-run as expected.

The exact final build commit and CI results belong to the PR and its checks.
A build from this version alone is not publication evidence.

## Publication sequence and acceptance

1. Validate and record the exact committed release candidate.
2. Recheck active rooms, deploy one signaling worker from that candidate, and
   verify health, source SHA, global-list non-enumeration and invitation join.
3. Publish the frozen Product artifact with the local owner signer; read back
   the finalized CID and executable version independently. Remove the local
   signer after publication. Verify the matching Web identity separately.
4. Reopen physical Desktop/mobile Hosts and record loaded SHA/version/CID.
   Test default privacy, explicit visibility, both radii, opt-out, background /
   reconnect, artist invitations and multi-track audio with recovery.

No original asset is repinned by this preparation. The unavailable “Le Singe
Fou” cover needs separate storage repair. Automated continuity tests do not
prove the cause or resolution of every physical Host interruption.

## Rollback references

- Last published Product 0.1.49:
  `bafybeigm4ndvikxjf5w44clzy4mkizmsbploxrrqswftumqxieyxhqmicq`.
- Last signaling image:
  `registry.fly.io/dotify-signal@sha256:2b9378ae8de991102a9586707be320348e5d5053b8954d1f1cf3bfb0226396dd`.

Restart clears ephemeral rooms/chat/discovery. The old signaling image restores
global enumeration; it cannot support a privacy-preserving rollback promise.
Keep `VITE_DOTIFY_ROOM_REALTIME=off`. Retain the fixed private signaling server
if rolling back a client, and verify that client's discovery behavior separately.

Next: publish only from the validated candidate, then append actual rollout
and physical acceptance evidence without treating this plan as a live result.
