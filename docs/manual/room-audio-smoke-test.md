# Manual smoke test - real room audio across two devices

The automated room-join coverage (`web/e2e/room-join.spec.ts`) runs real Socket.IO
signaling and real WebRTC negotiation, but it streams a synthetic near-silent audio
track so it stays deterministic in CI. It deliberately does **not** verify that real
music is audible end to end.

This manual checklist covers that last mile: a host on one device and a listener on
another actually hearing the same track in sync, with no wallet friction for the guest.

## Prerequisites

- Two devices (or two machines) on networks that can reach the signaling server.
- A running signaling server and web app:

  ```bash
  cd web
  npm install
  npm run dev:listen    # starts the signaling server + Vite dev server
  ```

- For hostile networks (symmetric NAT), configure a TURN relay before testing:
  `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (STUN alone is not enough).

## Steps

1. **Host** - open the app, pick a playable track, and open a room ("Start a room" ->
   "Open the room"). Confirm the room header shows a room code and a copy link.
2. **Host** - press play. Confirm audio plays locally and the room shows you as host.
3. **Listener** - open the copied `#/rooms/<id>` link on the second device. Confirm:
   - no wallet connection, signature, or payment is requested;
   - the listener enters the room and shows the host as "In sync";
   - audio is audible and tracks the host's playback position.
4. **Sync** - on the host, pause/seek/resume. Confirm the listener follows within a
   second or two.
5. **Protected track, authorized host** - host a track the host has access to. Confirm
   the host hears full audio and the listener hears the full stream without any key
   prompt.
6. **Protected track, unauthorized host** - host a protected track the host lacks access
   to. Confirm the host sees the discreet unlock CTA, the room plays the 42% preview, and
   the playlist auto-advances when the preview ends. The listener is never asked for a
   wallet or key.
7. **Host leaves** - close the host tab/app. Confirm the listener sees a clear "host left"
   / "room closed" state rather than a frozen player.

## What to record

- Devices, browsers, and network types used.
- Time-to-audio for the listener after opening the link.
- Any case where audio did not start (note whether a "Start audio" tap was required -
   browsers can block autoplay until the listener interacts).
- Any sync drift beyond a couple of seconds.

## Notes

- Room access is host-based: only the host satisfies the track access policy. Guests
  receive only the ephemeral WebRTC stream - never the encrypted source or a content key.
- This is product-policy verification, not a DRM guarantee: a listener can of course hear
  (and record) what is streamed to them, and Dotify does not claim otherwise.
