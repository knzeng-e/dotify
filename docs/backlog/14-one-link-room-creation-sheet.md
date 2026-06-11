# 14 - One-link room creation sheet

## Sprint
Design track - Living Light experience

## Priority
P0 in the design brief ("One-link room creation"). P1 overall, gated behind hosted signaling (#4 / `04-hosted-signaling-room-join-links.md`).

## Objective
Make starting a room feel "as easy as sharing a link". Replace the implicit room-start (open track -> player session form) with a single warm sheet titled "As easy as sharing a link": pick what is playing, see the live room link, set a mood, then open and copy.

## Context
Today, "Start a room" (`ListenView` CTA, `PlayerDock` CTA) calls `handleOpenArtistRoom` in `App.tsx`, which opens the track and calls `session.createSession`, navigating to the player. There is no friendly creation surface; the only room controls live in `PlayerView`'s session form. The prototype's `CreateRoomModal` (`design/Dotify-design/app/screens-modals.jsx`, screenshot `modal-create3.png`) is the target.

## Required work

- Add a `CreateRoomModal` (or `RoomCreateSheet`) component reusing the existing modal shell (`.modal-backdrop` / `.modal-card`).
- Contents:
  - Eyebrow "Start a room", title "As easy as sharing a link", subcopy "Pick what is playing. Anyone with the link can listen with you - no wallet, no sign-up."
  - Preview card: track cover + title + artist + the live room link (the real session link from `useSession`, e.g. the hosted join URL; show a placeholder until the code exists).
  - "Now playing" picker across the loaded catalog (`catalogTracks`), defaulting to the current/selected track.
  - Optional "Mood" chip row (Late night / Morning / Focus / Drive / Together). Mood is a local label only unless room metadata gains a field; do not fabricate persistence.
  - Primary "Open room and copy link" -> opens the track, calls `createSession`, copies the link, toasts; secondary "Cancel".
- Wire `onStartRoom` from `ListenView` and `PlayerDock` to open this sheet instead of starting immediately.
- Keep the existing in-player session form working (host/join), or have it defer to this sheet for creation.

## Constraints

- Guests must never be pushed through wallet bureaucracy to start or join (room access doctrine; brief UX risk).
- Only the real session link may be shown as copyable; if the link is not ready yet, show a clear pending state, not a fake URL.
- Preserve WebRTC/Socket.IO host flow unchanged.
- Straight ASCII; hyphens, not em/en-dashes.

## Acceptance criteria

- "Start a room" from Home and the dock opens the sheet; choosing a track and confirming opens a live room and copies the real link.
- Closing the sheet does not start a room.
- No behavior regression in join-by-code or the player session panel.

## Non-goals

- Mood-based room discovery or persistence.
- Changing the signaling/transport layer (depends on #4).

## Senior-engineer notes
This is the product's headline promise ("create a room -> share a link -> listen together"). The sheet is a thin, honest wrapper over the existing `createSession`; do not let it imply capabilities (persisted mood, vanity links) the backend does not have.
