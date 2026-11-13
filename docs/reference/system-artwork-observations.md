# System artwork observations

This reference defines the optional `artwork` field in the explicit
`dotify.audio-diagnostics.v1` support report. It helps distinguish Dotify's image
preparation from metadata registration. It does not measure native lock-screen
display or acoustic output. Follow [the device check](../how-to/check-system-artwork.md)
to collect a matching observation.

## Ownership and privacy

[systemArtworkObservation.ts](../../web/src/features/player/systemArtworkObservation.ts)
keeps at most **64 events in page memory**. A metadata owner gets a numeric attempt
and monotonic start time. Each event records only the approved phase, elapsed
milliseconds, wall-clock timestamp, page visibility and optional image kind.
No title, artist, image URL/CID/pixels, account, Room, key, error text or arbitrary
detail is retained. The observer performs no network, storage or logging operation.

[The shared support serializer](../../web/src/features/catalog/audioStartupTelemetry.ts)
whitelists fields, rejects invalid timing/phases and replaces internal attempt
numbers with numbers local to that export. Artwork and audio attempts are distinct
namespaces; equal numbers do not link them. The existing explicit **Copy support
report** action includes these observations; opening About sends and copies nothing.
Reloading loses them. Clearing diagnostics discards history and ignores pending
observers from the cleared generation. A missing phase is unknown, never zero time.

Observation does not introduce another metadata, image or playback owner. The
existing hook still cancels retired work and checks that the same metadata object
is current before replacing it. Cancelling a shared public-image consumer cannot
cancel someone else's image request; a late image must not restore retired metadata.
The [public-artwork cache contract](public-artwork-cache.md) owns its resource limits.

## Fields and phases

| Field | Meaning |
| --- | --- |
| `attempt` | Export-local artwork metadata-owner number; not a track or audio-attempt identifier |
| `elapsedMs` | Monotonic milliseconds since that owner began |
| `timestamp` | Observed wall-clock milliseconds; do not use a changed device clock as a precise latency |
| `visibility` | `visible`, `hidden` or `unknown`; hidden does not prove the phone is locked |
| `kind` | `png` for a prepared PNG publication, `url` for source-image candidates, or `none` for metadata without artwork |

| Phase | Observed boundary |
| --- | --- |
| `requested` | An enabled current-track metadata owner begins |
| `prepared-hit` | A completed prepared PNG is reused without another decode/composition |
| `image-load-started` → `image-ready` | Immutable public-image acquisition, including optional disk lookup, queueing, network when needed and response validation |
| `decode-started` → `decoded` | Browser Image loading/decoding; a mutable HTTP candidate can include network time here |
| `decoded` → `composed` | Canvas composition and PNG encoding with the existing Dotify badge |
| `fallback` | Preparation failed and the ordinary source-image candidates remain available; this is not a composed PNG |
| `metadata-published` | Dotify's `MediaSession.metadata` assignment returned; an initial URL/empty publication can precede the prepared PNG |
| `failed` | This metadata/preparation path failed without interrupting audio; the last preceding phase provides context |
| `cancelled` | A pending metadata owner was retired; later completion cannot publish into it |
| `retired` | A settled metadata owner was cleared or replaced |

The initial metadata publication may contain only URLs or no image; inspect
`kind` and the later PNG publication rather than interpreting the first assignment
as finished artwork. Reopening a cover can have `prepared-hit` and an immediate PNG
publication, without cold-load phases. No native-display acknowledgement is implied.

## Platform boundary

The [W3C Media Session working draft, 9 November 2026](https://www.w3.org/TR/2026/WD-mediasession-20261109/)
describes platform metadata updates and artwork fetching separately from the
page's assignment. Display depends on the platform and its selected active media
session. This report deliberately stops at the boundary Dotify can observe. An
operator must separately record actual cover appearance, current title/artist and
native controls on the tested device; browser registration is not device acceptance.
