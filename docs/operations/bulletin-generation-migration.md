# Prepare and verify an offline Bulletin generation

Use this runbook with [ADR 0047](../adr/0047-offline-bulletin-generation-staging.md)
and [publication admission #407](../backlog/bulletin-publication-admission.md).
Merged code does not authorize production maintenance or musical writes. This
command prepares a new private candidate; it does not change service selectors.
Do not use it against running custody or treat a local copy as disaster recovery.

## Inputs and review

Build the API. Use its `bulletin:generation` command as the private state owner
(UID 1000 in custody), from an explicitly reviewed frozen snapshot/maintenance
context. Use canonical absolute paths, private directories and mode 0600 files.
The parent of the new destination must already exist and be private. The
service and every writer sharing the encryption vault or chain account must
stay stopped/excluded until the snapshot/activation decision completes.
Do not clear stale locks: reconcile them under the existing recovery runbook.

Create an explicit mode 0600 request. Shape below is illustrative, not executable
approval; `targetProfile` is the complete fresh ADR 0046 profile with measured
caps and the existing signer path, without `pilotScope` or `nonceHistorySha256`:

```json
{
  "schema": "dotify.bulletin.generation-migration.v1",
  "sources": [
    { "profileFile": "/app/.data/config/old-profile.json", "queue": "/app/.data/old-queue" }
  ],
  "additionalNonceQueues": ["/app/.data/earlier-pinata-queue"],
  "externalRenewalReserve": { "transactions": 0, "bytes": 0 },
  "destination": "/app/.data/reviewed-new-generation",
  "targetProfile": { "replace": "complete reviewed publisher profile" }
}
```

List **all** historical publisher generations in `sources`, not just the most
recent pilot. List earlier non-publisher queues sharing content keys in
`additionalNonceQueues`; their whole queues are archived, not merely markers.
Do not repeat/overlap roots. Keep signers and vaults outside these trees; the tool
does not discover or read keys. Other recovery/configuration inputs remain in
the separately reviewed coherent backup. No source state is overwritten.

`targetProfile.directory` must equal `destination/next/publications`. The next
queue is `destination/next/queue`. The target keeps the same genesis, account
and installed signer path. Its declared prior reserve must cover the sum of:
external obligations, every old declared prior floor, and each ready or attempted/
receipted inventory's entire block graph. Overlap remains conservatively charged.
Use the current account record, including application/lab history; examples in
older deployment records are not current capacity. Review incomplete inventories
and archived drafts explicitly; none is silently retried by the new queue.

## Inspect, stage, verify

Inside the built API image, working directory `/app` (or equivalent local build):

```sh
node dist/scripts/prepareBulletinGeneration.js inspect /private/request.json
node dist/scripts/prepareBulletinGeneration.js stage /private/request.json REVIEWED_PLAN_SHA256
node dist/scripts/prepareBulletinGeneration.js verify /app/.data/reviewed-new-generation RETAINED_PACKAGE_SHA256
```

`inspect` is read-only. Review its exact hash, source count, nonce count, greatest
account cursor, attempted totals, incomplete inventory count and required reserve
against independently inventoried custody. `stage` re-inspects the same request,
requires that hash, copies history, carries encryption reservations, sets the
new account floor and creates the fresh allowance. It rechecks sources before
publishing the boot-required nonce baseline and completion manifest. Zero
network operations; no signer/content-key derivation or activation.

Bounds: at most 32 publisher sources and 32 additional queues, 1 GiB of declared
source trees, 6,000 source entries, 220 MiB per file and depth 12 per tree; predicted
candidate size must fit 8,192 entries and the scanner's 2 GiB cap. Refuse rather
than silently omit a large graph. These are offline recovery-tool bounds, not
artist upload limits. Request JSON uses the existing 2 MiB private-state bound.

Output layout:

```text
history/N/profile.json             exact old profile bytes
history/N/queue/                   exact old queue, nonces and encrypted output
history/N/publications/            receipts, attempts, policies, sidecars, permits
nonce-history/N/                   earlier non-publisher queue snapshot
next/profile.json                  generated profile with inherited-nonce digest
next/queue/nonce-history.json       boot-required immutable baseline
next/queue/nonces/                 permanent reservation union
next/publications/owner.json       greatest old account cursor, new empty job list
inspection.json                    declared-source counts and review hash
complete.json                      whole-package integrity manifest
```

Do not start an incomplete candidate. Preserve partial output for inspection;
there is no resume/overwrite/force option. After understanding failure, prepare
another absent path and new inspected plan. Never delete old history to make the
command succeed. Routine CLI failures are sanitized and return exit 1.

## Restore rehearsal and activation gates

Copy the completed package through the approved encrypted backup channel and
run `verify` in a fresh process against the restored copy, passing the
`packageSha256` returned by staging and retained separately through a trusted
channel. This binds the exact completion manifest, distinct from the input
`planSha256`. Without the optional package digest, verification reports only
local consistency (`trustedDigestMatched: false`); the local seal is not an authenticity signature. A same-disk
copy only proves byte verification. Separately authenticate prepared encrypted
objects with the existing content-key recovery procedure, and rehearse coherent
security/database/vault recovery on genuinely separate storage. The staging
command cannot prove omitted inputs or successful key recovery.

The embedded profile keeps its original absolute paths. Restoring byte-for-byte
to the original reviewed paths is distinct from relocation; never edit bindings
to open a copied queue elsewhere. Before any live activation, review fresh
finalized nonce/quota/authorization/retention, full account obligations and actual
artist graph sizes/throughput. Obtain concrete maintenance/write approval, deploy
matched clients, unset the legacy public asset policy and select the generated
profile/queue together. Retain old history and compatible readers. Registration
stays an explicit artist-wallet action. Test Web/Desktop catalogue and audio.

Once the new generation reserves anything, the pre-activation package seal is
stale. Take a new coherent backup. Do not restore an older queue or rollback to
a pre-migration nonce ledger: merge all later permanent reservations and reconcile
new account submissions first. No recurring renewal is scheduled by this tool.
