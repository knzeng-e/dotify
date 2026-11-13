# Back up a published Bulletin graph

Use this operator procedure when encrypted published data must outlive temporary
custody files. Queue cleanup is normal: a custody checkpoint may preserve all
history while containing no audio. This separate artifact copies the immutable
published graph, including the original archive, without rebuilding queue files.
It is a code candidate; only generated local graphs have been exercised.

## Choose the two independent responsibilities

Keep the [custody checkpoint](bulletin-custody-checkpoint.md) for original
admissions, receipts and nonce reservations. Keep this published-data archive for
reachable content blocks. Neither replaces the other, the separately recovered
content masters, or current canonical history needed before restarting a writer.

Start with one trusted complete publication root, retained from the reviewed
release/inventory/reference. An arbitrary root can archive arbitrary supported
UnixFS data; graph verification alone does not bind an artist, access policy or
registered release. No ordinary media/archive endpoint is added by this tool.

Arrange a private canonical destination parent, owned by your UID, mode 0700.
Use the reviewed compiled API, maintained Node 22 and a separately approved read
scope. The artifact contains media encrypted as published **and unencrypted
metadata**; this command does not encrypt its output directory. Use encrypted
storage/transfer and retain the trusted digest separately.

## Capture explicitly

From `services/api`, after building:

```sh
node dist/scripts/backupPublishedBulletin.js capture /PRIVATE/new-archive TRUSTED_BULLETIN_ROOT HTTPS_BULLETIN_RPC
```

All three arguments are required. No environment/configuration/vault fallback is
used. The HTTPS adapter permits only its existing genesis and block-read RPCs,
with per-response bounds and no credentials, redirects, signer or writes. A
six-minute cooperative deadline covers the command. Capture does not renew a
block, prove retention, or retry publication when a block has disappeared.

The new destination is created exclusively. Every reachable raw/DAG-PB block is
CID-verified before storage. The traversal rejects unsupported codecs/UnixFS
types, unsafe/duplicate directory names, excess depth and size/count overflows.
Deduplicated private objects use SHA-256 filenames; the private manifest maps
them back to CIDs and pins the original root. No saved absolute source path or
RPC URL is stored. Parents, block data and manifests use the existing owned,
canonical, single-link private-file checks on readback.

| Bound                   | Limit                                             |
| ----------------------- | ------------------------------------------------- |
| Block                   | 512 KiB                                           |
| Unique reachable blocks | 2,048                                             |
| Total block bytes       | 134 MiB                                           |
| Graph depth             | 8 links below the root                            |
| Archive manifest        | 1 MiB                                             |
| Filesystem              | New private destination; flat `objects` directory |

On success stdout contains the manifest SHA-256 and counts. Retain that digest
outside the archive. It detects changes relative to your trusted value; it is
not a signature or proof of the root's registration/history.

## Verify without the source

Transfer the protected artifact to the agreed independent destination. Then:

```sh
node dist/scripts/backupPublishedBulletin.js verify /PRIVATE/received-archive EXPECTED_MANIFEST_SHA256
```

Verification is offline: it reads only the explicit private artifact and trusted
digest, checks every block's bytes/CID and follows the full root graph. Missing,
changed, unreachable, duplicated or unexpected objects refuse. Links, hard links,
unsafe modes, aliased directories and an incomplete marker refuse as well.
The verifier neither decrypts audio nor starts a service, modifies the artifact,
contacts an RPC or retrieves a missing block.

The report distinguishes `completeReachableGraphVerified` from
`ciphertextAuthenticated`, canonical history, storage independence, key provenance
and writer authority. The latter guarantees remain false. No key is loaded or
returned. The original archive is present as blocks; a separate authenticated
reader is still needed to prove listening-data recovery with recovered masters.
Do not describe this data-only success as recovered audio or a deployable backup.

## Interrupted capture

A failed/aborted read preserves a private `.incomplete` artifact, never a committed
backup. Verification refuses it even if some files or a manifest are present.
The CLI exits 1 with a fixed `BULLETIN_PUBLISHED_ARCHIVE_STOPPED` message, without
URLs, root CIDs, file paths or raw transport errors. Preserve it for private
inspection; retry only into a new destination after checking the cause and scope.
There is no automatic cleanup, state repair, replacement root or publication.

Source: [capture/verification](../../services/api/src/services/bulletinPublishedArchive.ts),
[CLI](../../services/api/src/scripts/backupPublishedBulletin.ts),
[scope](../backlog/bulletin-published-graph-backup.md).
