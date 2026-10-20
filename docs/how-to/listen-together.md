# Listen together

Use the [Web app](https://muzinga.netlify.app), or open Dotify in a supported
Product Host. A room invitation is enough to join as a guest: no wallet,
signature or access payment is required just to hear the host's stream.

## Open a room

1. Choose music in **Music** and select **Open a room**. You can also start from
   **Rooms** and choose a track there.
2. Enter **Your name or nickname**. Optionally give the room a name and a short
   invitation so people can recognize its purpose when the music changes.
3. Choose who can find it. **Link only** is the default.
4. Select **Open the room**, then use **Invite** to share its link or QR code.

The host needs listening access to the selected track. Free music does not
require a wallet; protected music may require sign-in, a purchase or a supported
personhood proof. If access is missing, choose another playable track or follow
the listening-access action. Guests do not inherit that wallet requirement.

## Find or join a room

Open an invitation, or visit **Rooms**:

- The room galaxy searches automatically. Worldwide rooms can appear while
  a local position is still being obtained.
- Allow location when asked to find nearby rooms. Use the range control to
  choose an approximate search distance up to 42 km.
- Inspect a room to see its host, current music, connected count and visibility.
  Select **Join**, enter your nickname, then confirm entry.
- If someone sent a code instead, enter it in **Room code or link**.

Use the list alternative if you prefer it to the radar. Connected counts are
sessions, including the host, not verified unique people or proof that every
device can hear audio. An artist-presence badge appears only after the artist
has chosen to announce a verified visit.

## Choose visibility

| Choice    | Who can discover the room?                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Link only | People with an invitation; the room is not listed in discovery.                                           |
| Nearby    | People whose chosen approximate search area overlaps the host's allowed area. Both distance limits apply. |
| Everyone  | Worldwide discovery, without requiring the listener to share location.                                    |

Change visibility from **Who can find this room?** in the room's People area.
Changes in that sheet apply when you select **Done**; dismissing it leaves the
saved choice unchanged. Nearby availability depends on working device/Host
location support and permission. Sharing a network does not establish that two
devices have a usable location fix.

Exact coordinates are not published in discovery. Distance labels describe
approximate bands; the radar is not a geographic map. Link-only rooms can
contribute to private artist activity totals without exposing their identity.

## While listening

Chat, react, or request a track for the host to consider. Guests can mute or
pause their own audio; the host controls the shared track. Browsing Music or
Rooms keeps the session available through the compact player.

**Hide** affects your own discovery view during this visit. Restore it through
**Hidden rooms** then **Show again**, if it is still available. **Report** also
hides the room and records an aggregate safety counter; it does not create a
durable moderation case, close the room or change access.
See the [discovery privacy contract](../design/dotify-nearby-discovery-privacy.md).

Tips are voluntary and separate from listening access. Connect when prompted;
the draft should resume with that identity. Approve only the intended payment.
Confirmation can take time: a pending result is not a reason to send it again.
Keep the contribution reference and use its status-check action instead.
See [Check a pending payment](recover-a-payment.md) for recovery steps.

## If something interrupts

- **No nearby results:** wait for the location status, check device permission
  and try a wider range. A host may be Link only, outside either permitted area,
  or reconnecting. A direct invitation remains an alternative.
- **No audio:** use the displayed play/retry action and check local mute. A
  connected room or a moving progress bar alone does not prove audible media.
- **Reconnecting:** allow the session to recover. Closing a room explicitly
  removes it; changing apps does not intentionally close a healthy host session.
- **Unsupported Host:** follow the offered browser continuation when present.
  Native location and audio depend on the installed Host, OS and permissions.

For technical details, see [room mechanics](../explanation/listening-rooms.md).
For testing a release, use the [pilot plan](../operations/pilot-release-plan.md).
