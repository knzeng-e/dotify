# 15 - Immersive room parity

## Sprint
Design track - Living Light experience

## Priority
P2

## Objective
Bring the shared listening room (the player while in a session) to visual parity with the prototype's full-bleed room: header room-code pill with one-tap copy, access chips, a "following the host - in sync" note, and a presence/chatter aside. Presence + cover-glow + reactions already landed (#13); this ticket closes the remaining layout and social gaps.

## Context
The room is `web/src/views/PlayerView.tsx` in `mode === 'host' | 'listener'`. Reference: `design/Dotify-design/app/screens-room.jsx` and `room.css`, screenshots `room-transport.png`, `photo-presence.png`, `room-enter.png`. The prototype room has: a top room-code pill + "Copy link", `Unlocked` / `Artist-owned` access chips, a synced transport with "Following {host} - in sync", floating reactions, and a right-side glass aside listing people plus a chat feed with a "Say something to the room..." input.

## Required work

- Room header: surface the room code as a pill with a one-tap "Copy link" next to it (the session copy action already exists as `onCopySessionLink`); currently it is buried in the session form.
- Access state as chips: render `Unlocked` / `Free for humans` / `{price} DOT` and an `Artist-owned` trust mark as pills (reuse the access-chip styling), replacing the plain `.access-badges` text spans.
- Sync note: for listeners, show "Following {hostName} - in sync"; for the host, "You are hosting - everyone hears what you play."
- Presence chatter (decide one, do not fake a backend):
  - Option A (preferred if cheap): wire a lightweight room chat over the existing Socket.IO channel (`useSession`) so "Say something to the room" actually broadcasts to peers.
  - Option B: ship presence + reactions only and omit the chat input until a channel exists. Do NOT render a chat box that silently drops messages.
- Optional: full-bleed room layout (cover stage centered, presence aside on the right) closer to the prototype, if it does not destabilize the existing transport/WebRTC wiring.

## Constraints

- Preserve all session/WebRTC/access-gate logic in `PlayerView`.
- Honesty rule: no UI element may imply social broadcast that is not actually wired (brief UX risk: "over-simplifying so access reads as a lie").
- Room guests stay wallet-free.
- Straight ASCII; hyphens only.

## Acceptance criteria

- Room shows a copyable code pill, access chips, and a correct host/listener sync note.
- Either chat broadcasts over Socket.IO, or the chat input is absent (no dead input).
- Access gates, host stream, and join-by-link still work.

## Non-goals

- Persistent chat history or moderation.
- Replacing the WebRTC/signaling transport.

## Senior-engineer notes
Reactions and presence are already local and harmless. Chat is the one place where decoration would become a lie - wire it for real or leave it out.
