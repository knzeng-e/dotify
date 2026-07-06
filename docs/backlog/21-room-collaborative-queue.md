# 21 - Room collaborative request queue with host veto

## Sprint

Design track - social presence (first slice of the "village square" room-social
item in `improvement-plan.md`, and the queue named by ticket 12's propagation
model).

## Priority

P2

## Objective

Deepen the room from a broadcast surface into a shared space where everyone
shapes what happens next: any participant proposes a track to hear, the whole
room sees the shared queue attributed to real people, and the host vetoes or
clears. Builds directly on the ticket 20 social layer (reactions + chat).

## Context

Rooms are host-access based (ticket 04): listeners join with a link, no wallet.
Listeners have no in-room catalog browser, so a playable, catalog-bound queue
would require either faking listener catalog access or wiring the WebRTC /
content-key access path - both violate the honesty rule or destabilize the
spine. The honest first slice is therefore a request queue: shared intent that
the host curates, never a claim of auto-play. Playable, catalog-backed queue
items and host-click-to-play are explicit future work (see Non-goals).

The queue rides the existing signaling relay exactly like chat, and its message
shape is transport-agnostic so a future Statement Store presence layer can adopt
it (same seam as ticket 20).

## Delivered design

Protocol (documented in `docs/reference/socket-events.md`):

- `room:request` - any participant proposes `{ text }`; the server sanitizes to
  a single line (max 120 chars, control characters stripped), appends to a
  per-room queue capped at 20, rate-limits per socket (5 per 10s), and
  rebroadcasts the full queue.
- `room:requests` - server -> whole room, the full queue after every change.
  This is the single render path: the client never renders optimistically.
- `room:request:remove` `{ id }` and `room:request:clear` - host-only veto,
  ignored for non-host sockets (fail closed). Each successful change
  rebroadcasts `room:requests`.
- `room:join` ack now carries `requests` so late joiners see the current queue.
- The queue lives in the same in-memory room Map as chat: wiped when the room
  closes, never exposed on `/status`, never logged. Names only, never addresses.

Client (`web/src/hooks/useSession.ts` via `SessionProvider`):

- `requestQueue` mirrors the server's full-list broadcast (capped to match the
  server); seeded from the join ack, cleared on create/leave/close.
- `sendRoomRequest` / `removeRoomRequest` / `clearRoomRequests` no-op outside a
  room; host-only actions are enforced by the server, not trusted from the
  client.

UI:

- `web/src/components/RoomRequests.tsx` - a queue aside that reuses the RoomChat
  visual language: attributed rows (real display names, name-hashed avatar
  hues, timestamps), a "Request a track" input, and host-only veto (X) per row
  plus a Clear action in the panel title.
- Mounted in the room-mode grid stacked with `RoomChat` inside a
  `room-social-column`, so the session | social | current-track column layout is
  preserved.
- `PanelTitle` gained an optional `action` slot for the host Clear control.

Curated constants: `REQUEST_TEXT_MAX_LENGTH` / `requestQueueLimit` in
`web/server/signaling.mjs` (authoritative), mirrored in
`web/src/shared/social.ts`.

## Constraints

- Room guests stay wallet-free; requests carry display names only, never
  addresses.
- Fail closed: malformed, non-participant, over-limit, or non-host-veto events
  are dropped with no error channel to probe.
- Honesty rule: nothing renders that the room did not receive, and the UI never
  implies a request auto-plays.
- No persistence: the queue dies with the room, by design.
- Straight ASCII in source; hyphens only.

## Acceptance criteria

- A request sent by any participant appears in the shared queue for everyone,
  attributed. (Covered by signaling tests.)
- A late joiner receives the current queue in the join ack. (Covered.)
- Only the host can veto or clear; listener veto/clear are ignored. (Covered.)
- Non-participants cannot inject requests; rate limit and cap drop excess
  silently; `/status` never exposes the queue. (Covered.)
- Existing room flows (create, join, WebRTC pairing, playback modes, preview
  gating, chat, reactions) unchanged.

## Non-goals

- Playable, catalog-backed queue items or host-click-to-play (needs an in-room
  catalog surface and touches the access path; future slice).
- Upvotes / reordering / persistence / moderation tooling.
- Statement Store presence layer (future work; the transport-agnostic message
  shape is the seam - see ticket 12).

## Delivery notes

Delivered on branch `feat/room-collaborative-queue` (branched from `main`).
Server behavior covered by 6 new integration tests in
`web/server/signaling.test.mjs` (broadcast + attribution + late-join replay,
host-only veto/clear with listener rejection, participant verification, rate
limiting, cap enforcement, `/status` privacy).
