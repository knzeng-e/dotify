# 20 - Room social layer: broadcast reactions and chat

## Sprint

Design track - social presence (delivers the "Option A" chatter path named by ticket 15)

## Priority

P2

## Objective

Make the room genuinely social: reactions and chat that every participant actually receives, attributed to real people, with recent conversation visible to late joiners. Before this ticket, the reaction petals were local-only ("visual delight, not broadcast") and no chat existed.

## Context

Rooms are host-access based (ticket 04): listeners join with a link, no wallet. The social layer must not weaken that. The signaling server (`web/server/signaling.mjs`) already relays room state and never carries audio; reactions and chat ride the same relay.

Statement Store was evaluated for chat history and rejected for this milestone: MAX_USER_TOTAL is 1024 bytes per user across active statements (~2 messages per person), default TTL 30s, and publishing requires an Sr25519 signer plus allowance - all three conflict with "the link is enough to be here". Its channel model (last-write-wins) is a genuine fit for a future presence layer, which is why the message shapes below are transport-agnostic.

## Delivered design

Protocol (documented in `docs/reference/socket-events.md`):

- `room:reaction` - any participant broadcasts one of six curated emoji; the server validates against an allowlist and echoes `{ id, emoji, senderId, senderName, ts }` to the whole room, sender included. The echo is the single render path: no optimistic divergence.
- `room:chat` - any participant sends text; the server sanitizes to a single line (max 280 chars, control characters stripped), appends to a per-room ring buffer (last 50), and echoes `{ id, text, senderId, senderName, ts }` to the room.
- `room:join` ack now carries `chatHistory` so late joiners see recent conversation.
- Rate limits per socket, fail closed and silent: 10 reactions / 5 messages per 5-second window (`createWindowLimiter` in `signaling-utils.mjs`).
- Chat is in-room only: held in the same in-memory room Map as `playerState`, wiped when the room closes, never exposed on `/status`, never logged.

Client (`web/src/hooks/useSession.ts` via `SessionProvider`):

- `chatMessages` mirrors the server buffer (client cap matches the server's 50); seeded from the join ack, cleared on leave/close.
- `reactionFeed` keeps a short sliding window; `PlayerView` turns fresh feed entries into rising petals.
- `sendChatMessage` / `sendRoomReaction` no-op outside a room.

UI:

- `web/src/components/RoomChat.tsx` - the "presence/chatter aside" from ticket 15: message list with real display names and avatar hues, the curated reaction row, and a "Message the room" input. Mounted in the room-mode lower grid (session presence | chat | current track on wide screens).
- Reaction petals over the cover now carry the sender's initials in their name-hashed hue (Constellation honesty rule: every animated pixel maps to real data, including whose reaction it was). The old cover react bar, which phase C CSS had already hidden, was removed; the chat aside is the one social cluster.

Curated emoji allowlist: `ROOM_REACTION_EMOJI` in `web/server/signaling-utils.mjs`, mirrored as `ROOM_REACTIONS` in `web/src/shared/social.ts` (keep in sync; the server copy is authoritative).

## Constraints

- Room guests stay wallet-free; social events carry display names only, never addresses.
- Fail closed: malformed, non-participant, or over-limit events are dropped with no error channel to probe.
- Honesty rule: nothing renders that the room did not actually receive.
- No persistence: chat dies with the room, by design.
- Straight ASCII in source; hyphens only.

## Acceptance criteria

- A reaction sent by any participant appears as an attributed petal for everyone in the room. (Covered by signaling tests.)
- A chat message reaches every participant sanitized and attributed; a late joiner sees up to the last 50 messages. (Covered by signaling tests.)
- Rate limits drop excess events silently; non-participants cannot inject events; `/status` never exposes chat. (Covered by signaling tests.)
- Existing room flows (create, join, WebRTC pairing, playback modes, preview gating) unchanged.

## Non-goals

- Persistent chat history, moderation tooling, or read receipts.
- Emoji picker beyond the curated six.
- Statement Store presence layer (future work; the transport-agnostic message shapes in `web/src/shared/types.ts` are the seam for it - see ticket 12 for the propagation model it would serve).

## Delivery notes

Delivered on branch `feat/room-social-layer` (branched from the Constellation phase C design branch). Server behavior covered by 7 new integration tests in `web/server/signaling.test.mjs` (broadcast + attribution, allowlist enforcement, sanitization + late-join replay, history cap, rate limiting, participant verification, /status privacy).
