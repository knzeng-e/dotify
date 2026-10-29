# Bulletin segmented-media prototype, 2026-10-29

Refs #288/#287. Follows [the read-only study](https://github.com/knzeng-e/dotify/pull/353).
Status: isolated implementation, not activated. Production remains on Pinata.

## What is implemented

The [prototype](../../../../research/bulletin-prototype/README.md) builds a real
named UnixFS directory from files encrypted by Dotify's existing v3 writer and
durable nonce reservation. It validates the graph, publishes children before
parents, preserves SHA-256/raw and DAG-PB identities and checkpoints receipt
coordinates. The actual pinned Bulletin SDK builder is exercised with explicit
codec/hash settings, finalized completion and no automatic re-chunking.
The root is locally generated with explicit import settings; equality with an
existing Pinata-produced root is not established. This is not a catalog migration.

The path reader verifies raw CID bytes and fetches only the requested file's
dependencies. Its Host adapter requests `noReassemble: true`, an option already
available in Product SDK 0.39.0. This proves the interface locally; no physical
Host was driven and no production reader was changed.

Fault tests cover partial rejection, lost acknowledgement, uncertain submission,
corrupted reads, wrong network/account, incomplete graphs, quota/expiry refusal
and an overlapping in-process writer. Separate Node subprocesses reopen the
checkpoint and resume a partial or lost-acknowledgement publication without
duplicate finalized stores. Ciphertext is persisted independently for these
tests; no key is passed into the subprocess.

Renewal requests cover all graph blocks. Acknowledgement does not mean retained
data: verification requires later storage coordinates, extended lifetime and
readable bytes for every child. A root-only renewal test leaves expired children
unavailable, as intended.

## Local verification

All **17 tests pass**, including the two fresh-process resume cases. Tested
implementation: `e96ff895b19b33f49aa68caed28793bfe44004ac`. The dedicated
[Linux workflow](https://github.com/knzeng-e/dotify/actions/runs/40911625876)
also passes; its [measurement artifact](bulletin-prototype-linux-2026-10-29.json)
reproduces the same file/block/byte counts. The
[synthetic measurement](bulletin-prototype-local-2026-10-29.json) contains 11
files, 19 blocks and 870,498 graph bytes; the largest block is 262,144 bytes.
Manifest + one rendition's init/first segment require 28,767 fetched bytes,
without the master. Reopening the checkpoint reuses all 19 receipts with zero
new simulated stores; one modeled renewal cycle verifies all 19 blocks.
The dataset's prospective storage plus one-cycle budget is 870,498 stored bytes
and 38 transactions. These are local fixture counts, not live quota consumption.

The isolated CI repeats tests and measurements on Linux, installing only this
package and the unchanged API dependencies needed by the encryption fixture.
No production frontend/API test is claimed to establish native Bulletin support.

## Boundaries and next gate

All storage, finality, quota and expiry are an **in-memory model**, not a Bulletin
node. Test patterns are not valid AAC. Measurements do not establish network
speed, live authorization behavior, audible first sound, capacity or cost.
The model does not emulate the complete pallet economics. There are no network
writes, signer selection, production credentials, new paid services, app flags,
contract changes or production dependencies.

Checkpoints use fsync/rename and bind graph/account/network identity. The
prototype has one operator/process and one renewal cycle; its in-process guard
is not a distributed or cross-process lease. Uncertain submissions stop for
explicit reconciliation. An unattended multi-cycle renewal policy, finalized
live lookup/authorization transport, pending-request reconciliation, backup and
operational signer ownership remain implementation/activation gates.

The next network canary needs an explicitly selected user-owned authorized
account, verified signer identity and explicit byte/transaction budget. The
owner chose the same DotNS account for a bounded manual test, with local signing
only and no domain record change. Its Bulletin authorization and quota must be
checked separately from DotNS ownership. Never use the public deployment pool
for media or put the DotNS key in a frontend/backend worker. A separate storage
account is recommended before unattended production renewal, not required for
the manual canary. Then verify actual Web/Host raw-CID retrieval,
decodable media, cold first sound, continuity and renewal before considering a
reviewed storage switch. W32/W33 acceptance remains open.

### Account eligibility check, 2026-10-29

A read-only check at 18:36 UTC on the pinned DevNet genesis returned no Bulletin
account authorization for the account used for DotNS publication:
`5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`.
`BulletinTransactionStorageApi.account_authorization` returned `null`; the
finalized head observed alongside the query was block 1,419,372. This is an
eligibility observation, not a failed upload or an authorization grant. The same
account can be used once authorized with sufficient quota; no new wallet is
required. No signer was loaded, transaction submitted or DotNS record changed.
