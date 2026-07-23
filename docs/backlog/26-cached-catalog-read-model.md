# Ticket 26 - Cached catalog read model

GitHub issue: #86

Priority: P0

Track: Production spine

Status: implemented on `codex/86-catalog-read-model`; Project 5 remains In
Progress until review and public performance evidence are attached.

## Goal

Replace browser-side ArtistDirectory x SmartRuntime enumeration with one fast,
cacheable catalog request while keeping artist SmartRuntimes as the source of
truth.

## Delivered architecture

- The backend persists artists, releases, access policy, price, cover refs,
  metadata refs, runtime addresses, royalty summaries, registration block, and
  latest source block in an atomic JSON snapshot.
- Startup loads the snapshot before RPC work, then indexes confirmed
  `ArtistRegistered`, `TrackRegistered`, `TrackDeactivated`,
  `TrackReactivated`, and `TrackAccessModeChanged` events.
- A periodic deterministic reconciliation re-enumerates the directory,
  runtimes, track records, and royalty splits to repair missed events.
- Each snapshot stores the indexed block hash. A canonical hash mismatch, chain
  rewind, identity change, or explicit operator request triggers full reindex.
- `GET /api/catalog` is paginated and returns `ETag`, `Cache-Control:
  public, max-age=30, stale-while-revalidate=120`, index state, last indexed
  block, observed head, and block lag.
- Artist and release detail endpoints expose the same revision and cache
  contract.
- With `VITE_DOTIFY_API_URL` configured, Home renders cached browser data
  immediately and refreshes through one API request. It does not enumerate
  runtimes, track records, or royalty splits from RPC.
- Direct chain reads remain for access checks on track intent and transaction
  preflight. Local/demo mode without an API retains the old direct catalog path.

## API states

| State | Meaning |
| --- | --- |
| `fresh` | A current persisted snapshot is available. |
| `stale-cache` | The snapshot exceeded `CATALOG_STALE_AFTER_MS` without a known dependency failure. |
| `rpc-outage` | Chain polling failed; cached data may still be served. |
| `indexer-outage` | Snapshot loading or persistence failed; in-memory data may still be served. |
| `empty` | A successful index contains no releases. |

## Persistence and replay boundary

The JSON snapshot is a deliberate single-process production baseline. Operators
must mount `CATALOG_SNAPSHOT_PATH` on durable storage and must not point
multiple writers at the same file. Horizontal API scaling needs a shared
transactional store in a follow-up.

Event changes are indexed only after `CATALOG_CONFIRMATIONS`. Shallow reorgs are
therefore held back. A reorg crossing the checkpoint is detected by block-hash
comparison and repaired by deterministic full-state replay. The replay and
event-update paths have deterministic tests.

Run an explicit rebuild with:

```bash
cd services/api
npm run catalog:reindex
```

## Acceptance status

- Home renders from one catalog request: automated service coverage and
  production-mode code path delivered.
- Indexer lag and last indexed block observable: delivered in response metadata
  and headers.
- Reorg/replay documented and tested: delivered.
- Browser startup runtime/royalty enumeration removed in API mode: delivered.
- Stale cache, indexer outage, RPC outage, and empty states: delivered and
  tested.
- Warm/cold p75 and useful-content budgets: require public deployment traces at
  the production seed size before #86 moves to Done.
