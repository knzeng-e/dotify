# Prepare and run the private Bulletin storage canary

This is a generated-only operator experiment, not an artist publish command or
a production provider switch. Read [ADR 0041](../adr/0041-private-bulletin-canary-package.md)
and obtain fresh owner approval of the exact `REVIEW.md` budget before `publish`.
Previous lab approvals are complete. No command registers a runtime, distributes
a content key, renews data or changes DotNS.

## Prerequisites

Use a clean committed checkout with Node 22, FFmpeg/ffprobe and the locked API
and research dependencies. The operator needs Git to bind the code revision.
Do not use an account concurrently from a wallet, DotNS CLI, another fixture or
another machine. Local account/package locks cannot coordinate remote tools.
The pinned account is `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`;
the only endpoint is `wss://bulletin-paseo.tservices.es:8443`, with genesis
`0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59`.
The plan cannot silently substitute another endpoint or account.

Use an owned persistent private parent outside the repository. `/private/tmp`
may hold a review candidate but is not durable custody or a disaster-recovery
location. Paths below are examples, not directories to recreate after failure.

```sh
cd research/bulletin-prototype
node protected-canary.mjs prepare /absolute/private/canary
node protected-canary.mjs plan /absolute/private/canary
node protected-canary.mjs backup /absolute/private/canary \
  --destination /absolute/private/backup --exclusive-account
```

The launcher creates a temporary empty working directory and starts the operator
with an allowlisted environment. It forwards no `MNEMONIC`, Pinata, database,
content-key, `NODE_OPTIONS` or dotenv settings. Run Node itself from a trusted
shell without injected loader options. Read-side commands refuse signer flags.

Preparation refuses an existing directory and uses fresh secret/generation
material. Recreating a package would produce a different root and approval
digest. Loading the prepared artifact verifies its exact encrypted bytes,
manifest authentication, generated master, nonce custody, graph and budget;
continuing that artifact does not encrypt again. Failures leave custody intact.

## What to review and preserve

`REVIEW.md` and `plan.json` contain safe metadata and the exact allowance:

- `send.maxStores` and `send.maxBytes`: hard cumulative attempted-write ceiling;
- `reserve`: one complete new graph renewal, not sent by this tool;
- `priorReserve`: 91 earlier lab renewal slots plus a conservative 20-MiB
  renewable-byte floor, not a newly measured earlier inventory;
- account, genesis, endpoint, graph root, per-block lengths, code revision and
  package/nonce checksums bound by the approval digest.

The whole directory is private. Preserve `custody-secret.bin`, `bundle.json`,
`nonces/`, `plan.json` and `publications/` together. Never publish a backup or
secret through GitHub, Bulletin, a gateway, logs or an issue. The AES content
key is derived in memory from the private secret and fixed generated scope.
The public review file does not contain either secret. JavaScript strings and
signer closures do not offer a guarantee of complete memory erasure; terminate
the short-lived operator process after use.

`publications/owner.json` and `stream-<uuid>.json` own mutable nonce cursors,
pending intents, consumed attempts and receipts. Do not recreate missing files.
The v2 media adapter checks account/job consistency and readiness; a ready
journal is historical evidence, not a promise of present retention.

## Read-only preflight

```sh
node protected-canary.mjs check /absolute/private/canary
```

This reads the finalized account nonce, authorization and quota, after genesis
verification. It uses no signer and performs no store. Quota must cover remaining
attempts, a full new renewal and the earlier reserves. The previous dated quota
snapshot is not an allowance reservation; recheck immediately before writes.
The fixed runtime address is a model identity, not a deployed artist runtime.

The operator sets a 20-MiB incoming WebSocket message limit before JSON parsing,
plus fragment/chunk bounds, a handshake timeout and no compression or redirects.
RPC reads have a 25-second bound and custody reads 30 seconds. Signed stores
allow 90 seconds for finality observation within a 120-second whole-store bound;
publication remains five minutes and the operator signal ten minutes. These bounds do
not retract a broadcast. Peak RSS is the entire process high-water mark, not
only graph memory; elapsed time includes preflight/readback and is not first
sound. RPC canonicality/finality remains trusted, not a light-client proof.

## Publish only the approved artifact

The owner must approve the exact new store/byte budget and retained renewal
floors first. Await the reviewed source's green CI. Keep the secret phrase
local. `publish` requires all four flags below; an input descriptor is not an
authorization by itself. Invoke Node directly, because npm may close arbitrary
file descriptors. Supply FD 3 from the approved local signer bridge; never put a
phrase in a CLI argument, JSON file, issue or chat.

```sh
node protected-canary.mjs publish /absolute/private/canary \
  --approval REVIEWED_SHA256_DIGEST \
  --backup /absolute/private/backup \
  --exclusive-account --signer-fd 3
```

