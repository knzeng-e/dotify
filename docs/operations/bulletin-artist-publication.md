# Prepare Bulletin artist publication

This is an opt-in capability in the existing private custody service, not a
record of activation. Read [ADR 0043](../adr/0043-bulletin-artist-publication.md)
before provisioning. Do not reuse or reset the private-canary journals.

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

The owner selected the existing DotNS account for this internal pilot. If that
choice is approved for deployment, its binary mini-secret file has the **same
account authority**, not a storage-only cryptographic restriction. Install it
only in private custody through a reviewed local-to-server channel; no mnemonic
string, frontend variable, encoder key or public API key is needed. No key has
been installed by this preparation. Separate accounts remain the recommended
operational isolation for a public rollout.

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
