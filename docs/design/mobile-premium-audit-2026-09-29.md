# Dotify mobile premium audit

Date: 2026-09-29
Source: owner request after the W21-W25 premium UX pass, with current screenshots
and merged evidence reviewed from `dev`.

## Purpose

This audit prepares a new implementation slice for Dotify's mobile experience.
It does not replace W13 pilot gates, W24 visual-system rules, or W27 Celerity
direction. It turns the latest design review into a launchable implementation
brief for VS Code and future agents.

Dotify should feel simple enough to use with one thumb and deep enough to make
shared listening feel alive. The mobile app should not explain infrastructure on
the first screen. It should make three states obvious:

- I am listening alone.
- I am listening live in a room.
- I can support the artist when I choose to go deeper.

## Benchmarks

The review uses these product and design lessons without copying any single app:

- Apple Music / Spotify: the full player is immersive, transport controls are
  predictable, and secondary actions stay outside the main thumb path.
- Spotify Jam / Stationhead: room listening works when the live context is
  visible everywhere, not buried inside a separate chat page.
- Material Design 3 and Apple HIG: bottom navigation, sheets, clear target
  sizes, reduced motion and reachable controls matter more than decoration.
- Baymard mobile UX research: horizontal discovery rails should feel native on
  touch screens; visible arrow controls are desktop affordances and become noise
  on mobile.
- WCAG 2.2: touch targets, contrast, motion reduction and 200% text remain
  acceptance requirements, not optional polish.

## Current strengths

- Dotify now has a recognizable Night Console identity with deep blue, cyan and
  restrained Polkadot pink.
- Room playback continuity has improved: the mini-player survives navigation
  and can point back to the room.
- Track cards are cleaner after removing always-visible access/payment details.
- Artist and support language is less technical than earlier iterations.
- The room chat composer is much closer to a usable mobile pattern than the
  first keyboard-overlap reports.

## Remaining product friction

1. The first mobile viewport still competes for attention between navigation,
   hero text, room entry, player dock and track discovery. Music should appear
   faster.
2. The mini-player needs a strict live/direct distinction. A listener returning
   from a room must see the room track, live badge, people count and room return
   action rather than a stale catalog track.
3. Discovery rails should behave like native horizontal shelves on touch
   screens: drag to browse, tap to play, long press or secondary sheet for
   access details. Desktop hover can show a centered translucent play CTA.
4. The full mobile player still feels like a web page around a player. It should
   become the player: artwork, title, artist, live/direct context, seek, primary
   transport, and sheets for queue/support/details.
5. The room screen should keep the room player, chat tabs and composer visible
   as a single listening surface. Queue, requests and people need to feel like
   nearby panels, not unrelated screens.
6. Artist/support flows should stay reachable without stealing the listening
   moment. Payment, support and rights details belong in explicit sheets.

## Direction

### Mobile shell

Use a bottom navigation and adaptive mini-player as the stable mobile shell.
The dock should be compact, keyboard-aware, safe-area aware and resilient at
320, 390 and 430 CSS px widths.

The mini-player has two variants:

- Direct listening: artwork, title, artist, play/pause, open full player.
- Live room listening: artwork, title, room name, live pulse, people count, room
  return action, play/pause only when the current user controls playback.

The live variant must use the actual room playback state, not the last selected
catalog track.

### Music home

Reduce the first-screen hero footprint and move quickly into music. Use native
horizontal track rails with snap scrolling. Track cards show cover, title and
artist by default. Access, price, proof, rights and support details open in a
sheet from an info/control affordance.

Hover controls on desktop should be a centered play CTA on the hovered card.
Mobile should not show persistent arrow controls.

### Full player

On mobile, the full player should hide the global page chrome and prioritize:

1. cover art;
2. live/direct context;
3. title and artist;
4. seek bar and time;
5. previous, play/pause, next;
6. support, queue, repeat/shuffle and details as secondary actions.

The previous action should benefit from the same prefetch/readiness work as next
where the playback model supports it.

### Room

The room should read as one live listening surface:

- compact live header with room name, host, people and share;
- persistent room player;
- segmented Chat / Queue / People panels;
- requests inside Queue;
- composer pinned to the thumb zone and keyboard-safe;
- lightweight reactions tied to the listening moment;
- explicit reconnect/degraded state that does not blame the user.

### Artist and support

Support should be presented as a human act first:

- support amount and recipient summary;
- where support goes;
- receipt/proof after confirmation;
- technical details folded behind explicit disclosure.

The artist workspace can remain desktop-oriented, but mobile should use an
overview-first layout with releases, earnings and rights reachable as compact
tabs or sheets.

## Acceptance

- On 390 x 844, a user can browse tracks, open the player, join a room, return
  to Music, and still understand exactly what is playing and whether it comes
  from a room.
- The mini-player never displays a stale direct-track identity while room audio
  is playing.
- Track rails use native horizontal motion on touch screens and no persistent
  arrow controls on mobile.
- The full mobile player exposes previous, play/pause, next and seek without
  layout overlap.
- The room screen keeps player, tab context and composer reachable without long
  vertical hunting.
- Existing room guest, host access, payment and Product fallback invariants are
  preserved.
- Screenshots are captured at 320, 390, 430, 768 and 1440 CSS px, plus keyboard
  focus, 200% text and reduced motion checks.