The tool validates the package, source compatibility and complete private backup,
then checks network/quota without a signer. Existing pending intents must first
be resolved with `reconcile`. Only then does it read the bounded
FD input and verify the selected public account. The dedicated PAPI writer uses
the server's durable explicit nonces. The session limit supplements the durable
attempt/byte budget; starting a new process does not reset it. Exactly two
stores may overlap; the directory root waits for every verified dependency.

A successful observation records the digest/root, verified receipts, attempts,
bytes, preflight counters, duration and RSS. u64 quota counters are decimal
strings, preserving exact precision; custody nonce/receipt schemas remain numeric.
It contains no key, signer input or raw provider exceptions. A failure names the
controlled stage and category (deadline, cancellation, validation or unclassified), and leaves
custody/journals for investigation. Do not interpret a timeout or interruption
as proof that a transaction was never broadcast.

### Resume with a reviewed source repair

An artifact's original approval does not authorize modified publisher code.
If a repair is needed, review the exact descendant commit, await green CI and
obtain owner approval of that execution revision before enabling the signer.
Then add `--source-approval EXACT_40_HEX_COMMIT` to the same `publish` command.
The operator checks ancestry and a clean checkout with identical operator/API
code. Omitting the flag retains the original strict source binding. This flag
records a separately granted approval; it cannot grant permission by itself.

Keep the original artifact, digest, backup and live journals. Never rewrite
`plan.json`, re-encrypt, restore stale counters or enlarge the cumulative budget
to run the fix. A signed observation records the original artifact implementation
and approved execution revision. Read-side commands reject this publish flag.
The [November 1 partial run](../backlog/implementation/evidence/bulletin-protected-partial-run-2026-11-01.md)
has two confirmed stores and 14 remaining under its original allowance; its
source repair requires review before continuation.

## Reconcile and audit without sending

```sh
node protected-canary.mjs reconcile /absolute/private/canary --exclusive-account
```

This constructs a read-only transport and runs the same v2 receipt engine. It
may update local inventory and reconcile exact pending sender/nonce receipts.
If blocks remain absent, it returns `partial: true`, with no new stores; an
unresolved submission remains an error. A complete graph is re-read by CID,
with retention margins checked before `ready`. Combined with local AEAD
validation of the identical graph, this verifies encrypted artifact readback;
it does not play audio or test a real access policy. Receipt reconciliation
requires retained canonical candidate bodies/events and parent metadata. A
replaced CID pointer or absent historical evidence must remain unresolved.

After a normal cancellation the client is destroyed, started tasks are observed
by the adapter and process locks are released, while pending intents/account
barriers remain. Hard termination can leave `operator.lock` or `writer.lock`.
Never auto-expire or automatically remove them. Stop every account user, verify
that no writer survives and review exact finalized/pending outcomes before
manual lock recovery. A missing CID or merely advanced account nonce is not
proof of a matching successful store. Do not add budget or clear attempts to
make a retry pass; obtain a new reviewed recovery plan if exact allowance is
exhausted.

## Backup and recovery boundary

Run `backup` only while all account tools are idle, before first publication and
after every fully settled job. The command refuses active/pending publication,
an existing destination and a destination inside the live package. It holds the
local account/package lease and copies the full private tree with checksums.
An inspection marker is persisted before copying the first custody file, so an
interrupted copy cannot become a writer directory. `publish` checks the backup
against the same immutable package. A pre-publication backup is expected to
have older mutable state after a run; it is **not** a current nonce journal.

Snapshots are for inspection and custody recovery. There is no automatic
restore-to-writer command. Recover the secret, exact encrypted bundle and
permanent nonce reservations from a verified snapshot, but reconcile the newest
coherent live owner/job journals against exact canonical receipts before any
writer is enabled. Never copy an old owner cursor over uncertain/newer state.
If the newest intent/cursor records are lost, stop: this tool does not safely
reconstruct that history. Keep the original state and snapshot for review.

For disaster recovery, place an appropriately protected quiescent snapshot on
independent durable storage through a separately authorized procedure. A second
folder on one disk is only a local rehearsal, not a resilient backup.

## Remaining acceptance

This experiment uses generated audio and a private local key. Each signed run
needs explicit authorization of its cumulative allowance and execution source.
Real runtime registration, wallet-signed
key delivery through the canonical service, denied/revoked access and protected
Web/Host playback must be accepted separately. Production media routing,
representative-release costs, cold audible startup, background recovery and
recurring retention remain open. To stop the experiment, stop its operator;
retain all custody and publication duties. No production rollback is needed
because no provider is selected by this tooling.

## Recorded run, November 1

The original generated-only package is now complete: 16 stores / 713,229 bytes,
16 independently verified sender/nonce receipts, no pending submissions, and
three authenticated/decoded AAC renditions. The signer was removed. See the
[completed application/readback evidence](../backlog/implementation/evidence/bulletin-application-readers-2026-11-01.md).
The original store allowance is consumed; do not rerun it as a new budget.
The 16 renewal slots remain reserved alongside the previous 91, without renewal
being sent or scheduled. Real artist registration/private access and recurring
retention require a separate reviewed plan.
