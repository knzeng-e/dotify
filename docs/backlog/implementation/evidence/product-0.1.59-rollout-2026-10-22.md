# Product 0.1.59 artist bootstrap correction, 2026-10-22

Refs #317. Product-only follow-up to the coordinated 0.1.58 streaming reset.
Source: merged dev `9ba2008eb0a9249f7eb630a7139b133cae3c038d` (#323).

## Prepared scope

Executable `[0,1,59]` keeps product-cdm/devnet, existing permissions and the
frozen empty catalog. The shared Product contract adapter uses the successful
native dry-run peak storage deposit, preserving failure and signer boundaries;
factory writes wait for finality. See [the isolated cause and validation](product-artist-bootstrap-2026-10-22.md).

This publication does not restart API 29, signaling 37 or private encoder 1,
change contracts/CDM, recreate an artist runtime or submit the artist's write.
The existing pending runtime must resume through the artist's normal approval.
The [0.1.58 record](product-0.1.58-rollout-2026-10-22.md) retains server/custody
and reset evidence. A rollback to 0.1.58 restores the known bootstrap defect;
pre-reset clients are not a standalone rollback for the new directory.

## Publication gate

Prepared, not yet published. Record the clean packaging SHA, exact CI/build
checks, finalized root/app CID/version, independently retrieved public CAR
hashes and index/entry identity, and local signer cleanup after publication.

## Remaining acceptance

The artist retries the existing stage-7 setup. Confirm pending stage clears,
the directory registers that same runtime and its owner is the artist. Only
then validate real original publication, playback and value flows on physical
Product/Web. No operator approval substitutes for that evidence; #317 stays open.
