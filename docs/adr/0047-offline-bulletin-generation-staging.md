# 0047 — Stage a Bulletin generation without resetting custody

Date: 2026-11-08. Status: implementation candidate; no live migration.
Refs #407; follows merged #410 / ADR 0046.

## Decision and scope

Keep old generations intact and prepare a new, absent private directory offline.
A strict request declares every old publisher profile/queue, any earlier queues
using the same content keys, an external renewal floor, and a proposed bounded
multi-release profile. There is no automatic discovery of keys or source paths.
The operator must establish stopped writers/frozen coherent sources first; an
idle observation or the absence of a lock is not proof of exclusive ownership.

The operator first inspects, reviews the plan SHA-256, then stages that exact
plan. Inspection hashes private files and validates profile bindings, account,
network, account cursors, inventories, receipts, nonce records and terminal queue
states. Pending store intents, an active account barrier, queued/active encoding,
locks, temporary files, orphan/missing inventories, links, insecure permissions
and changed bytes refuse preparation. No source file is edited or deleted.

The package contains byte-preserved old profiles, queues, publisher inventories,
metadata sidecars/permits, extra historical queues, and a fresh `next` profile,
queue and publisher. Old failed drafts are archived, **not retried or exposed as
new active jobs**. Incomplete settled inventories remain visible in inspection
and still carry obligations when attempted; they require operator disposition.
This deliberately avoids silently reauthorizing old work under a new allowance.

## Two different nonce histories

Encryption generations are permanent per-key reservations, including failed
preparation. Their union is copied into the fresh queue; duplicate identical
records share a reservation and conflicting records refuse staging. A new
`nonce-history.json` baseline lists inherited records. Its digest is bound into
the generated profile as optional `nonceHistorySha256`. The existing profile
binding validator checks every baseline reservation **before signer loading**
and again before publication. New reservations may be added, but inherited ones
cannot disappear. Profiles without this field retain their previous hashes.
The fresh initializer alone cannot complete a migrated profile: its missing
baseline prevents startup. Staging publishes that baseline only after copying
and rechecking source history.

The chain account's transaction nonce is different. The new owner cursor starts
at the maximum declared old owner cursor, never zero/null when history has a
known cursor. The existing writer still reconciles with finalized chain state
before stores and permits only a monotonic advance with no pending barrier.
Offline staging neither reads the network nor authorizes that next transaction.

## Conservative obligations

The required prior renewal reserve is the **sum** of the external declared floor,
each old profile's declared prior floor, and every block in each ready or
attempted/receipted old inventory. No deduplication or refund is inferred from
possible overlap; attempted counts/bytes are separately reported and archived.
The target must meet both required byte and transaction floors. This may
intentionally overreserve; reducing overlap requires another evidenced design,
not editing history to make the request pass. Future writes are separately
bounded by ADR 0046's new complete-release allowance.

This only covers **declared sources**. Omitted generations, unknown independent
writers and external obligations cannot be discovered from these inputs. The
operator must reconcile the full account inventory and quota before activation.

## Package integrity and operational boundary

All files are owned/private, single-link regular files; directories are private
and canonical, with no symlinks. Reads, total bytes, depth and entry counts are
bounded. Writes use exclusive creation and fsync. Partial output stays visible,
without a completion seal; it is never automatically deleted or overwritten.
A final manifest records exact bytes, relative paths and empty directories.
`verify` compares a whole package, including after a copy to another location.
It is a local change detector, **not a signed backup**. Staging returns a separate
package digest; verification can require that digest from a trusted external
record. Without it, the report explicitly records local consistency only.

This does not copy/read the signer, derive content keys, authenticate encrypted
audio, restore a vault/database, write the network, change selectors, stop a
service or activate new admissions. The same installed key path must remain
outside source/package trees. A complete coherent disaster backup additionally
needs separately protected keys, active-version mapping and security/database
state; source declaration and frozen-volume ownership remain operator duties.
Local same-disk copy verification is not off-volume recovery proof.

A package's `next/profile.json` binds its exact deployment paths. A relocated
copy can be checked, but cannot be pointed at as a relocated active generation
without a newly reviewed plan/binding. After any new queue/nonce progress, its old
whole-package seal is deliberately stale. Never restore it over newer custody.
Rollback must preserve the union of **new and old** permanent reservations and
all newer account/receipt progress; simply selecting an older queue is unsafe.

## Alternatives and remaining gates

Editing the existing pilot or initializing an empty ledger would erase budget
or encryption history. Copying entire volumes indiscriminately would include
secrets and unrelated security state without a recovery contract. This approach
keeps exact historical evidence and separately builds a bounded new generation.

Tests prove declared-history preservation, duplicate-generation avoidance,
pre-signer loss refusal, conservative multiple-source floors, fresh-process
package verification and rejection of changed/unsafe/pending state. Actual
frozen production inventory, content authentication with existing vault custody,
off-volume coherent recovery, measured graph/throughput and retention/quota,
matched client rollout and authorized activation remain gates. #407 closes only
after real Web/Desktop artist wallet registration, catalogue and audible checks.
