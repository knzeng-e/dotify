# Prepare Bulletin artist publication

The current bounded path is [Web/Product/API 0.1.82 plus custody verification](../backlog/implementation/evidence/bulletin-parallel-rollout-2026-11-09.md),
with the [two-release v3 admission](../adr/0046-bounded-multi-release-admission.md)
activated in 0.1.81. Both identities are claimed; that does not consume the
unspent authority for every part. One identity has ready audio/cover but no
metadata claim at the November 9 read-only inspection. Current startup/registry
checks still decide whether completing it is appropriate. The same source is
already published under the other artist: do not register it again just for logs.

The [November 1 one-job pilot](../backlog/implementation/evidence/product-0.1.68-rollout-2026-11-01.md)
and [ADR 0043](../adr/0043-bulletin-artist-publication.md) below are historical
configuration context, not current quotas or permission to reprovision. Do not
reset any queue, admission, nonce ledger or key to obtain another slot.

“Private custody” means the existing `dotify-custody` server is reachable only
over Fly’s internal network through authenticated Dotify API edges. It remains
centrally operated infrastructure: Bulletin stores the encrypted bytes, while
custody and the isolated encoder prepare them and the signed-key service still
decides whether an account may receive a listening key. Network privacy does
not make this service decentralized.

## Collect publisher timings offline

The operator-only `services/api/scripts/summarize-bulletin-timings.mjs` reads
already collected private logs. It imports no app, provider, account or signer
and is excluded from the runtime image. No server or client deployment is needed.
The CLI itself makes no network requests; collecting Fly logs is a separate
read-only operator action under the applicable access controls.

Run from `services/api`, using explicit private paths and a **new** output:

```sh
umask 077
fly logs -a dotify-custody --machine REVIEWED_MACHINE --no-tail --json > /private/path/new-log.json
node scripts/summarize-bulletin-timings.mjs \
  --input /private/path/new-log.json --output /private/path/new-summary.json
```

`--job UUID` optionally selects a known job from the private operator report.
Neither original UUIDs nor machine/account/CID/raw-error fields are exported.
Samples receive local ordinal job labels. Keep the original logs private;
review even the allowlisted summary before sharing. A summary grants no access,
publication authority or receipt proof.

The reader accepts ordinary JSONL and Fly's concatenated pretty JSON objects,
including the JSON application event inside `message`. It bounds input to
16 MiB, each object to 64 KiB, input records to 10,000 and timing samples to
1,000. Input must be a private owned regular file, with one hard link and no
symlink; concurrent changes and invalid UTF-8 are refused. Output is exclusively
created as 0600, never overwrites another file and includes the input SHA-256.
An interrupted output is not authoritative; use a different output path.
Malformed recognized reports and files with no matching report refuse without
creating output. Normal unrelated JSON log entries are omitted.

For every sample retain outcome, publisher `elapsedMs`, fixed phase counters,
observed milestones, in-flight counts and observation time when present. Do
not add concurrent/nested phase totals, derive percentages of wall time from
them, treat missing milestones as zero or count repeated log observations as
unique attempts. The tool deliberately retains duplicates and supplies no ETA,
transaction verdict, automatic bottleneck ranking or speedup claim. Its clock
covers one publisher attempt, not upload/encoding/wallet/catalogue end-to-end.

## Existing prepared release and lost browser draft

A missing browser draft is separate from missing server audio. With the same
owner, chain, runtime, source content hash and active key version, the ordinary
audio POST returns the existing ready job even after restart. It does not reserve
new encryption nonces, re-encode or publish audio. This reuse still requires the
normal signed upload grant and artist checks; another identity cannot borrow it.

If the original audio and cover files remain available, a fresh New release
form can use them. Recreating a form still transfers the selected files to the
API; it is not a zero-upload promise. The exact original cover is required to
match its already claimed graph; changed/re-exported files are not substitutes.
Inspect actual runtime registration before proposing Publish, especially when
the same source was used under another artist/runtime. Catalogue absence alone
is never proof of non-registration. Do not publish a duplicate just to get logs.

