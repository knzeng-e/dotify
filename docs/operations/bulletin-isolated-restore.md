# Reconstruct a Bulletin checkpoint for offline review

Use this operator procedure to recover the files and history from a verified
data-only checkpoint into a **new private review workspace**. It can operate
after the original custody paths are gone. It does not restore an operational
service, install keys or authorize another publication.

This is a #407 implementation candidate tested with generated state only.
[ADR 0057](../adr/0057-isolated-checkpoint-reconstruction.md) explains the design;
[source-bound evidence](../backlog/implementation/evidence/bulletin-isolated-restore-2026-11-12.md)
distinguishes file recovery from real data/key and service recovery.

## Before reconstruction

Obtain the complete private checkpoint and its **separately retained
`manifestSha256`**, using the [capture/transfer procedure](bulletin-custody-checkpoint.md).
Do not compute a replacement expected digest from an untrusted received file.
The checkpoint and reconstructed workspace contain private metadata and source
paths even though configured key files are excluded. Keep both private.

Use Node 22, the reviewed compiled API revision and the filesystem's owning UID.
No application environment, key vault, signer, live custody access or network
connection is needed. The destination's existing parent must be an owned private
canonical directory; choose a **new** destination. Existing destinations, aliases
and overlap with the input, saved custody roots/profile or signer are refused.
The command checks saved paths as strings; it does not open or recreate them.

This is filesystem/workflow isolation, not a kernel security boundary against a
malicious same-UID process or operator. Keep real service supervision, credentials
and signing material outside the review environment. A successful reconstruction
is never permission to start custody against it.

## Restore into a new private workspace

From the reviewed build's `services/api`:

```sh
node dist/scripts/checkpointBulletinCustody.js restore /PRIVATE/checkpoint /PRIVATE/review-copy EXPECTED_MANIFEST_SHA256
```

The command verifies the bounded manifest and all input objects before creating
the destination. It creates an `INCOMPLETE` marker and publication refusal
barriers with their directory entries durably synchronized, copies every planned logical file to a separate regular file, reads
the output back and applies the **same local state validator as capture**.
Profile/admission bindings, inventories/receipts, counters, permanent nonce
reservations, retained ciphertext structure and required empty directories must
remain coherent. Output reservations remain required after normal ready-file and
queue-index pruning. Nothing is initialized, re-encoded, retried or refunded.

Only after verification and filesystem synchronization does the command remove
`INCOMPLETE` and return a successful filtered JSON report. Failure keeps the input
unchanged and leaves any partial destination for diagnosis. There is no overwrite,
resume or automatic deletion of an existing workspace.

## Understand the recovered layout

```text
review-copy/
  checkpoint.json                 exact original manifest
  restore.json                    deterministic data-only receipt
  data/
    profile.json.checkpoint        exact original profile
    queue/
      publication-store.json      refusal barrier
      publication-store.json.checkpoint
      jobs.json
      jobs/...                    retained files, when present
      nonces/...
      recoveries/...              when present
    publisher/
      publisher.json              refusal barrier
      publisher.json.checkpoint   exact original binding
      owner.json
      release-admission.json
      ...                         original inventory/admission/metadata files
```

Every original file retains its exact bytes. Three entrypoint files use the
`.checkpoint` suffix: the profile and the queue/publisher publication bindings.
At the ordinary binding filenames, a distinct data-only schema makes the normal
publication-binding contract refuse startup. The queue marker also prevents an
unconfigured caller from treating the directory as a Pinata queue. No original
profile is rewritten to point at the new directory.

These barriers prevent ordinary activation through that contract; they do not
stop someone deliberately removing guards or constructing another writer by hand.
Do not rename the preserved bindings, remove the barriers or pass the recovered
profile to a service. A writable operational restore requires a different,
separately reviewed procedure with current chain history and usable keys.

## Verify after transfer or input loss

Keep the same original manifest digest separately. The reconstructed copy
contains the original manifest, so verification no longer needs the hashed-object
checkpoint or any original custody path:

```sh
node dist/scripts/checkpointBulletinCustody.js verify-restored /PRIVATE/review-copy EXPECTED_MANIFEST_SHA256
```

Verification checks exact membership, privacy, ordinary regular files, hashes,
empty directories, unchanged barriers/receipt and the shared local state rules.
It reads original binding bytes from their `.checkpoint` files through a bounded
view. All physical reads stay within the workspace; saved profile paths are
metadata, not filesystem instructions.

Both commands report `isolatedRestore: true`, `writerActivationAllowed: false`,
`secretsIncluded: false`, `canonicalHistoryChecked: false`,
`independentStorageVerified: false` and `ciphertextAuthenticated: false`.
Counts and byte size refer to original logical data, excluding the control files.
The last flag remains false because this tool never obtains a content key.
Structural reservation presence cannot authenticate a key fingerprint without
that key. Hash consistency alone is not sufficient: an internally hashed but
unsettled inventory is rejected by local state validation.

## Generated independent-runner acceptance

The [backup workflow](../../.github/workflows/bulletin-backup-restore.yml) includes
separate generated checkpoint producer/consumer jobs. The producer uses the
compiled capture CLI and deletes the public fixture roots. The consumer restores
private modes lost during artifact transfer with a generated-only bounded
adapter, then builds the unchanged production API image locally. It runs the
compiled restore offline as the owning non-root UID, with read-only root and
input, a new writable destination, dropped capabilities and bounded resources.
A second container verifies a read-only destination without mounting the input.

The [generated harness](../../services/api/scripts/rehearse-isolated-checkpoint.mjs)
uses public structural fixtures only. Its readback key is supplied outside the
production CLI, which still reports `ciphertextAuthenticated: false`. This
acceptance checks both layouts and ordinary publication refusal. It neither
starts custody nor establishes real data/key recovery. Artifact reception may
repair modes only for this explicit generated shape; do not use it for real
backups. Consult the dated evidence for actual local/CI observations.

## Refusals, limits and remaining recovery

Failures use the existing fixed `BULLETIN_CHECKPOINT_STOPPED` message and exit 1,
without printing paths, private content or raw exceptions. Preserve incomplete
output and investigate; verification refuses it. Use another new destination
after resolving the cause. A completed workspace with missing/changed files,
links, extra entries, altered barriers or missing empty directories also refuses.

The [checkpoint file/metadata/count limits](bulletin-custody-checkpoint.md#handle-refusal-and-limits)
remain authoritative. Logical JSON is bounded at 2 MiB before extraction, even
though physical source objects use `.bin` names. Reconstruction streams one file
at a time and creates no hard links. Both CLI modes use the existing six-minute
cooperative deadline. The defining modules are
[reconstruction](../../services/api/src/services/bulletinIsolatedRestore.ts) and
[shared state validation](../../services/api/src/services/bulletinCheckpointState.ts).

Only the active settled multi-release domain is supported. Previously pruned
ciphertext is not fabricated: its references, receipts and nonce history can be
recovered, but remote retention/readback still needs its own evidence. Historical
pilot domains, service configuration, independently stored real data and separately
recovered content/signing keys are outside this tool.

Generated tests decrypt/authenticate retained structural audio using an explicitly
supplied public test key **outside** the production restore. That demonstrates
retrieved bytes and reservations for those fixtures; it is not real key recovery,
audible AAC/device acceptance, an HTTP service or an image rollback. Before any
operational recovery, establish current canonical account/receipt history and
compatible images/configuration, recover required keys separately and preserve
newer intents and permanent nonce history. An old idle snapshot may miss a later
broadcast even when every hash matches. #407 remains open.
