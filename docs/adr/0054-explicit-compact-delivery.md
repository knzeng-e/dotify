# 0054 — Select compact delivery through an explicit reference and admission

Date: 2026-11-12. Status: implementation candidate, not activation. Refs #407.
Builds on [graph persistence](0052-bulletin-layout-inventory-binding.md) and
[bounded readers](0053-bulletin-compact-object-readers.md).
The [delivery reference](../reference/bulletin-compact-delivery.md) owns the wire,
request and durable-state contracts.

## Problem

An internal compact reader cannot help an ordinary listener unless publication,
registration and all delivery paths agree on the physical format. Reusing the
old reference or selecting a layout from a global flag would make later segment
reads fail and could reinterpret a previously charged publication after restart.

## Decision

Keep encryption v3 and retained key versions unchanged. A distinct
`bulletin-pack-v1` reference component selects compact delivery. One portable,
import-free grammar serves API and browser callers through their existing CID
codecs. Existing standard references keep their interpretation and bytes.

The artist-facing flow receives its reference from the ready storage inventory;
compact metadata preserves that full reference. Layout is selected by a reviewed
exact-source admission, never the editor or a mutable profile toggle. A new
extension request creates a distinct v3 ledger and records the selected layout
in its first claim before queue work. Legacy claims and slots stay unchanged.

Keep the public media API a ciphertext boundary. The catalogue supplies compact
root/scope, and the server uses its retained key solely to authenticate manifest
lengths before range traversal. This is preferable to unauthenticated offsets,
a client-supplied key or offset table, or downloading a complete pack. Nothing
on that path delivers a key or clear audio. Signed/session/Free key delivery and
canonical runtime access checks remain the entitlement boundary. Internal
derivation increases the media path's dependence on retained server keys; its
failures must be visible and must not fall back to a different format/provider.

A distinct compact HTTP path prevents standard and compact cache/route aliases.
One parameterized Fastify route keeps their rate-limit store and sending bound
shared; standard and compact also use one Bulletin logical/raw read budget.
Native range reads retain the shared uncancellable SDK lifetime accounting.
The client authenticates returned objects with the existing GCM context and
passes unchanged logical media to solo, adaptive and Room readers.

## Failure, persistence and operational boundary

Full graph retention/proofs, allowance charges, permanent nonce reservations,
writer lease, account cursor and ready reuse remain unchanged. A mismatched
extension, claim, inventory or reference refuses before new publication work.
A lost store acknowledgement reconciles the existing nonce/ciphertext; it does
not re-encode or repeat an included store. API caches retain no keys or clear
media, and cancelled native results cannot warm another selection.

No live admission, source, key, profile or deployment changes here. Old binaries
reject the new ledger/reference, so a later activation needs compatible service
and client delivery plus a state-preserving rollback plan. The dedicated
stopped-writer prepared-repair tool deliberately remains standard-only. Real
media/device, broader recovery and memory acceptance remain gates; a locally
modeled reduction in blocks is not a live performance claim.
