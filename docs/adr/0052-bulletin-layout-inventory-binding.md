# 0052 — Bind a physical audio layout before publication intents

Date: 2026-11-11. Status: implementation candidate, **not activation**. Refs #407.
Builds on [ADR 0051](0051-bulletin-compact-layout-study.md).
[Validation evidence](../backlog/implementation/evidence/bulletin-layout-binding-2026-11-11.md):
436 API tests pass, plus typecheck/build and documentation checks.

## Decision and scope

Make the preferred compact graph deterministic and bind its layout to the durable
publication journal. Keep every current application publication on the existing
path-based graph. This slice supplies the format constructor and recovery
invariant needed before versioned reader integration; it does not expose a
compact publication switch, mint a new audio reference or install range delivery.

A graph with no layout field means `unixfs-files-v1`. That is the only legacy
interpretation; unknown strings, null and future versions refuse. The new graph
constructor explicitly returns `rendition-pack-v1` and writes `layout.json` with
exactly:

```json
{
  "schema": "dotify.bulletin.rendition-pack.v1",
  "chunkSize": 262144,
  "startup": "init-and-first"
}
```

This is deliberately distinct from the research marker. Chunk size and startup
policy are fixed, with no arbitrary offset table, flag or reader fallback. The
ordinary strict manifest defines logical objects, order and encrypted lengths.
Per quality, init and segment zero remain separate; subsequent ciphertext objects
are concatenated in order into `pack.bin`. A one-segment quality has no empty
pack. The original encrypted archive and exact manifest bytes remain present.
The normal 256-KiB importer and CID readdressing code build the physical graph.
All renditions, the archive and metadata remain dependencies of root readiness.

The constructor never obtains a content key or changes HMAC/GCM, nonces or
additional data. Custody still must authenticate the complete logical input
before graph construction; a future reader must authenticate the manifest/scope
before trusting offsets and apply ordinary object GCM after reconstruction.

## Durable state transition

Existing standard jobs, including newly created standard jobs, retain their
strict `dotify.bulletin.media-job.v2` bytes/shape. No startup migration or rewrite
of existing inventories, profiles, claims, queues or nonce ledgers is performed.
Only the internal compact builder creates a `dotify.bulletin.media-job.v3`
inventory with required `layout: rendition-pack-v1`. V2 cannot acquire a layout
field; v3 cannot omit it or claim standard/future layouts.

The writer validates the selected graph layout, then persists the layout, root,
ordered block inventory, source scope, generation, budget and pipeline before
its first intent/broadcast. Every retry reconstructs and compares the same
binding. A layout mismatch refuses before status/proof/store work, even if every
other graph field is identical. Lost acknowledgements still reconcile the saved
sender/nonce against finalized receipts; layout changes grant no new attempt,
key, generation, nonce or allowance.

The existing exclusive writer and account barrier remain authoritative. A crash
between owner and job persistence remains a visible reconciliation condition;
this change does not automatically repair that ordering. A changed root or
layout is never a reason to re-encrypt or adopt a prior claim as new work.

## Current application and rollback boundary

No profile, admission extension, route, encoder or queue imports/selects the
compact builder. Current publication composition, release-inventory validation
and prepared recovery explicitly refuse a compact inventory before deriving an
unqualified path-based reference. Startup refuses before loading a signer or
opening a transport. Standard audio and public-asset paths remain unchanged.

The low-level graph writer can exercise the new format only through its existing
internal graph-builder seam, used here with simulated storage in tests. It
returns a root, not an externally registered listening reference. Public policy
and listening authorization remain separate from this format constructor.

The new modules are compiled into the API image, but this PR performs no image
upload or maintenance. Existing code can continue reading v2 journals. If a
future approved deployment ever creates v3 journals, rolling back to a v2-only
binary must be blocked; retain compatible readers/journal code or disable new
publication. Do not remove the new layout field to force compatibility.

## Next integration gates

The external registered reference must identify the layout explicitly, with
canonical Web/API/Host dispatch and no CID-only or old-reader fallback. It is
intentionally not minted by this PR. Before enabling it, implement bounded range
resolution, manifest/GCM composition and cache/cancellation/uncancellable SDK
lifetime behavior in both API and native Host. Bind the exact selected layout in
reviewed per-identity admission before queue work; never add it to an old claim
or infer it from a mutable global setting. The journal binding here is necessary
but is not that future admission authority.

Then prove unchanged legacy playback, real AAC startup/seek/adaptive quality,
Room/background continuity, memory/copy pressure, complete-graph proofs and
process restart/recovery.
The synthetic 108 → 60 blocks and nine → six modeled waves remain a planning
result, not a live speedup. The public cover/metadata tail and later-segment read
amplification remain open. Activation/funded trials need a separate concrete
operational plan and budget. #407 stays open and ahead of Room/artwork/CASH.
