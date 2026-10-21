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

The Web/API/signaling/Product services still use their existing live releases.
Merge and validate the W30 non-root/storage prerequisite and W32 new-publication
path before the coordinated cutover. Prepare the new isolated encoder and
permanent nonce custody; preserve the old catalog/receipt/session files and
secrets. The backend's new-directory index must be healthy before publishing
clients. Do not refresh the bootstrap from the old API during packaging.

After cutover, the owner creates a fresh artist space and publishes a new v3
release. Verify individual playback, protected denial, room-host access,
walletless guests, artwork, announcements and native Product signing/audio on
physical Desktop/mobile. These acceptance results, not deployment alone, allow
this issue to close. The small empty bootstrap is not a claim of a populated
or pilot-ready catalog.
