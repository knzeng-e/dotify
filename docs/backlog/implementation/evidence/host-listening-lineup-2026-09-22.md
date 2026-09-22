# Host listening lineup evidence — 2026-09-22

## Delivery identity

- Branch: `feat/host-listening-queue`
- Reviewed base: `dev` at `dce9e5fe9eab3a1e3471ebd0f95d634561d4067c`
- Scope: promote the room lineup into real shared playback, make natural track
  endings advance, and make Previous follow actual playback history.

## User-visible behavior

- A host can add catalog tracks, reorder or remove them, clear the lineup, and
  play the next entry.
- Everyone in the room sees the same ordered Up next snapshot. Late listeners
  and a reconnecting host receive the current snapshot.
- Next and natural track endings consume the first queued track before falling
  back to catalog order.
- Previous restarts the current title after three seconds. Near the beginning,
  it returns to the title that actually played before it.
- Every transition reuses the existing access check. A queued protected title
  can stop at the access gate; adding it never signs or submits a payment.

## Data and trust boundaries

- `room:lineup` is host-only at the signaling server. Listener mutations are
  ignored.
- The server sanitizes, deduplicates, and caps the lineup at 12 entries.
- Shared entries contain catalog identity plus display metadata. Audio URLs,
  manifests, content-key references, wallet addresses, and payment state are
  never included.
- The lineup lives only in room memory, is absent from `/status`, and disappears
  with the room. Playback history is a bounded in-memory browser ref and is not
  analytics or durable community memory.
- The signaling server still trusts host-declared catalog display metadata,
  matching the existing `room:track` boundary. It does not resolve catalog
  records independently.

## Validation

| Check | Result |
| --- | --- |
| Frontend unit suite | 594 passed |
| Signaling integration suite | 60 passed |
| Playwright suite, two workers | 117 passed |
| Frontend production build | passed |
| Frozen Product DevNet build | passed |
| ESLint | 0 errors; 3 pre-existing warnings |
| Backlog offline consistency | passed |
| `git diff --check` | passed |

The browser journey uses two contexts: a desktop host publishes a lineup, a
mobile listener receives it, an ended event advances playback for the room, and
Previous returns to the real prior title. Desktop and 390 x 844 mobile captures
were inspected locally; generated Playwright artifacts remain untracked.

## Deliberate limits and follow-up

- Participant requests remain free-text suggestions. They are not silently
  resolved or promoted into playback.
- The lineup is single-host and ordered per Socket.IO connection. It does not
  yet carry a revision or acknowledgement protocol; after reconnect, the server
  snapshot is authoritative.
- There is no persistence, voting, participant reordering, crossfade, or
  listener-side catalog resolution in this slice.
- Queued access failure is explicit rather than bypassed. Seamless protected
  transitions require the separate access-prefetch and rights work.
- The signaling deployment and frontend must ship together. Rollback restores
  the previous local planning UI rather than preserving an incompatible shared
  protocol.
- The next architectural step is to carry the same bounded message shape over
  the Product SDK signaling / Statement Store seam, behind a controlled
  adapter, without changing the room interaction first.
