# API non-root storage cutover

Status: prepared and locally rehearsed on 2026-10-21, **not deployed**.
Refs #285, [W30 evidence](../backlog/implementation/evidence/W30-api-nonroot-2026-10-21.md).
This is an operator procedure for a separately authorized maintenance window.
Merging the code or running CI does not execute it against Fly.

## Process and custody boundary

The default API image runs Node directly as UID/GID 1000. Before importing
session/catalog services, startup verifies existing state files can be opened
for reading/writing and their parent can perform an atomic write/rename/remove.
Failure stops startup without resetting persisted data or choosing a new epoch.
`api:storage-ready` logs only the process UID/GID after that check.

The separately selected Docker target `storage-maintenance` runs as root but
never imports the API or opens HTTP. Its default command only inspects
`/data/contributions`. Applying ownership requires an explicit quiescence
acknowledgment and the fingerprint of the reviewed, stopped-writer inventory.
It changes ownership/mode only: directory 1000:1000/0700, files 1000:1000/0600.
It preserves bytes and verifies their hashes again afterwards.

The utility recognizes `catalog.json`, `receipts.json`,
`session-revocations.json` and their existing atomic-write temporary siblings.
It leaves the real filesystem `lost+found` directory untouched. Unknown entries,
symlinks, hardlinks, more than 256 application files or files over 64 MiB stop
maintenance. Investigate these cases; do not delete files to make it pass.
Future W32 nonce/job custody stores require their own reviewed inventory and
restore policy before deployment. This utility is not an arbitrary recursive
`chown` facility or a transaction spanning concurrent writers.

## Local rehearsal

From repository root, with Node 22 and Docker available:

```sh
npm --prefix services/api run storage:rehearse
```

The script builds the two targets, creates uniquely named synthetic volumes,
and runs all containers without network, with read-only image filesystems and
bounded resources. It checks root-owned startup refusal, a rejected fingerprint,
byte-preserving and repeatable maintenance, backup restoration, actual session
revocation continuity, catalog/receipt continuity, and a root-mode code rollback
that keeps the latest data. It then removes only its own containers/images/volumes.
The rollback uses the current persistence implementations under UID 0, **not**
the deployed API 28 image. It is no substitute for the live checks below.

## Prepare an operator window

1. Record the tested source SHA and immutable image digests for both build
   targets, the current API image/config, Machine ID, volume ID and region.
   Build/push the two reviewed targets using the existing registry workflow;
   never point the app at the maintenance target through an ordinary deploy.
2. Confirm one API writer, no concurrent deploy/autoscaler/job, and that the
   selected volume is mounted at `/data/contributions`. Preserve every existing
   path, environment value and secret, especially the stable `SESSION_EPOCH`
   and content-key master. Do not print secret values in logs or evidence.
3. Save the Machine configuration privately before changing it. For example,
   with a private directory and `umask 077`, redirect
   `fly machine list -a dotify-api --json` to a private file and extract the
   selected Machine's `config` into another private JSON file. Do not commit
   these files: config can contain sensitive environment values.
4. Prepare and review three full Machine configs from that saved config:

   | Config | Image/start command | Service and restart policy |
   | --- | --- | --- |
   | Inspect | Maintenance digest; `node dist/scripts/prepareApiStorage.js --inspect` | No HTTP services/checks, no schedule, restart `no` |
   | Apply | Same digest; `node dist/scripts/prepareApiStorage.js --apply --quiesced --expect=<reviewed fingerprint>` | Same offline restrictions |
   | Serve | Runner digest; `node dist/index.js` | Original services/checks/restart policy restored |

   Set the command explicitly in `init.cmd` and remove inherited
   `init.exec`/`init.entrypoint` overrides. Preserve mounts, resources, metadata
   and environment. Remove any background start trigger for the two maintenance
   configs. Review the full diff, not just the image name. The old app command
   must never run as root in the maintenance image.

## Stop, inspect, back up, apply

These commands change the live service and are for the approved window only.
Replace the quoted placeholders with the reviewed IDs and private config paths.
Run steps sequentially; stop on any mismatch or failed exit.

```sh
fly machine stop '<machine-id>' -a dotify-api
fly machine update '<machine-id>' -a dotify-api --machine-config '<inspect-config.json>' --skip-start --yes
fly machine status '<machine-id>' -a dotify-api
fly machine start '<machine-id>' -a dotify-api
```

1. Verify the selected Machine is stopped before starting the one-shot inspect
   process. Verify it exits successfully and returns to stopped. Record its
   new instance/image, timestamped inventory and fingerprint from logs. Ignore
   older log entries; do not reuse a fingerprint from a running writer.
2. With no app process running, create a volume snapshot using
   `fly volumes snapshots create '<volume-id>' -a dotify-api --json`.
   Record successful completion and the recovery reference. Verify a recoverable
   backup exists before applying. The local restore rehearsal does not verify
   a Fly snapshot or the production disk.
3. Put that exact fingerprint in the reviewed apply config, then:

```sh
fly machine update '<machine-id>' -a dotify-api --machine-config '<apply-config.json>' --skip-start --yes
fly machine start '<machine-id>' -a dotify-api
```

4. Confirm successful exit, identical content fingerprint and intended
   ownership/modes. Leave the API stopped on failure. A partial ownership change
   may be retried only after another inspection of the unchanged bytes; the
   content fingerprint intentionally excludes ownership/mode for that purpose.
5. Restore the app configuration with the new runner:

```sh
fly machine update '<machine-id>' -a dotify-api --machine-config '<serve-config.json>' --yes
```

Use the **same Machine and volume**, with one writer throughout. Do not scale
out or create a second API writer. Fly updates keep the attached volume;
review [Machine update semantics](https://docs.fly.io/machines/flyctl/fly-machine-update)
and the installed CLI help before execution. A Fly
[`release_command`](https://docs.fly.io/reference/configuration#run-one-off-commands-before-releasing-a-deployment)
has no persistent volume, so it cannot perform this migration.

## Verify and roll back

Before reopening tests, record health/readiness, `api:storage-ready` UID/GID
1000, no fresh-epoch fallback, retained catalog checkpoint and contribution
receipt history. Using test sessions prepared before the window, verify an
active session remains valid and a durably revoked one remains rejected after
restart. Run existing authorized access-denial/key and no-payment readbacks;
do not log tokens/keys or submit a funded tip as a smoke test.

For code rollback, restore the saved old image and app config on the **latest
volume**. A root process can read the restricted node-owned files. The old
image may write root-owned atomic replacements: inspect and reapply ownership
offline before returning to the non-root runner.

Never restore an older revocation snapshot over newer accepted sign-outs.
Backup restore is safe only before subsequent writes, or under a separately
reviewed trust-state recovery that preserves all later revocations. The same
principle applies to permanent W32 nonce reservations: rollback must not recycle
used namespaces. Do not rotate the session epoch or master key to conceal a
permission failure. Keep the maintenance image out of normal app deployments.
