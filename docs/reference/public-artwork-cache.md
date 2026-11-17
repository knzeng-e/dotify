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

## Prepared system PNGs

[System artwork](../../web/src/features/player/systemArtwork.ts) keeps a separate,
page-memory LRU of successfully composed public PNGs. It stores only derived
pixels and their visual identity, never an audio source, key or listening grant.
A reopened solo/Room metadata owner can use a ready PNG on its first registration
instead of decoding and composing the same cover again.

Immutable gateway aliases share a CID/path identity. Small inline raster/SVG
images use their exact source; generated covers include their title and seed.
Mutable HTTP URLs, blob URLs and unknown/private schemes are not memoized. A
composition-version key includes the output size and badge layout; change it
when those pixels change.

| Resource | Bound |
| --- | --- |
| Completed PNG entries | 8; LRU eviction |
| Retained key/image strings | 8 MiB estimated as UTF-16 code units × 2, including source, sizes and type; not a browser heap measurement |
| Identity length | 16,384 code units; larger identities skip retention |
| Persistence | Page memory only; no additional Cache Storage or local storage |

An output exceeding the retention budget can still be delivered to the active
owner; it is not retained. Returned image descriptors are copies. Eviction drops
the cache reference without revoking the self-contained data URL already given
to a metadata owner. Decoded images/canvases are not retained.

Failed or cancelled preparation is not memoized, so a later attempt can retry.
This cache keeps public pixels across account changes; each metadata registration
still obtains the current title and artist, and disconnect/selection cancellation
remains authoritative. Sharing an album cover cannot reuse another track’s
attribution.

The [local artwork observation reference](system-artwork-observations.md) defines
preparation/publication timing separately from these cache limits. It retains no
image identity or pixels and does not acknowledge native display.

## System metadata boundary

[System artwork](../../web/src/features/player/systemArtwork.ts) obtains public
images from this shared path, then composes a PNG with the Dotify badge. Its
caller still owns cancellation and current-track metadata. A shared public
download may finish after disconnect, but it must not restore retired metadata.

### Recovery on foreground return

[The metadata publisher](../../web/src/features/player/systemArtworkPublication.ts)
owns the current track's assignment and cancellation; the React hook delegates
that lifecycle to it. If preparation falls back to source URLs, rejects, or the
Host rejects a metadata assignment, it can make **one additional attempt per
metadata owner** when the page returns to visible. Pending work finishes first;
a successful prepared PNG needs no additional composition or repaint. A return
while pending is remembered only until that work settles and can recover only
while the page is still visible.

This is an event-driven recovery, not polling or a background timer. Further
returns cannot start further attempts for that owner, even after a second failure.
Existing image/cache limits still apply. It does not call Play, Pause, seek,
authorization or key delivery, and never waits in the audio path. Disconnect,
selection change or replacement by another metadata owner prevents late
publication; cleanup does not clear another owner's metadata. A known failed
preparation is different from an OS that has not displayed an already registered
PNG: no display acknowledgement or native workaround is inferred.

Prepared-PNG reuse and bounded return recovery are implemented candidates. Actual
native lock-screen rendering, rapid track changes and timing remain separate
[#388 acceptance](../backlog/listening-controls-and-discovery.md). A browser
metadata fixture does not prove that iOS or a Host displays the cover promptly.

See [prepared-cache implementation evidence](../backlog/implementation/evidence/public-artwork-persistence-2026-11-13.md)
and [bounded return-recovery evidence](../backlog/implementation/evidence/system-artwork-return-2026-11-13.md).
