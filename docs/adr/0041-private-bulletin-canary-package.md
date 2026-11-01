# ADR 0041: keep the protected Bulletin canary in a private, immutable package

- Date: 2026-11-01
- Status: accepted; first authorized network run is partial, source repair pending
- Scope: W33 / #288, with W32 / #287; follows [ADR 0040](0040-bulletin-direct-store-receipts.md)

## Decision

Prepare one eight-second generated chord with the real server encoder, HKDF
key derivation and permanent AEAD nonce reservation. Store the encrypted files,
private custody secret, nonce ledger and publication ownership together outside
the repository. The plan binds the exact directory root, graph blocks, scope,
generation, code revision, endpoint, account and allowances to a SHA-256 digest.
A retry reads that same package; it never encodes or encrypts again.

Only `publish` accepts a signer descriptor. It requires the reviewed digest,
an inspection backup and exclusive account use. Digest equality binds approval
to an artifact; it does not itself constitute the owner's authorization. A fresh
child process receives an allowlisted environment and empty working directory;
no deployment secret or `.env` enters the custody/network code. The signer is
read only after local validation and a read-only network/quota preflight.

The server's v2 inventory remains authoritative for account cursors, pending
intents, consumed allowance and readiness. `reconcile` uses the same engine
with an incapable-of-writing transport: it may update local evidence, but never
submit a store. A partial graph stays incomplete. Unknown sender/nonce outcomes
remain blocked; a missing CID does not authorize another transaction.

Allow at most one attempted store per graph block and its exact total bytes.
Reserve a separate full graph renewal, plus the earlier 91 lab renewal slots
and a conservative 20 MiB of renewable byte allowance. These are local admission
floors, not on-chain reservations, retention guarantees or renewal submissions.
Shared-account wallets and other tools must stay idle during the operation.

## Recovery and alternatives

The backup holds the complete quiescent private tree, with checksums, and receives
an inspection-only marker **before copying custody**. Both complete and partial
snapshots are rejected as writer directories. A copied permanent ledger also
refuses reuse of the original encryption generation in the local rehearsal.
There is deliberately no automated restore-to-writer command: rolling mutable
account cursors back to a pre-broadcast copy could conceal pending transactions.
Recovery must combine the newest coherent owner/job journals with canonical
sender/nonce receipts; if they are missing, stop for operator review.

Reusing the public-key lab would simplify playback distribution but would not
exercise private custody. Reusing the older prototype checkpoint would create
two competing nonce authorities. Keeping the server v2 store and explicit PAPI
transport gives one recovery model without selecting a production provider.

The isolated client uses explicit `ws` 8.22.0 (already present transitively in the
lockfile), with a 20-MiB assembled-message ceiling, fragment/chunk limits,
compression and redirects disabled. An oversized fragmented loopback response
is rejected before the JSON-RPC consumer sees a message. This bounds an
individual incoming message, not total PAPI memory or whole-graph allocation.
The trusted RPC and archive-availability boundaries of ADR 0040 still apply.

## Limits and next gates

This slice prepares tooling, offline failure evidence and an exact local budget.
It performs no live store, renewal, signing or DotNS update. The generated scope
uses a model runtime address; it is not registered on-chain. Private encryption
is not evidence of real artist authorization, paid entitlement or physical
protected listening. No actual royalty/payment/access flow changes.

After review and fresh write authorization, measure the signed storage canary
and audit its fresh readback. Then prepare real runtime registration, signed
access and protected Web/Host acceptance separately. Representative-release
costs, background interruption, uncached recovery, recurring retention and
provider activation remain open. See the [operator runbook](../operations/bulletin-protected-canary.md).

## November 1 network follow-up

The subsequently authorized run stored two objects before stopping. Read-only
recovery confirms both sender/nonces and authenticated ciphertext; 14 stores
remain, with no unknown pending outcomes. The
[partial-run evidence](../backlog/implementation/evidence/bulletin-protected-partial-run-2026-11-01.md)
records the reporting defect and observed finality margin. Signed-store waits
now have a longer bounded finality allowance than short state reads.

Keep the artifact approval immutable. A necessary source repair requires a
separate exact `--source-approval` revision descended from the artifact source,
reviewed by the owner and identical to the clean execution checkout. Default
invocations still require the original code. This permits a reviewed repair
without re-encryption, copying stale journals or renewing the consumed budget.
The observation records both revisions. It is not an automatic upgrade path or
permission to sign; review, CI and explicit execution approval remain gates.
