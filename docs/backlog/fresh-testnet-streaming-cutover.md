# Clean testnet catalog and streaming cutover

Owner request: 2026-10-21. Issue #317, refs #287 and #285.

## Outcome

Start the next test with an empty artist directory and new artist runtimes,
then publish new music through W32 streaming. Existing deployments, encrypted
IPFS files, old entitlement state and claims are retained for rollback; none
is imported into the new directory. This is an intentional test-environment
reset, not an in-place artist runtime upgrade.

## Delivered preparation

Ten fresh core contracts and the factory/directory wiring are deployed on
chain 420420417. All ten source verifications passed. The finalized audit finds
zero finalized and pending runtimes and verifies the owner-guard source and
factory/directory pairing. CDM's two existing names now resolve to the fresh
addresses at version **2**, under the same publisher; metadata bytes/CIDs are
unchanged. See the [public evidence](../operations/fresh-testnet-2026-10-21.md).

Configuration and Product snapshots must agree on the exact new addresses and
versions. Product generation fails on an address/version mismatch instead of
inventing version one. Browser catalog caches include the directory in their
identity; the frozen Product bootstrap is empty, matching the fresh directory.

## Release gate

The coordinated 2026-10-22 rollout activated API 29, signaling 37, private
encoder 1 and Product 0.1.58 on the new directory; the empty index is healthy.
Same-volume non-root migration and streaming custody initialization preserved
existing key/receipt/session history. See the operational rollout record.

The first real Product artist attempt reached bootstrap stage 7, then exposed
a native SDK deposit-sizing error. The [correction evidence](implementation/evidence/product-artist-bootstrap-2026-10-22.md)
isolates the peak-versus-net deposit mismatch by read-only replay. Publish the
reviewed client correction before retrying the same pending runtime; no new
factory or artist runtime deployment is needed for that retry.

After cutover, the owner creates a fresh artist space and publishes a new v3
release. Verify individual playback, protected denial, room-host access,
walletless guests, artwork, announcements and native Product signing/audio on
physical Desktop/mobile. These acceptance results, not deployment alone, allow
this issue to close. The small empty bootstrap is not a claim of a populated
or pilot-ready catalog.
