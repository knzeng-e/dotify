# Account 0.1.90 execution blocked before signing — 22 November 2026

**The owner approved the exact plan, but 0.1.90 is not published.** Source
`ecba4ea0465fba154de65a7db7232be62f854acb` has green full CI and its frozen
artifact is intact. Fly's machine-update API repeatedly returns **HTTP 408**
while changing the stopped custody machine to the isolated idle command.
The [structured observation](host-account-0.1.90-execution-blocker-2026-11-22.json) binds actual state, snapshot,
chain nonces and provider request IDs. This is not a publication receipt.

## Completed and unchanged

The newly authorized snapshot **`vs_kAge1Jea58GCKoAalV13`** is created with
14-day retention. Its first response scheduled asynchronous work; its ID was
reconciled and allowed to finish without issuing a second snapshot request.
The single-snapshot allowance is used; do not create another during recovery.

The first idle update returned 408 and briefly left the machine `replacing`.
A non-destructive same-machine metadata reconciliation restored `stopped` and
the original runtime configuration. Further idle updates, including explicit
command and a new metadata value, also returned 408. This used the same
machine/image/volume and did not destroy, clone, migrate or start the old app.
The [Fly troubleshooting guide](https://docs.fly.io/getting-started/troubleshooting#stuck-machines)
documents metadata reconciliation; that recovery succeeded for the original
state, but did not clear the subsequent idle-update failure.

Final provider readback verifies `dotify-custody` machine `e82d13d0c61238`
**stopped**, volume `vol_491jo391o8leqe5r` retained, no active lease, and unchanged
image/environment/command/guest/mount/check/restart/DNS configuration. A temporary
reconciliation metadata label is the only configuration difference. The old
API/publisher never started. Protected files could not be compared in this
attempt because the idle process never started; do not substitute yesterday's
fingerprints for a new comparison.

No actual custody readiness check, private signer loading, signing permit or
publication journal was reached. Fresh public reads still show native app
**0.1.89**, Bulletin nonce **2160** and native nonce **504**: zero admitted
storage operations and zero DotNS signatures were submitted. No artist runtime,
music, new key/profile or CASH activation occurred.

## Safe continuation

The [plan](host-account-0.1.90-publication-plan-2026-11-22.md) remains explicitly
approved for the same frozen artifact and remaining five-operation/two-signature
scope; merging this record is not a new operation. Retain its private approval,
intent and reconciliation records. Resolve Fly's in-place stopped-machine update
failure before resuming. Reuse the completed snapshot while valid and require
fresh CI/Host/owner/quota/nonce/receipt and unsigned custody/protected-state checks
before loading the installed signer. Do not retry the single snapshot creation,
start the retired API, export a seed, or substitute another machine/volume as a
workaround under this plan. An uncertain future signing outcome would require
its own durable-journal reconciliation before any retry.

No new phone test is requested: the account-address page is not delivered.
#85 and #317 remain open, with their native/account/signing/media gates separate.
The snapshot does not complete the independent recovery or PostgreSQL gate.

## Provider support draft

The following is prepared for the owner to send; no support message was sent.

> Please investigate in-place Fly Machine update HTTP 408 failures for app
> `dotify-custody`, machine `e82d13d0c61238`, volume `vol_491jo391o8leqe5r` (AMS).
> The machine is stopped with its original runtime config and no active lease.
> Updating only its command to an isolated idle Node process with `--skip-start`
> repeatedly times out. A metadata update restored a transient `replacing` state,
> but subsequent command updates still return 408. Initial request:
> `01M81XNDBMGP47FWHGR5TRRS1E-cdg`, trace
> `9dd3e8f2df78c20654f086952146bc4e`. Later request IDs are in the linked record.
> Please diagnose the worker/update operation in place. Do not destroy, clone,
> move the volume or start its retired original API/publisher. A completed
> 14-day snapshot exists; no blockchain signing has started.
