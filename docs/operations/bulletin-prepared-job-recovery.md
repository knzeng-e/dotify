# Recover one prepared Bulletin pilot job

Use this only for the existing failed pilot job with three consumed preparation
attempts. It reuses saved encrypted audio; it does not re-encode or reset retries.
See [ADR 0045](../adr/0045-bulletin-prepared-job-recovery.md) for authority and crash
boundaries. This command is implemented, **not yet deployed or run on live custody**.

## Prepare maintenance

Build/review the API revision containing this command and obtain its green CI.
Preserve a coherent snapshot of the queue (including `recoveries/`), permanent
nonce reservations, publisher inventories, account cursor and profile bindings.
Keep separate secret recovery; an on-volume copy alone cannot survive disk loss.

Arrange the custody maintenance window: publications and some new key requests
may be unavailable. Stop and await the normal custody process, keep the existing
volume mounted, and run as its normal UID 1000 in the built image (`/app`). Preserve
its existing environment, content-key vault and binary storage signer. **Do not
start the worker loop, initialize directories, export keys or activate a desktop
mnemonic.** The command refuses a running publisher or an orphaned writer lock.
Investigate crash locks under verified exclusive ownership; it never clears them.

Required existing settings:

- `API_ROLE=custody`, `STREAMING_AUDIO_STORAGE=bulletin`;
- unchanged `STREAMING_STATE_PATH`, `BULLETIN_PUBLICATION_PROFILE` with `pilotScope`;
- existing content-key version secrets and chain authority configuration;
- the existing profile's signer file, account, budgets and renewal floors.

No new environment setting, mount, service, subscription, permission or contract
is required. Keep other operators from transacting with this account during
execution. Review all outstanding retention obligations before real writes.

## Inspect, review, then execute

Inside the **built, stopped custody container**, use the exact saved job UUID
and lowercase artist H160. These commands are templates, not an automatic
instruction to run them against production:

```sh
node dist/scripts/recoverPreparedBulletinJob.js inspect JOB_UUID ARTIST_H160
```

Inspection reads canonical artist authority and authenticates private local
bytes. It makes no Bulletin request, loads no storage signer and writes no
persistent state beyond its temporary exclusive lease. Its report gives the
root, scope, consumed attempts, block/byte totals, attempted stores/bytes,
receipt/pending counts, immutable allowance and `planSha256`.

Inspect does **not** establish current Bulletin retention or sufficient network
quota; execution's existing publisher preflight/adapter checks those. Confirm
the report matches the reviewed pilot and remaining original allowance. If any
file/binding/reservation is absent or authentication fails, preserve state and
investigate rather than deleting output or allowing an encoder fallback.

After reviewing that report and the exact execution revision/budget:

```sh
node dist/scripts/recoverPreparedBulletinJob.js execute JOB_UUID ARTIST_H160 INSPECTED_PLAN_SHA256
```

The hash is required and rechecked before loading the storage signer. A changed
queue, bundle, profile or inventory requires a new inspection. This hash is not
an additional transaction authorization. Execution stays within the original
cumulative storage caps; it does not grant another full budget for every run.

## Verify and restore service

On success, preserve the returned reference and `auditId`. Confirm:

- queue state `ready`, original job ID/scope and `attempts=3`;
- expected graph root, all finalized publication receipts, zero unresolved
  pending intents and a cleared active account barrier;
- unchanged allowance/profile, source/output bytes and permanent reservations;
- a `ready` audit in `STREAMING_STATE_PATH/recoveries/` retaining the original job.

Restore the normal custody command/settings and readiness, then refresh the
artist's existing draft/status. The normal API returns the recovered audio
reference. The artist must still approve registration in their wallet; verify
catalog confirmation and authorized/denied Web and physical Host playback.
This tool neither submits that registration nor grants listening access.

On failure or interruption, preserve updated journals and inspect before retry.
`started`/`needs-inspection` audits are not proof that nothing was sent. Unknown
sender/nonces remain barriers. A storage-complete, queue-incomplete result can be
reconciled without duplicate stores after a fresh inspection. If queue state is
already `ready`, do not rerun recovery; verify the reference/audit and resume the
normal app. The CLI prints a fixed diagnostic rather than private provider errors.

Rollback restores normal custody with the unchanged paths/bindings; do not replay
an older nonce/account inventory over newer submissions. No Product/Web redeploy
is needed for this operator-only command. Retention monitoring, bounded renewals,
off-volume restoration and the broader W33 acceptance remain separate work.