An existing unclaimed metadata part can yield a small transaction-timing sample
inside its original allowance (currently at most 4 attempts / 64 KiB). It does
not measure fresh full-audio preparation. Capture before/after counters and
reports; leave approval of registration in the artist wallet. Do not ask for
new allowance merely because both release identities are claimed. Conversely,
a fresh full-audio identity cannot use that metadata allowance: it requires a
separately reviewed generation/budget under ADR 0046, preserving all old duties.

## Prepare a reviewable profile

Use a private directory (owner UID 1000 in the production custody container,
mode 0700), with a mode 0600 JSON profile. Example only; replace the account,
paths and bounds with reviewed values before using it:

```json
{
  "schema": "dotify.bulletin.publisher.v1",
  "genesis": "0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59",
  "endpoint": "wss://bulletin-paseo.tservices.es:8443",
  "account": "REPLACE_WITH_STORAGE_ACCOUNT_SS58_42",
  "directory": "/app/.data/bulletin-publications",
  "seedFile": "/app/.data/private-storage-key/storage.seed",
  "budget": { "maxBytes": 1048576, "maxTransactions": 64, "minimumLifetimeBlocks": 100 },
  "pipeline": { "concurrency": 2, "maxInFlightBytes": 524288 },
  "priorRenewalReserve": { "transactions": 107, "bytes": 21684749 }
}
```

The example floor is 107 transactions and 20 MiB + 713,229 bytes for the known
research obligations **only if reusing that same account**. It is not a new
quota or a universal floor; recheck all live receipts/other operators before
activation. A new dedicated account has different obligations. Budget caps count
attempted submissions, not only successful receipts; they are immutable for an
existing queue/profile generation. They do not authorize real transactions on
their own. Do not raise them merely to bypass a failed job.

The key file contains exactly 32 binary bytes of the selected sr25519 mini-secret.
Provision it locally through a reviewed secret workflow; never paste it into a
chat, commit it, put it in Vite or pass it as a command-line argument. Its parent
must be private, the file must be owned 0600, with no symlink or hard link.
Do not copy the DotNS mnemonic into a server as an installation shortcut.
Keep the key separate from inventories and encrypted-job snapshots.

Build the API from the repository checkout, then explicitly initialize **new,
absent** directories inside the custody image as UID 1000:

```sh
# Repository checkout
npm run build --prefix services/api

# Inside the built custody image, working directory /app, UID 1000
node dist/scripts/initializeBulletinPublisher.js /app/.data/config/bulletin-profile.json /app/.data/streaming-bulletin
```

Initialization performs no network access and reads no signer. It refuses
existing state. If provisioning is interrupted, inspect it; do not rerun the
command over a used directory or delete nonce history to force a fresh start.
The process must later see these exact paths, ownership and private permissions.

## Bound a one-release pilot

For a first real-runtime test, add an optional `pilotScope` with exactly
`chainId`, lowercase `runtimeAddress`, lowercase `contentHash` and `keyVersion`
to the reviewed profile. The publisher checks all four fields from the parsed
streaming manifest before opening a write session. This is a storage allowance;
it grants no listening rights and does not replace canonical runtime checks.

A scoped profile owns **one durable publication job** for its lifetime. The
same job can reconcile/retry within its existing attempt/byte caps. A second job
is refused even for the same audio, after completion, queue cleanup or process
restart: publication inventories retain the first job. Together with the
per-job caps this bounds the whole pilot, rather than approving that allowance
for every future upload. A rejected file can still incur local encoding work;
no Bulletin write session is opened for it.

The profile hash includes this restriction. Removing/changing it in place fails
startup; do not erase bindings, inventories or nonce history to enlarge a test.
A later broader activation requires a separately reviewed fresh profile/queue
and carries forward all prior retained/attempted publication obligations.
The [runtime-pilot preparation](../backlog/implementation/evidence/bulletin-runtime-pilot-preparation-2026-11-01.md)
records the generated source, proposed target, measured sizing and remaining gates.

The owner approved reuse of the existing DotNS account for the
[deployed internal pilot](../backlog/implementation/evidence/product-0.1.68-rollout-2026-11-01.md).
Its binary mini-secret has the **same account authority**, not a storage-only
cryptographic restriction. It is installed only in private custody through the
reviewed local-to-server channel; no mnemonic string, frontend variable,
encoder key or public API key is needed. Separate accounts remain the
recommended operational isolation for a public rollout.

