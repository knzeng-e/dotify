# 0045 — One exact pre-registration artist-name repair

Date: 2026-11-03. Status: implemented; [one exact pilot permit admitted](../backlog/implementation/evidence/product-0.1.70-rollout-2026-11-03.md); corrected metadata publication and artist registration remain acceptance gates. Refs W33/#288,
[the observed rejection](../backlog/implementation/evidence/publication-artist-name-2026-11-02.md)
and [ADR 0044](0044-bulletin-public-release-assets.md).

## Decision

The generated pilot reached storage with `artistName: Unknown artist`, then the
registry correctly rejected an empty name. #381 now validates release text before
metadata storage. The already stored manifest is immutable and the existing
policy admits one graph; editing the name in the client cannot repair it alone.
The owner selected **Thot Nzeng**. Preserve the prepared audio and cover, rather
than recreating encrypted media or changing the contract's identity requirement.

Add a maintenance-only `inspect` / `admit` command. Under the same exclusive
publisher lease as custody, inspection reconstructs the original graph, checks
its ready inventory/receipts, original scope and allowance, and refuses every
pending account intent or writer lock. Only the literal `Unknown artist` defect
can be repaired; the title and track note must already be valid. Derive the new
manifest by changing only the artist name, retaining its original timestamp and
all audio, cover, access and royalty fields. The plan identifies both roots and
the exact additional graph/byte cap; its hash also binds every existing inventory
and the account cursor. A changed plan or nonce state requires fresh inspection.

`admit` requires that exact hash and adds one exclusive-created, fsynced
`metadata-name-repair.json`. No original sidecar, profile, asset policy, queue,
receipt, attempted-store counter or security reservation is rewritten. Admission
uses no Bulletin signer or transport and submits no transaction. The permit is
an additional allowance for one named graph, never a replenished old allowance.
A duplicate admission is refused, including after the new graph is claimed.

## Actual publication and canonical authority

Normal authenticated artist upload grants still initiate publication. Custody
checks the immutable permit and original policy before loading its signer, and
rechecks the permit before public work. Only metadata matching the approved
manifest in every field except the client's regenerated timestamp is admitted.
The writer stores the reviewed bytes, so retries address the same CID/job. Cover
admission and the one-audio-job restriction stay unchanged. Existing nonce,
receipt, attempted-write and unknown-broadcast recovery remains authoritative.
Retained renewal obligations include both old and corrected metadata inventories.

Inspection, admission and corrected-metadata publication require the expected
chain ID, directory mapping and explicit `musicRegIsRegistered == false` on
both finalized and latest canonical block hashes. Missing selectors, unreachable
RPCs and ambiguous results fail closed; catalog absence is never evidence of an
unregistered track. These observations do not reserve the artist wallet: a
concurrent later registration can still produce an orphan metadata graph. Its
cost is bounded, and the command never mutates an on-chain reference. Keep the
artist from signing independent registration during the intervention, and verify
registration/reference state again after publication.

## Persistence, rollback and alternatives

The permit and all original/replacement inventories belong in coherent backups.
An interrupted partial permit fails validation; it is not automatically removed
or overwritten. Admission must happen with custody stopped. Removal or corruption
of an active permit refuses new work; restart with two metadata inventories and
no permit fails before signer loading. Do not delete the original sidecar or an
inventory, reset counters, restore an older nonce snapshot, or use a second
publisher to bypass a barrier. Old code continues refusing the second graph:
rolling back code does not authorize any state deletion or new metadata graph.
Already issued public references remain served by the unchanged asset reader.

Deleting the first graph or replacing its sidecar would hide prior expenditure
and renewal obligations. A mutable metadata URL would weaken content identity.
A general editing service would expand admission and spending far beyond this
one pilot defect. This exception instead binds one name and manifest; it does
not implement public editing, additional releases or automatic renewals.

## Activation boundary

[The runbook](../operations/bulletin-public-assets.md#exact-artist-name-repair)
records review, exact-source CI, backup, maintenance and separate network-write
approval. The known public manifest reconstructs a two-block / **1,101-byte**
replacement; its real inspected plan hash and current quota must be reviewed
before admission. A future renewal of those two blocks must also be reserved.
No maintenance, permit installation, store, renewal, DotNS change or wallet
registration is performed by this implementation PR. Capacity remains research.
