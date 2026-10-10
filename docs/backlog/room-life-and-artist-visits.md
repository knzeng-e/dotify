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
