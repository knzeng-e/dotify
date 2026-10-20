# Live room conversation

## Purpose and scope

This user-requested UX follow-up to W28 and W27 makes the shared listening
room feel like one live space: music, conversation and reactions together.
It does not migrate delivery to Celerity or close the native-delivery work in
[#214](https://github.com/knzeng-e/dotify/issues/214).

The design borrows familiar live conventions, not another platform's product
model: compact inline messages, explicit catch-up after reading history, and
reactions beside the shared experience. Reference patterns:
[Twitch chat basics](https://help.twitch.tv/s/article/chat-basics),
[YouTube live chat](https://support.google.com/youtube/answer/15268877?hl=en),
and [YouTube vertical live](https://support.google.com/youtube/answer/13822251?hl=en).
No engagement ranking, fabricated audience, permanent chat or payment feature
is introduced.

## Presentation and ownership

`useSession` remains the source of accepted chat and reaction events.
`RoomChat` renders a bottom-aligned conversation stream, preserving the
reader's position when they scroll into history. New activity produces a
catch-up button and an unread dot on Chat, not an automatic jump. Returning
from another room tab resumes following only when the reader was following
before leaving. Hidden chat is not announced by its live region.

Messages are ordinary escaped text. The Host label compares the sender's
session ID with the active host ID, never their display name. You identifies
the current socket session, not a wallet or a verified human. Names and actual
room counts retain their existing meaning.

The composer preserves its draft until a positive server acknowledgement.
Rejection or uncertain delivery keeps the text and the existing actionable
error. It does not resend automatically. IME composition Enter is not a send.
The 280-character limit and server rate limits are unchanged.

`RoomReactions` sits below the transport in Chat, Queue and People. Two quick
reactions lead to the existing six-choice palette. It renders only received
session events. Sending is best effort; a local click is not evidence of
delivery to all participants. The attribution is the latest received sender,
not an invented popularity count.

At most six visual reactions remain for 3.2 seconds from local arrival. A
bounded seen-ID set avoids duplicates and retained-feed replay on remount.
Timers are cleaned up on unmount. This visual lifetime is unrelated to
Celerity statement TTL, observation timeouts, or the server's message buffer.
Animation can be disabled in the palette and respects reduced motion; text
feedback remains. The preference lasts for the mounted room view, not across
reloads. No new storage is used.

## Responsive and failure boundaries

Mobile keeps a stable primary player above the tabs and a single composer
below a separately scrolling conversation. When the keyboard reduces the
visual viewport, the secondary reaction strip hides to preserve the composer
and primary transport. The existing compact header behavior remains.
Desktop places the same conversation beside playback and real presence.

Offline sends remain disabled. Drafts remain in memory across room tabs, not
after reload or leave. This is not durable messaging or end-to-end receipt
verification. Wallet-free guests, host-only protected keys, WebRTC audio,
payment/access policy and Product permission flows are untouched.

No new configuration, backend migration, hosting setting or secret is needed.
Reverting this UI change does not alter stored data or network protocol.

## Quiet controls and role-specific queue — 2026-10-11

The host chooses tracks through the catalog search in **Up next** and sees
listener suggestions with the existing add/remove/clear controls. Only guests
see **Request a track**. Suggestions remain intent, and adding a protected
track to the lineup still does not unlock it or start a payment. The host's
search now participates in the mobile keyboard layout just like the guest's
request composer, so it stays visible while typing.

Chat message actions sit behind one **…** button beside each message. It appears
on hover or keyboard focus on a mouse device and remains visible on touch
screens. The disclosure contains labeled Reply and, for the connected host,
Pin for 10 min actions. Escape closes it and returns focus; leaving the
message or pressing elsewhere closes it. It expands within the conversation
instead of opening a popup that could be clipped by its scrolling container.

A rightward touch swipe of at least 52 CSS pixels also selects a reply and
focuses the composer. Vertical, leftward, short or cancelled gestures do not
select a reply. The screen's leftmost 24 pixels are excluded to avoid competing
with browser navigation. Zoom and vertical scrolling remain available. The
gesture never sends a message and the visible action button is always the
alternative. Reduced motion disables the return animation.

**Room activity — On/Off** replaces the ambiguous bell. It filters arrivals,
departures, track/queue activity and confirmed tips locally; it does not enable
push notifications, sound, or hide chat messages. The filter lasts for the
mounted room view. Message drafts, acknowledgements, mentions, unread tracking
and server-enforced host pin permissions retain their existing ownership.

**Enable host tips** replaces **Receive room tips** with explanatory copy.
This explicitly binds the host's authenticated account to the room. In the
current implementation, preparing an in-room tip requires that binding and
the configured room attestor even when the artist assigns no host share.
The artist's contribution policy determines any host share; enabling the
button itself pays nobody, changes no allocation and grants no listening
access. The actual quote and confirmed receipt remain authoritative.

This is a frontend follow-up to #257 and #69. Ordinary-web browser tests prove
the role split, keyboard behavior, touch gestures and retained room delivery;
the installed Product mobile host still needs a physical gesture check after
deployment. The owner's successful web EVM artist-entry check is separate
evidence for the previously deployed 0.1.46 flow, not validation of this UI patch.

Local evidence: 33 Chromium scenarios in `room-life.spec.ts` and
`room-workspace.spec.ts`, plus 10 timeline/catalog/viewport unit tests. The
changed activity-label and guest-action checks were rerun after final copy
adjustments. Ordinary and frozen Product builds pass. Full ESLint has no errors
and retains the two existing `App.tsx` hook-dependency warnings; build warnings
about bundle size, Browserslist data and dependency annotations are unchanged.
Screenshots use explicitly synthetic E2E catalog and participant data:
[mobile](../images/quiet-room-controls/mobile.png) and
[desktop](../images/quiet-room-controls/desktop.png).

## Native Celerity continuation

The product direction is Product-native social delivery, not permanent
observation-only Celerity. The next transport slice can feed this same
presentation through `RoomRealtimePort`: reactions first, with duplicate and
expiry handling and a path for anonymous browser guests; then acknowledged
chat and recovery. That slice needs its own delivery evidence and activation
review. This UX PR neither proves those guarantees nor changes their flags.