## Activate only after the reviewed network budget

Configure on the private custody role only:

```dotenv
API_ROLE=custody
STREAMING_AUDIO_STORAGE=bulletin
BULLETIN_PUBLICATION_PROFILE=/app/.data/config/bulletin-profile.json
STREAMING_STATE_PATH=/app/.data/streaming-bulletin
```

Keep the existing paired isolated-worker URL/token, server-side content-key
custody, wallet-signed upload authorization, global upload concurrency at most
two, authenticated edge-to-custody route and single custody owner. The queue
publishes one job at a time; the profile controls its bounded block pipeline.
No encoder, SQL identity/policy, CORS setting or room limit changes are needed.
Mount the fresh state on persistent custody storage as UID 1000; a service must
not silently start with an empty replacement volume.

On the read-serving edge/combined API, configure the existing read-only
`BULLETIN_MEDIA_RPC_URL=https://bulletin-paseo.tservices.es:8443`. Edge instances
must keep the default publication selector and no publication profile/key.
Polkadot app uses native raw preimages with the bounded API recovery path;
ordinary Web uses the catalog-gated API reader. Neither receives the storage
signer. Covers and metadata still require the existing server Pinata setup.
No new process, CDN, database or paid plan is provisioned by this change.

## Observe and recover

Startup first validates the isolated-worker origin (use `https://encoder.example`,
not an `/encode` path) before acquiring a publisher lock or opening a signer.
An invalid worker setting therefore cannot leave a crash lock behind. It then
validates the profile binding, inventory, exclusive lock, finalized
network identity/authorization and public signer identity. It submits nothing.
Artist publication uses the existing job status/retry UI and final runtime
signature. Verify an exact canonical audio reference and entitled playback,
denial without entitlement, interruption/retry and physical Host/Web behavior
before making the new catalogue the default. Record bytes, attempts, receipts,
time to publish/play and retention deadline; do not equate a buffered replay
with a cold retrieval measurement.

On interruption, preserve the queue, permanent nonce reservations, all Bulletin
owner/job inventories and both profile bindings together. An unresolved store
blocks both discard and expiry cleanup. The normal retry reconciles exact
sender/nonce receipts before considering another store; it does not blindly
resubmit. The three-attempt limit remains. An operator must inspect exhausted
jobs and crash locks under verified exclusive account ownership; there is no
automatic force-unlock, history reset or quota-bypass command.

A same-volume copy is not disaster recovery. Take and rehearse coherent
off-volume backups before real artist custody; key recovery is a separate
secret-management responsibility. Automatic renewal remains unimplemented:
reserve counters are admission floors, not scheduled transactions. Monitor and
renew with an explicitly budgeted, reviewed operation before receipt expiry.

Rollback: stop and await custody, preserve pending Bulletin state, then restore
the old Pinata selector **and its old queue path**. Do not open a Bulletin-bound
queue under Pinata or erase its profile to bypass the binding. Existing
Bulletin releases still require their read path, key service and retention.

## Exhausted job with saved authenticated output

The [prepared-job recovery runbook](bulletin-prepared-job-recovery.md) adds a
maintenance-only inspected continuation for the existing exhausted pilot. It
keeps preparation attempts at three and reuses the original inventory, bytes
and caps. Ordinary artist retry remains unchanged; there is no force-unlock,
re-encoding fallback or counter reset. Implementation is not live execution.

## New release admission follow-up — 2026-11-08

