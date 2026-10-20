# Room life and artist visits

Owner-requested continuation of the room clarity work, 2026-10-10.

## Outcome

Make shared listening feel inhabited, and let artists find the rooms carrying
their releases and join the conversation by choice.

- Short-lived typing indicators, without transmitting drafts.
- Discreet, grouped arrival/departure activity, confirmed support, track changes
  and host queue additions. Local activity visibility control, no notification sound.
- Replies, explicit participant mentions with a separate unread badge, jump to
  first unread message, and a host-pinned message that expires after ten minutes.
- Artist Overview: live rooms matched by canonical runtime plus content hash,
  current playback state and connected-session counts, with unavailable states.
- Visit sheet with an unchecked announcement choice. Discreet means an ordinary
  participant visible under their room alias, not invisible attendance.
- Announced visits reuse an authenticated Dotify session, or offer one explicit
  sign-in on Join when the connected artist has no usable session, and registry
  proof that the account is the registered artist of the room's current release.
  Canonical artist welcome, message badge and departure; no extra signature per room.

## Boundaries

Base: tested dev `d60b20bbf05433d3068606d501375cc3582db0c6`, then fast-forwarded
to the tested #256 prerequisite `ab714438f4337015f7a83a2909e1e6fa52af8e26`.
This is a separate PR, stacked on #256 while its connection recovery awaits merge.

Counts describe connected sessions in playing rooms, not unique humans, verified
audibility or historical qualified listens. Listening analytics require a later
consent, qualification and retention decision; this release does not manufacture
a play count. Existing earnings continue to show confirmed value flows.

Identity checks grant presentation only, never room-host authority, keys or
payments. Artist status means the registered artist at entry, not a verified
real-world legal identity. Disconnected rooms remain hidden from public discovery
until their host reconnects. Short listener reconnects keep an opaque in-memory
continuity token for eight seconds; this does not preserve WebRTC authority.

## Acceptance

Verify typing expiry and membership, no drafts in public metadata, source-bound
replies/mentions, host-only pins, no phantom unread activity, mobile composer
space, artist identity spoofing, track-change races, opt-in default, direct room
navigation, short reconnect suppression and unchanged guest key separation.

Deploy signaling and the frontend together after #256. The installed mobile and
desktop Product hosts remain physical-device acceptance targets.

## Owner feedback — 2026-10-11

The owner reports a successful physical web/EVM announced artist visit after
the 0.1.46 release. The next requested usability correction reserves track
requests for guests, makes chat reply/pin actions discreet with a touch reply
shortcut, and explains the activity filter and host-tip binding. See the
[interaction follow-up](../explanation/room-live-conversation.md#quiet-controls-and-role-specific-queue--2026-10-11).
It retains server authorization, acknowledgement delivery and wallet-free guests.

The [guide and release-details record](../design/user-guide-and-track-details-proposal.md)
keeps the illustrated guide as follow-up work. PR #263 now implements the
structured `dotify.track.v2` publication fields and the story-first in-app
release sheet for the next test-data reset. It deliberately adds no migration
for earlier development manifests. Installed Product gesture checks and the
broader pilot reliability evidence remain open after this change.


## Live activity privacy amendment — 2026-10-17

The owner requests all-room totals for their tracks, including private rooms,
and artist discovery of public rooms beyond the listener radius. A separate
server-authorized artist activity view supplies aggregate room/session counts
and only opted-in public room cards. Link-only rooms never expose their IDs,
host names, locations or join actions through this view. Runtime ownership and
canonical release matching are verified by the server; a caller-supplied runtime
alone is insufficient. Existing explicit artist announcement and wallet-free
room guest behavior remain intact. See the
[W19 amendment](implementation/W19-nearby-rooms.md) and
[privacy contract](../design/dotify-nearby-discovery-privacy.md).

## October 18 follow-up

Owner-approved room presence, optional invitation identity, reversible Hide and
contribution continuity are tracked in [the shared evidence note](implementation/evidence/room-presence-tip-continuity-2026-10-18.md). This does not close outstanding
physical Host/location or funded-receipt acceptance gates.
