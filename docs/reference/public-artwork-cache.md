# Public artwork cache

The browser cache helps covers arrive sooner across catalog, player and system
metadata. Its source is [publicArtworkCache.ts](../../web/src/services/publicArtworkCache.ts).
It accepts public immutable IPFS image paths, including the Bulletin public-asset
relay. Gateway aliases share the same CID/path key. Audio/container/metadata
paths and non-IPFS references are excluded; image MIME and byte bounds still
apply to both cached and downloaded responses.

No wallet identity, session token or content key enters the cache key. This
module is not part of protected-audio access or key delivery.

## Delivery and storage

An in-memory hit returns its existing object URL and refreshes its LRU order.
Otherwise, one shared pending task checks optional Cache Storage, then uses the
ordinary bounded public-image delivery path when storage is missing, refuses
access, returns invalid data or exceeds its lookup budget.

The disk lookup budget covers opening the cache, matching the entry and reading
its body. A late native API result is ignored; a retired body read is cancelled
without waiting for a potentially stalled storage cancellation. Browser APIs
such as `open` and `match` themselves do not expose an abort operation.

Once an image is downloaded, its object URL becomes available before any disk
write. One best-effort writer may persist it and evict old disk entries. Other
images skip persistence while that writer is occupied, rather than accumulating
pending blobs or holding network-read slots. A permanently stalled writer can
disable further persistence for that page lifetime; memory/native image delivery
remains available. A skipped variant may need another download after reload.

## Source limits

| Resource | Bound |
| --- | --- |
| Cache Storage name | `dotify-public-artwork-v1` |
| Optional complete disk lookup | 500 ms |
| Concurrent background disk writers | 1; no write queue |
| Persisted image size / entries | 1 MiB / 48 entries |
| Downloaded or cached image body | 8 MiB |
| In-memory object URLs | 16 MiB / 48 entries; LRU eviction revokes the URL |
| Shared pending keys | 128 |
| Concurrent complete network reads | 4 |
| Network budget after a read slot is granted | 30 seconds; gateway header attempts retain their 8-second budget and 500-ms hedging |

The optional-storage budget is not an audio timeout. Cache Storage quota or
availability cannot withhold an already downloaded cover. Clearing this cache
affects cover reuse; it does not unlock listening or recover missing audio.

## System metadata boundary

[System artwork](../../web/src/features/player/systemArtwork.ts) obtains public
images from this shared path, then composes a PNG with the Dotify badge. Its
caller still owns cancellation and current-track metadata. A shared public
download may finish after disconnect, but it must not restore retired metadata.

PNG composition reuse and actual native lock-screen rendering remain separate
[#388 acceptance](../backlog/listening-controls-and-discovery.md). A browser
metadata fixture does not prove that iOS or a Host displays the cover promptly.

See [dated implementation evidence](../backlog/implementation/evidence/public-artwork-persistence-2026-11-13.md).
