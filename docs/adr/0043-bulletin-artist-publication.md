# ADR 0043: Bulletin publication in the existing custody service

Status: accepted for opt-in implementation; deployment and real-runtime acceptance pending.

## Decision

The artist's existing authenticated audio upload can select Bulletin through
`STREAMING_AUDIO_STORAGE=bulletin`. Its private custody service owns encoding,
encryption, durable job recovery and the storage signer. The isolated encoder
receives no content key. The listener still obtains a key only through the
existing signed request and canonical runtime access check. Host reads native
Bulletin preimages; Web reads verified ciphertext through the existing API.

This connects the application writer to the readers delivered in #371. It adds
no resident service. Refs #288 and #287; their performance, retention and
physical protected-access acceptance criteria remain open.

## Why this boundary

A browser-held storage signer would expose the account and prevent reliable
recovery after closing a tab. A new uploader service would add another deployment
and ownership boundary without removing custody's existing responsibilities.
The selected design reuses that service and its PostgreSQL custody lease.

The production PAPI writer and finality observer now live in the API package;
the diagnostic imports the same implementation. SDK versions are pinned to the
PAPI 3 / WebSocket versions used by the private canary. There is no implicit
Pinata-to-Bulletin fallback, account choice, mnemonic environment reader or
renewal operation. Covers and metadata still use Pinata in this slice.

## State and trust

A private, strict JSON profile declares the DevNet genesis, credential-free WSS
origin, expected account, seed file, state directory, per-publication submission
budget, pipeline bounds and renewal obligations belonging to other tools.
A fresh initializer creates the queue, permanent encryption nonce history and
separate Bulletin inventory. Both directories store the normalized profile
hash. Missing state or a changed profile fails closed; startup does not repair
or recreate it. An existing Pinata queue is not converted.

The process holds an exclusive `publisher.lock` for its lifetime. Each store
continues using the reviewed adapter's `writer.lock`, account barrier, explicit
nonce intents and exact sender/nonce receipts. Locks are never expired or stolen
after a crash. Exclusive use of the account by operators remains necessary:
locks on one volume do not coordinate other machines or unrelated tools.

Startup performs a read-only network/authorization check, closes that client,
and only then reads an owned, private 32-byte seed file. This is an sr25519
mini-secret, not mnemonic text or an expanded secret key. It must match the
configured SS58-42 address. The service never imports the local DotNS mnemonic.
The operator must provision the signer separately; reusing the DotNS owner
would expand the consequence of a server compromise and is not automatic.

Each publication opens a bounded dedicated client and closes it on every exit.
The writer preserves its prior RPC, message, concurrency and finality limits.
The existing five-minute publication deadline and three queue attempts remain.
Closing or timing out ends observation, not an already-broadcast transaction.
Shutdown stops/awaits the queue before destroying the signer and releasing its
lock; a hard stop leaves durable evidence for explicit operator reconciliation.
Zeroing owned key buffers is best effort, not a claim that a JavaScript process
can erase every runtime/library copy.

## Quota, failure and persistence

The adapter budgets new stores plus one future renewal of its current graph.
The application additionally subtracts the profile's prior renewal floor and
all older attempted/retained graphs from each session's transaction and renewal
byte counters, including the live writer's admission checks. Untouched drafts
reserve nothing; pending work is conservatively counted as a whole graph.
Shared blocks may therefore be counted more than once. This is a local admission
policy, not an on-chain reservation or proof that recurring renewals happen.
Inventories remain after ready-job cleanup and queue pruning.

A failed job with any possible store, pending intent or account barrier cannot
be discarded or age-pruned. Ciphertext remains available for reconciliation.
Ready jobs can be cleaned only without pending intents and with a complete
recorded receipt set. Lost or malformed inventories block deletion. After the
existing retry limit, an operator must recover the job; creating another job or
resetting a nonce ledger is not a recovery procedure. User errors explain that
the music is saved and assistance is needed without exposing raw RPC failures.

A root becomes ready only after the entire encrypted graph, including its
archive, has finalized receipts and verified readback. StreamingJobs then saves
the release-bound reference before removing ciphertext staging. This does not
register a release: the artist's existing runtime signature and canonical
catalog confirmation still determine publication and access.

## Rollout and remaining proof

No deployment flag, hosted secret, storage quota, account, contract or DotNS
record is changed by this PR. The deployed Pinata queue continues by default.
The target is a fresh Bulletin catalogue, not a permanent legacy runtime layer.
Rollback uses the intact old Pinata queue/configuration; it must not reopen a
Bulletin queue as Pinata or discard pending stores.

Next: review, provision a separately scoped signer and fresh private state,
calculate/approve an exact short real-runtime-bound protected fixture budget,
then verify publishing, entitled/denied listening and interruption on Web and
physical Host. The completed private canary was synthetic and model-scoped.
A representative multi-minute artist release, throughput within the existing
deadlines, off-volume backup/restore, recurring retention, failover and measured
cost are still gates. Do not infer scale from an eight-second test.

See the [operator runbook](../operations/bulletin-artist-publication.md) and
[validation record](../backlog/implementation/evidence/bulletin-artist-publication-2026-11-01.md).
