# Room life and artist visits

The room carries three kinds of social information: messages, transient typing,
and discreet activity. None changes audio transport, content-key access or money.

## Conversation

`room:typing` accepts only `{ active: boolean }` from admitted participants,
with eight updates per five seconds per socket. The server supplies the name and
socket id. The client sends at most one start/update per 1.5 seconds of typing;
blur, send, hiding the page, emptying the draft or changing panels stops it.
The server clears it after 4.5 seconds regardless of client behavior. The client
also expires the display locally, so a lost stop packet does not leave it stuck.
Draft content is never transmitted.

`room:chat` optionally carries `replyTo` (a buffered message id) and up to five
`mentions` (current participant socket ids). The server copies the reply excerpt
from its own bounded history and filters mention recipients to room membership.
Client-supplied badges and reply labels are ignored. A reply also counts as a
mention for its recipient. Mentions are ephemeral socket identities, not a
persistent social graph; reconnecting does not retroactively reassign mentions.

Chat and catalog suggestions use acknowledged, connected-only sends. An occupied
fetch-polling write queues the message until the transport drains instead of
discarding it as volatile traffic. Disconnected sends are refused, and a missing
acknowledgement preserves the draft with an explicit uncertain-delivery message;
there is no automatic resend or optimistic message. Typing and reactions remain
volatile because they are transient cues.

`room:pin` accepts `{ id: string | null }` only from the actual host. It selects a
buffered user message, broadcasts the canonical message (or null), expires after
ten minutes and is included in new-join snapshots. Pins neither grant moderation
authority nor preserve conversation after room closure.

## Activity and continuity

`room:activity` is server-originated `{ id, kind, text, ts, artist? }`. Kinds are
`joined`, `left`, `artist-joined`, `artist-left`, `track`, and `queue`. The latest
50 activities live separately from the latest 50 messages, so room arrivals cannot
evict the conversation. Adjacent ordinary joins/leaves within five seconds are
grouped for display. Confirmed tips retain the existing receipt-verified message
path and get a compact support row. The local visibility toggle hides both
activity and support rows; neither contributes to unread message counts.

Joins wait 1.2 seconds to avoid announcing a failed/very brief visit. Each listener
receives a random 32-byte continuity token, kept only in client memory and the
room's private server state. On transport loss, departure waits eight seconds.
Only a matching pending token suppresses the departure/rearrival pair; a matching
name alone never does. Explicit leave ends the visit immediately. A reconnect
creates fresh WebRTC and realtime membership; this token grants no host role,
keys or access. Pending state and timers are deleted at room closure.

Typing, activities, pins, messages, continuity credentials and verified artist
badges never appear on `/status`, public discovery or Statement Store beacons.
No notification sound is added; scrolling older messages never forces a return
to the bottom. The unread button moves only the chat scroll container.

## Artist dashboard and visits

Overview subscribes to the existing signaling discovery stream and matches the
room's complete runtime/content-hash pair against authoritative catalog releases.
Names and hash-only matches are insufficient. Display titles/artwork come from
the catalog. Playback is host-declared; presence counts connected sockets including
hosts, not unique humans or verified audible listens. Paused/missing playback
is distinguished, offline catalog/discovery values show unavailable, and rooms
whose hosts disconnect disappear from discovery until resumed.

The visit sheet defaults to an ordinary alias-only visit. The optional artist
announcement reuses the exact Dotify account/chain/signature-scheme session. If
none is usable, the artist's explicit Join action opens the normal reusable
sign-in session, with one wallet approval when needed. Opening the sheet or
joining without an announcement never signs in. A failed sign-in keeps the sheet
open with a retryable error; changing account, closing the sheet or unmounting
cancels the pending navigation. Signaling checks `/auth/identity` on its trusted
API, reads the active registered track and ArtistDirectory on its configured
chain, and requires the session account to equal the track's registered artist.
The welcome and badge use registry labels. Verification is bounded to six seconds
and fails if the room/track/membership changes; a failed check cannot grant a badge.
This verifies the publishing account at entry, not real-world identity or ongoing
ownership. The badge has no financial or access authority. A short reconnect
preserves that visit; changing accounts clears it. An older server that cannot
announce the visit is explicitly reported as an ordinary join.

Historical listening analytics are not inferred from connections or payment
receipts. Before adding them, define a consented qualified-play threshold,
pause/reconnect behavior, deduplication and retention policy. Existing dashboard
earnings remain receipt-based. This increment extends the existing confirmed
tip notification path; native receipt variants unsupported by that path are
still not broadcast solely from a client success claim.
