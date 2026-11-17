# Fresh Bulletin publication trial activated — 2026-11-04

Refs W33/#288. After the [verified Product 0.1.71 delivery](product-0.1.71-rollout-2026-11-04.md),
the owner requested a normal new publication instead of further repair of the
abandoned trial. The new failure is at `/api/uploads/cover`: the existing pilot
admits only its first cover graph. A different cover is refused before the
metadata recovery offer is reachable. Retained encrypted audio is not a studio
draft the artist can find in the release list. Restoring that trial was the
wrong prerequisite for proving a successful ordinary publication.

## Executed scope

The owner explicitly approved short custody maintenance and a fresh cumulative
allowance for the same generated eight-second sound: **36 stores / 1,638,400
bytes** maximum, split into audio 16 / 1,048,576, cover 16 / 524,288 and metadata
4 / 65,536. Retries consume the same bounds. The artist still initiates uploads
through normal authentication and signs registry publication in the wallet.
Maintenance itself stores no content and registers nothing.

The existing custody machine and encrypted volume retain source `e2dd6148` and
image `registry.fly.io/dotify-api@sha256:a4c53614d0040c8ec405a8f66cb92734873f8d1f5f0f19739967b9c414aad41c`.
The two edges, encoder, contracts, API grants, CORS, master/session keys and
Web/Product 0.1.71 are unchanged. No local signer activation, key transfer,
DotNS write, domain purchase, renewal or new service occurred.

New active custody settings:

| Variable | Value |
| --- | --- |
| `BULLETIN_PUBLICATION_PROFILE` | `/data/contributions/config/bulletin-fresh-20261104.json` |
| `BULLETIN_PUBLIC_ASSET_POLICY` | `/data/contributions/config/bulletin-fresh-20261104-assets.json` |
| `STREAMING_STATE_PATH` | `/data/contributions/streaming-fresh-20261104` |
| Publisher inventories | `/data/contributions/bulletin-fresh-20261104-publications` |

The owner/runtime/content hash/key version remain the original eight-second
synthetic scope. The first cover and details selected for this new publication
are admitted independently of the old graph. The old name-only repair permit is
preserved but inactive; it is not copied into the fresh publisher. An unrelated
failed 209.6-second upload is neither admitted nor recovered.

## Preservation, nonce continuity and rollback

Snapshot `vs_7OYm1emDyJXtAZ0Yvo8` of the actual encrypted volume
`vol_491jo391o8leqe5r` completed before maintenance. The API process entered the
established `sleep infinity` maintenance command, then provisioning created only
new paths. Existing publisher/profile state and every old job, processing attempt,
receipt, repair permit and permanent reservation remain intact. Independent
readback verifies all **14 old small persistent files** against their original
hashes. No old state is deleted or rewritten.

Two different nonce histories matter. The Bulletin account's finalized transaction
counter is **1120** before and after maintenance; the fresh publisher starts at
that floor rather than zero. The encryption ledger's **four permanent generation
reservations** are copied and byte-verified before any key can be used. The old
ledger is retained. This prevents a new queue from forgetting an earlier
AES-GCM generation for the same content key. Provisioning never reads the key;
normal startup opens the already installed signer at its unchanged private path.

The [exact executed provisioning source](bulletin-fresh-provision-2026-11-04.mjs)
is a dated audit artifact, not a general migration tool or permission to run it.
It refuses active work, uncertain submissions, changed bindings or an existing
target. Exclusive creation makes partial setup visible; it is never automatically
replayed or removed. After new work starts, a rollback must carry every later
account floor and encryption reservation forward. Do not switch to the abandoned
queue or restore an older whole-volume snapshot. Snapshots stay within Fly and
may contain the previously installed key; off-volume restoration remains unproved.

## Verification and next artist action

Readiness returns HTTP 200 from the expected source with the fresh paths active,
zero jobs, no active publication, account floor 1120 and no old repair permit in
the fresh publisher. Independent read-only canonical checks still find the
synthetic release unregistered under the same artist authority. Quota is unchanged
at 336 transactions / 176,783,298 store bytes / 147,302,602 renewal bytes; account
authorization expiry is 1,621,405. Retain 215 older conservative obligations /
63,639,252 bytes plus up to 36 new renewals / 1,638,400 bytes. Initial admission
requires 287 transactions and 65,277,652 renewal bytes; no renewal is sent.

The exact provisioning function is rehearsed locally: old changed-cover refusal,
fresh cover and metadata acceptance, retry without duplicate stores, unchanged old
state, and refusal of a forced old encryption-prefix collision. No real signer
or external writes occur in rehearsal. The maintenance controller compiles;
the executed API source has [green CI](https://github.com/knzeng-e/dotify/actions/runs/41821943011).
[Structured activation proof](bulletin-fresh-pilot-activation-2026-11-04.json)
keeps scope, budgets, identities, snapshot and source hashes together without
publishing the private nonce-fingerprint paths.

The artist reopens Dotify, selects **New release** in the same artist space,
chooses the supplied `Dotify-fresh-test-8s.wav`, fills the desired details and
cover, then publishes and signs normally. The file is 256,044 bytes with hash
`0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35`.
An old local preparation hint receives 404 from the fresh queue; the existing
client already removes that stale hint and starts a new job without clearing
application data.

This remains one bounded trial: a cover or substantive metadata revision after
its first submission is still refused. Ordinary editable drafts and admission
based on artist usage budgets need their own production design; they must not
be replaced by recurring operator repairs. Actual successful publication,
protected Web/physical Host allowed and denied listening, dependency conservation,
off-volume restoration and representative performance/cost remain W33 gates.