The deployed synthetic profile is not a general artist-upload service. A new
Web/Desktop release can therefore finish local preparation and still be refused
before Bulletin storage. Repeated Publish cannot enlarge that allowance.
[The #407 candidate](../backlog/bulletin-publication-admission.md) preflights the
existing admission before encoding/reserving new nonces, repeats checks before
storage and reports a typed operator-action refusal. It does not activate new
releases. See [deployment validation and snapshot compatibility](deployment-configuration-history.md#publication-admission-preflight-candidate--2026-11-08).
Do not reset the current queue/profile or discard failed ciphertext to work around
this limit. Next is a reviewed durable multi-release policy, not another one-file
exception. Activation and actual artist uploads require their concrete budgets.

## Multi-release candidate — 2026-11-08

[ADR 0046](../adr/0046-bounded-multi-release-admission.md) adds optional bounded
multi-release admission. This is not the active service configuration. The
operator selects Bulletin for audio and public assets, provides the fresh
publisher profile and **unsets** `BULLETIN_PUBLIC_ASSET_POLICY`: the reviewed
`releasePolicy` below replaces the one-release asset file for this generation.
Do not remove `pilotScope` or alter the binding of an existing pilot in place.

Illustrative profile fragment, **not an approved budget** (audio continues using
that profile's `budget`, illustrated as 16 MiB / 128 stores):

```json
{
  "releasePolicy": {
    "schema": "dotify.bulletin.release-policy.v1",
    "artists": [
      {
        "owner": "REPLACE_WITH_LOWERCASE_EVM_ARTIST",
        "chainId": 420420417,
        "runtimeAddress": "REPLACE_WITH_LOWERCASE_RUNTIME",
        "keyVersion": "dotify-content-key-v2"
      }
    ],
    "maxReleases": 2,
    "cover": { "maxBytes": 8388608, "maxTransactions": 32, "minimumLifetimeBlocks": 100 },
    "metadata": { "maxBytes": 65536, "maxTransactions": 4, "minimumLifetimeBlocks": 100 },
    "total": { "maxBytes": 50462720, "maxTransactions": 328 }
  }
}
```

These illustrative totals reserve two complete releases at the declared part
caps; they are not a live quote or evidence that an artist's source fits. Measure
representative encrypted graphs including archive and directory overhead, retries,
all earlier retained/attempted graphs, authorization expiry and live remaining
store/renewal quota. Reservations remain charged even for unused parts. Current
application/media obligations must be taken from the latest approved inventory;
old runbook examples are not a valid floor. No recurring renewal is activated.

The existing fresh initializer creates `release-admission.json`; preserve it with
the profile/bindings, publisher owner/jobs, queue, permanent encryption nonce
ledger, exact metadata sidecars and key-vault configuration. A missing ledger or
orphaned inventory stops startup before signer loading. A new generation using an
existing content-key domain needs reviewed carry-forward of **all** permanent nonce
reservations and obligations, and a tested coherent off-volume restore. For development, the owner selected
[fresh setup with a new content master/version](bulletin-fresh-development.md)
instead of importing abandoned drafts. An empty ledger is valid only for that
new domain; old account obligations remain. No same-key history reset is offered.

Deploy matched client code before activating the profile. Cover upload sends
`contentHash` while the server supplies key version and authenticated artist/
runtime; cover-first selection remains a local preview until an audio identity
exists. Metadata may only name its own ready audio/cover; expired dependency
retention requires operator attention and triggers no automatic stores/renewals.
The first manifest and cover are immutable for an admitted release; editable
revisions are not introduced by this policy.

Rehearse two distinct complete releases, concurrent admission at the cap,
post-inclusion response loss/restart, wrong identities/references, edited first
metadata, missing history and expired dependencies. Verify no duplicate store,
nonce rewind, automatic refund, Pinata fallback or premature registration. Then
prepare a concrete maintenance/network budget and validate actual artist wallet
approval, catalogue readback and sound on Web/Desktop. #407 stays open until this
matching activation and acceptance.

The existing storage account also has DotNS authority. Unattended admission and
independent operator transactions must not race that same account cursor. Use
reviewed writer quiescence for other account writes; an idle observation alone
does not reserve the account. A separate storage account remains the isolation
option, but this candidate neither changes the owner-selected account nor
transfers/provisions another key.

## Prepare an exact release allowance extension

[ADR 0048](../adr/0048-exact-release-admission-extension.md) describes
adding one exact release without replacing the existing profile/key/queue. It
requires compatible custody code and separate operational approval; do not apply
it to a live writer or interpret this runbook as a spending allowance.

Prepare a private 0600 request using `dotify.bulletin.release-extension.v1`:
absolute `profileFile` and `queue` paths, `expectedProfileSha256`,
`expectedAdmissionSha256`, lowercase `owner`, and exact `scope` with `chainId`,
`runtimeAddress`, `contentHash` and `keyVersion`. Both digests bind normalized
parsed JSON, not raw file whitespace. The profile digest uses its existing
`publicationBinding`; the admission digest uses `admissionDigest` on the current
validated ledger. Never substitute an old checkpoint after state changes.

In the built API image, with a reviewed request:

```sh
node dist/scripts/extendBulletinAdmission.js --inspect /private/request.json
# Only in the separately approved, stopped-writer maintenance window:
node dist/scripts/extendBulletinAdmission.js --apply /private/request.json --quiesced
```

Inspect has no persistent side effects. Apply takes the existing publisher lease,
refuses writer locks/active or non-ready jobs/pending submissions/orphans and
checks the permanent nonce marker without editing it. It archives the prior
admission ledger before one atomic v2 replacement. Keep the archive, all old
claims and nonce history permanently. A partial archive alone grants nothing;
a committed request replay is refused, never another capacity increment. Do not
remove locks or alter the request just to bypass refusal.

The report states one additional **whole original per-release allowance**, not
an observed-use estimate or live quota verification. The original base slots
remain separate; the grant is usable only by its exact eligible scope. Capture
before/after private hashes and the coherent snapshot under the normal rollout
procedure. Refresh account-sharing writer exclusion, finalized nonce/quota,
authorization expiry and all prior retention obligations before activation.
No recurring renewal, new account/key, Pinata fallback or wallet approval bypass
is introduced. Missing archives or altered claims fail closed at startup.
After activation, older builds reject v2; keep compatible code or disable new
publication during rollback, preserving all state. Do not restore an old ledger.

## Compact exact-source candidate

The [compact delivery reference](../reference/bulletin-compact-delivery.md#immutable-exact-source-admission)
defines a new `dotify.bulletin.release-extension.v2` request with
`audioLayout: rendition-pack-v1`. It uses the same inspect/apply procedure,
reviewed digests and stopped-writer safeguards above, for a new exact identity.
Its ledger is v3; retained standard claims stay standard. Do not add a layout to
an existing request, extension, claim or bound profile. Compact metadata must
retain its full registered reference.

This is implementation guidance, not an active allowance. Compatible clients,
API and custody plus remaining real-media/recovery acceptance and a separately
reviewed maintenance/budget plan precede any apply. Ordinary restart/retry is
covered by simulated tests; the dedicated prepared-job repair tool remains
standard-only. Retain compatible binaries/state on rollback; never downgrade the
ledger by deleting its layout field.

## Prepare a future exact direct-write window

[ADR 0049](../adr/0049-bounded-direct-write-windows.md) is a candidate, not an
active tuning or spending instruction. With compatible custody code, a new
exact extension request may additionally contain:

```json
{ "writeWindow": { "concurrency": 16, "maxInFlightBytes": 4194304 } }
```

This shows the maximum, not a recommended live setting. Compare 4/8/16 against
byte/dependency constraints and current runtime/pool limits before choosing a
value. Without the field, original write limits remain. The strict publisher
profile still excludes it: do not edit the bound profile or an existing grant.
It is not an allowance increase and does not replace any claimed identity.
The same selection binds audio, cover and metadata inventories for that source.
Startup/retry refuses a mismatched pipeline; older readers reject the new field.

From `services/api`, after building:

```sh
node scripts/measure-bulletin-window.mjs
# Optional explicit public read-only capability inventory; no signer is used:
node scripts/inspect-bulletin-window.mjs wss://bulletin-paseo.tservices.es:8443
```

The model uses synthetic geometry and reports no ETA. Runtime constants do not
prove node-pool admission or inclusion speed. Activation still requires separate
image/maintenance/snapshot/exact-budget approval and fresh quota, retention and
account-writer exclusion. Up to sixteen unknown outcomes may need reconciliation;
never remove their intents, fill a nonce gap, refund them or re-sign automatically.
Existing general multi-release exhausted-attempt recovery is not added here.
After window activation, rollback keeps compatible code/state or disables new
publication. Do not restore a previous ledger/profile to reset history.
