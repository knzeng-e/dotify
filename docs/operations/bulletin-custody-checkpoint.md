# Capture and verify a data-only Bulletin checkpoint

Use this operator procedure to preserve a **settled multi-release custody
store** before a separately reviewed recovery or delivery. A checkpoint is an
exact copy of private state and retained ciphertext, with a digest that detects
changed bytes. It is not a restorable service or permission to resume writes.

The command is an implementation candidate for #407. It has been exercised
only with generated state; this document does not establish a real backup.
See [the design decision](../adr/0056-data-only-custody-checkpoint.md) and
[source-bound evidence](../backlog/implementation/evidence/bulletin-custody-checkpoint-2026-11-12.md).

## Arrange the maintenance and separate secret recovery

Use the reviewed compiled API revision, Node 22, the custody filesystem's
owning UID and a private terminal. Arrange the service interruption and any
private inspection or transfer within the authorized operational scope. Stop
the complete custody writer and its encoder before inspection; prevent the
supervisor from restarting them until capture finishes. The command takes the
same exclusive publisher lease as custody and never removes another lease.

The selected profile must be the active multi-release domain, with its existing
queue and publisher roots. Every queued job and owned audio/cover/metadata
inventory must be ready, with no active job or pending submission. Unknown files,
temporary files, a legacy pilot profile or unfinished work stop capture. Do not
delete these files or reset a job to make inspection pass. Reconcile the work
through its existing procedure first.

Arrange separate recovery of **all required content-key versions and the signing
key**, and retain the exact compatible image, UID, mounts and configuration.
This command never opens the configured signer or a key vault, and provides no
secret export or key recovery. Its reported key versions identify dependencies;
their presence or usability is not checked.

All source directories and the destination's existing parent must be canonical
absolute paths, owned by the running UID and private (mode `0700` or stricter).
Files must be private, regular and single-link. Resolve filesystem aliases in the
reviewed plan; do not loosen permissions. The destination must not already exist
or overlap a source root, the profile or the configured signer. Use a dedicated
private destination parent outside those sources.

## Inspect, then copy the exact plan

From the reviewed build's `services/api`, supply the actual private paths:

```sh
node dist/scripts/checkpointBulletinCustody.js inspect /PRIVATE/queue /PRIVATE/profile.json
```

The JSON result contains counts, byte size, required key versions and
`planSha256`, without file paths, raw journals or contents. Keep this digest in
the private operational record. Inspection checks profile bindings, admission
lineage, owned inventories and complete local receipts, queue references,
retained-file structure and permanent nonce reservations. Every audio inventory
requires its output generation reservation even when normal cleanup has removed
its ciphertext and queue entry. Retained manifests must name that same generation.
Public covers/metadata are unencrypted and have no output-nonce requirement.
It does not contact
the chain or authenticate ciphertext with a content key.

Use that exact digest for the copy:

```sh
node dist/scripts/checkpointBulletinCustody.js copy /PRIVATE/queue /PRIVATE/profile.json /PRIVATE/checkpoint EXPECTED_PLAN_SHA256
```

Copy repeats inspection under the exclusive lease and refuses a changed plan.
It creates the destination exclusively, writes an `INCOMPLETE` marker, copies
and hashes files in bounded chunks, rechecks the source and reads every copied
object back. Only then does it durably write `checkpoint.json` and remove the
marker. No source job, admission, receipt, counter or nonce reservation changes.
The temporary lease is the only persistent-file write in the source store;
filesystem access times can change during reads.

The result adds `manifestSha256` and the unique object count. Preserve
`manifestSha256` **separately from the copy**, in the private operational record.
Do not derive a replacement expected digest from an untrusted received manifest.
The digest detects changes relative to that retained value; it is not a signature
or proof against a compromised machine or operator account.

The destination contains `checkpoint.json` and `objects/<sha256>.bin`, rather
than a runnable queue tree. The manifest maps logical names and empty directories
to their exact original bytes. It contains private source paths; the copied
profile and state contain account/configuration/metadata information. Keep the
**whole checkpoint private**, even though configured key files are excluded.
Do not upload it to a public Actions artifact or repository.

## Verify independently retained data

Transfer/store the checkpoint only to the reviewed private destination, keeping
file/directory privacy and the separately retained digest. This CLI performs no
transfer and cannot prove the destination is on another disk or account.
Verify the received copy with the reviewed executable:

```sh
node dist/scripts/checkpointBulletinCustody.js verify /PRIVATE/received-checkpoint EXPECTED_MANIFEST_SHA256
```

Verification reads the bounded manifest once, checks its expected digest before
parsing, validates names/ancestry/counts and hashes every unique object. Missing,
extra, linked, changed or incomplete files are refused. It needs neither the
original sources nor application environment, vault or signer. A local verify is
useful but **does not complete independent backup or key-restoration acceptance**.

All successful modes explicitly report `writerActivationAllowed: false`,
`secretsIncluded: false`, `canonicalHistoryChecked: false` and
`independentStorageVerified: false`. The latter fields deliberately remain false
even when verification runs on another machine: storage independence and current
chain history require their own evidence.

## Handle refusal and limits

On failure the CLI exits `1` with `BULLETIN_CHECKPOINT_STOPPED` and a fixed
message; private contents and exceptions are not printed. Preserve the source
and any incomplete destination for diagnosis. An interrupted copy is never
overwritten or resumed; choose a new reviewed destination after resolving the
cause. Never force-remove a publisher lease while another writer might own it.

The implementation accepts at most 64 queued jobs, 192 owned inventories,
8,192 files and 8,192 directories, and 1 GiB of logical source bytes. Each file
is at most 50 MiB plus its 16-byte authentication tag; source JSON is at most
2 MiB and the final manifest 4 MiB. Copy/hash uses one 64-KiB file buffer at a
time; metadata parsing has its separate bounded allocation. Each CLI invocation
has a six-minute deadline. Larger/unsupported stores fail rather than silently
drop state. The defining contracts are
[the file allowlist and I/O](../../services/api/src/services/bulletinCheckpointFiles.ts)
and [state validation and copy](../../services/api/src/services/bulletinCheckpoint.ts).

This scope captures one active, settled multi-release domain. Historical pilot
profiles, their public-asset repair ledgers, other publication domains, secrets,
database/service configuration and externally stored media need separate plans.
Already-pruned ciphertext is not recreated; the copied ready references and
receipts are not proof that remote blocks remain retrievable.

There is **no restore or writer-activation command**. Before recovery, establish
current canonical account/receipt history and compatible binaries, verify the
separately recovered keys, and preserve every newer intent, receipt and permanent
nonce reservation. An older idle snapshot can miss a later broadcast; a matching
offline digest cannot prove freshness. Do not extract a runnable tree and start
custody against it. Actual data/key recovery, service/image rollback, physical
listening and hosted acceptance remain #407 gates. See the
[generated recovery rehearsal](bulletin-generated-restore-rehearsal.md) for the
distinct synthetic restoration proof.
