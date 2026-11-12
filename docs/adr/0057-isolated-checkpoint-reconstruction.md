# ADR 0057: Reconstruct custody data behind permanent publication barriers

- Status: implementation candidate for #407; generated-state validation only
- Extends: [ADR 0056](0056-data-only-custody-checkpoint.md)

## Problem and decision

The data-only checkpoint verifies hashed objects, but does not reconstruct files
for recovery review. Extracting ordinary queue/publisher entrypoints unchanged
could make an old snapshot look ready to publish. Rewriting profile bindings or
initializing new journals would instead destroy evidence of what was saved.

Add offline reconstruction into one exclusively created private directory.
Preserve all original logical bytes, names and required empty directories, with
one explicit exception to materialized names: the profile and two publication
binding files receive a `.checkpoint` suffix. At the two normal binding paths,
write a distinct refusal schema with `writerActivationAllowed: false`. The
normal publication-binding contract rejects those bytes for Bulletin startup and
for an unconfigured Pinata fallback. There is no activation or unseal option.

This is a review workspace, not a live restore target or a sandbox against a
malicious owner. Deliberately altering guards or manually creating another writer
is outside the guarantee. No app config, signer, vault, transport, queue startup
or real-source directory is loaded by reconstruction or verification.

## State and trust flow

Verify the separately retained original manifest digest, bounded schema and input
objects first. Reject source/destination overlap before inspecting destination
parents. Create the private workspace and `INCOMPLETE`, install refusal barriers
before operational data, then copy each planned file with its hash checked.
Separate regular files preserve private-reader single-link invariants; hard-link
deduplication would couple the input and reconstructed histories.

Read back the exact output tree and verify every original byte against the
original manifest. A deterministic `restore.json` binds that digest/plan and false
activation flag. The original manifest is retained locally so later verification
can work without either original state or input checkpoint. Commit completion
only after verification and bottom-up directory synchronization. Failure preserves
the input and incomplete output; no overwritten destination or automatic cleanup
is possible.

Capture and reconstruction share one read-only state validator. A bounded view
maps logical names to physical paths: source roots during capture, reconstructed
files during offline review. The saved profile's absolute directory is never a
read target in the offline view. Original binding bytes are validated under their
preserved suffixes, while the normal entrypoints remain poisoned. Admission lineage,
inventory/counter/receipt rules and nonce-generation checks therefore have one
implementation, including after ready-file/index pruning.

Checkpoint v1 remains unchanged. A logical JSON-size check rejects impossible
oversized metadata before extraction. Existing capture/verify CLI modes retain
their contract; new modes are `restore` and `verify-restored`. No environment or
hosted configuration is introduced. The [runbook](../operations/bulletin-isolated-restore.md)
owns the file layout, limits, commands and failure procedure.

## Alternatives and acceptance limits

A runnable importer would need canonical spending history, secret custody,
mount/UID and image decisions that this slice cannot establish. A generic tar
extraction has neither domain validation nor refusal barriers. Keeping only hashed
objects would preserve integrity but leave file reconstruction untested.

Tests recover standard/compact fixtures after source loss, verify again after
input loss, preserve pruned histories, exercise both ordinary binding refusals
and authenticate retained structural audio with a public test key. Corruption,
overlap, existing output, malformed metadata, incomplete output and hash-consistent
unsettled state refuse. No actual data/key recovery, current canonical history,
service/image rollback, physical listening or hosted acceptance is claimed. An old
idle snapshot can still miss later activity; a matching hash never authorizes
replaying its journals over newer submissions.
