# Dotify Shared Score

Status: selected UI/UX direction and implementation specification, amended by
the Living Light addendum (2026-07-12): the Shared Score structure, journeys,
and honesty rules stay authoritative, while the presentation layer moved from
the flat light console to an immersive dark canvas lit by the active track's
aura (see section 6 and `web/src/styles/aura.css`).
Last reviewed: 2026-07-12.

## 1. Purpose

Shared Score is a new interface direction for Dotify. It does not inherit the
composition, card system, decorative canvas, aura, constellation, or page
hierarchy of the current UI. It keeps only the product's real capabilities,
security boundaries, and human-centered promise.

The intended audience is product, design, and frontend engineering. The goal is
to make Dotify feel like a mature listening product first, while artist-owned
runtimes, encrypted delivery, and Polkadot remain legible guarantees beneath
the experience.

The outcome should be immediately understandable:

> One track, one shared timeline, and the people hearing it together.

## 2. Three concepts

### A. Shared Score — selected

**Idea.** A listening moment is represented as a score shared by a track, a host,
and the people present. Time is the organizing axis. The track is the lead line;
presence, access, conversation, and support are quieter supporting lines.

**UI expression.** Precise editorial typography, restrained rules, aligned
metadata, real playback position, and album artwork as the main source of
expression. Score lines organize content; they never pretend to be musical
notation or data that Dotify does not have.

**Strengths.** Works for solo and room listening, makes live state easy to scan,
keeps the artist visible, and maps to real track, player, room, presence, chat,
access, and royalty data.

**Risk.** It can become an audio workstation. Avoid dense controls, fake
waveforms, and technical labels. Each screen gets one dominant action and only
the controls needed for its current role.

### B. Listening Desk

**Idea.** Dotify behaves like a refined cultural publication: selected works,
liner notes, artist context, and listening rooms presented as live editions.

**Strengths.** Calm, premium, excellent for catalog and artist storytelling.

**Risk.** Rooms feel like editorial add-ons rather than the social core, and the
moment-to-moment playback state has no strong visual grammar.

### C. Live Assembly

**Idea.** Dotify is organized around the people assembled around a work. Rooms,
presence, reactions, and requests lead; catalog and solo listening support them.

**Strengths.** Strong social energy and clear differentiation from an ordinary
streaming catalog.

**Risk.** It can resemble a broadcast dashboard, overstate community scale, and
make a quiet solo or artist workflow feel secondary.

### Decision

| Criterion                     | Shared Score | Listening Desk | Live Assembly |
| ----------------------------- | ------------ | -------------- | ------------- |
| Link to first sound           | Strong       | Medium         | Strong        |
| Solo and room continuity      | Strong       | Medium         | Medium        |
| Artist sovereignty            | Strong       | Strong         | Medium        |
| Uses only real data           | Strong       | Strong         | Medium        |
| Professional visual clarity   | Strong       | Strong         | Medium        |
| Accessibility and performance | Strong       | Strong         | Medium        |

Shared Score is selected because it gives every existing surface one coherent
grammar without inventing social graphs, provenance, waveforms, or activity.

## 3. Product invariants

1. A room guest can enter and hear the host stream without a wallet, signature,
   payment, or content-key request.
2. A guest receives WebRTC media only, never a content key or protected source
   reference.
3. Individual protected playback fails closed and states the exact next action.
4. A Free track opens immediately after the backend verifies the live policy.
5. Paid access has no degraded preview. The listener either has access or hears
   no protected audio.
6. Presence, progress, reactions, support, and royalty data are shown only when
   they come from real application state.
7. Album art identifies a track. Decorative color must not encode policy or
   status unless a text label and accessible state communicate the same fact.
8. Chain, key, storage, and transaction details use progressive disclosure.
9. Dotify describes distribution protection honestly and never claims DRM.
10. Artist publication remains fail-closed wherever the configured registry
    path is not covered by a checked-in owner-guard attestation.

## 4. Information architecture

### Primary surfaces

| Surface    | User question                | Primary content                                        | Primary action              |
| ---------- | ---------------------------- | ------------------------------------------------------ | --------------------------- |
| **Music**  | What can I hear now?         | Live rooms, featured track, finite catalog             | Enter room or play track    |
| **Room**   | Who am I hearing this with?  | Current track, shared time, host, real presence        | Start audio or share room   |
| **Player** | What am I listening to?      | Track, transport, access state, artist                 | Play, support, or open room |
| **You**    | What belongs to this wallet? | Connection, opened tracks, backed artists, studio entry | Connect/manage wallet       |
| **Studio** | How do I manage my work?     | Runtime, releases, royalties, proofs                   | Review or publish when safe |

Desktop uses a calm horizontal header for `Music`, `Rooms`, and `You`. Mobile
uses the same three destinations in a bottom bar. `Player` is contextual: it
opens from a track, a room, or the persistent player dock instead of competing
as a permanent destination. `Studio` stays a distinct artist workspace at
`/artists`. A canonical `#/rooms/<roomId>` link bypasses general discovery and
opens the room entry state directly.

### Information order

Every surface follows the same hierarchy:

1. **Music:** artwork, title, artist, and real playback state.
2. **People:** host and actual presence when a room exists.
3. **Action:** one visually dominant next step.
4. **Terms:** Free, paid, or Human free access in literal language.
5. **Proof:** wallet, runtime, transaction, CID, and explorer details on demand.

## 5. Core journeys

### 5.1 Shared link to first sound

1. Parse the room link and connect to signaling in parallel.
2. Show room resolution, unavailable, or ready state without a blank screen.
3. In the ready state, show the real host, track, presence count, and room code.
4. Ask for a local display name only if none is remembered.
5. `Enter and listen` supplies the browser interaction needed for audio.
6. Join the room and negotiate WebRTC without wallet, upload, key, or chain
   activity for the guest.
7. If autoplay is blocked, show one explicit `Start audio` action.

Primary measure: link open to first audible remote frame.

### 5.2 Track to solo listening

1. Opening a track moves to Player and keeps the persistent dock available.
2. Free playback starts after the server policy check.
3. A protected track shows `Listening closed`, the exact terms, and one action.
4. Successful access changes the state to `Ready to listen`; it does not trigger
   a decorative celebration that hides transport feedback.

### 5.3 Solo listening to room

1. `Open a room` uses the current playable track by default.
2. The host chooses a room name and confirms the track.
3. Dotify creates the room, then exposes its copyable link, code, and QR.
4. The host remains the only participant whose access controls the stream.
5. If host access is denied, the room remains open with no protected stream and
   a host-only corrective action.

### 5.4 Paid support

1. `Support and open` reveals the amount, right received, artist, collaborators,
   split, and where the network fee will be shown before requesting a wallet
   action.
2. The listener confirms or leaves without losing room or player context.
3. Transaction states are literal: `Confirmation requested`, `Submitted`,
   `Confirmed`, or a specific recoverable failure.
4. After confirmation, the backend re-checks access before returning a key.

### 5.5 Artist workspace

1. Connect a real wallet and resolve the existing runtime.
2. Show real release, supporter, and royalty information.
3. A new release follows Assets, Details, Access, and Review.
4. The Access step includes the artist wallet share plus additional
   rights-holder rows for collaborator/producer/label EVM addresses. The UI uses
   percentages, while runtime publication keeps basis points internally.
5. Upload and content identity are verified server-side in production mode.
6. If the registry guard is not attested, creation and publication controls are
   disabled with the remediation reason; existing releases and royalty records
   remain readable.

## 6. Visual and interaction system

### Foundation (Living Light amendment, 2026-07-12)

- **Canvas:** deep navy `#050D1A` over `#03080F`; raised surfaces `#0C1A30`
  and `#12233D`.
- **Ink:** near-white `#F2F8FF`; secondary text `#B9C8DC`; subtle rules are
  translucent light (`rgb(148 178 215 / 0.16)`).
- **Core:** deep blue `#0A203B` remains the bounded listening-stage surface.
- **Action:** electric cyan `#00E5A0`; hover `#33F0B8`; deep-navy label text.
- **Polkadot accent:** `#FF4FA3` (brightened for dark contrast), limited to
  artist provenance and a small number of high-value markers, never the
  default CTA.
- **Semantic:** success `#3FE0AB`, warning `#F0B429`, danger `#FF7D72`.
- **Aura:** the `--aura-*` variables are rewritten per track by the aura
  engine (`web/src/shared/utils/aura.ts`); a resting deep-blue light shows
  when nothing plays. The whole field, the player stage, the featured moment,
  and the dock ride this light.

The default is an immersive listening room: a dark canvas, glass chrome, and
a track-driven ambient aura. The honesty rule is unchanged - every glow maps
to real state (the selected or playing track, a live room, a genuine unlock).
Avoid fabricated playback motion, fake waveforms, and decoration that maps to
nothing.

### Shared-score grammar

- A 4 px base grid and an 8 px spacing rhythm keep metadata aligned.
- One-pixel horizontal rules group track, time, presence, and terms into lanes.
- A playhead appears only when real `playerState` or local transport time exists.
- A waveform appears only if real waveform data is implemented later.
- Live state uses a labelled dot plus `Live`; motion is not the sole signal.
- The score metaphor stops at layout. Controls retain familiar player labels.

### Typography

- Use Instrument Sans for interface language and Newsreader for a restrained
  editorial hierarchy. Both load with `font-display: swap` and robust system
  fallbacks; self-hosting is the production target.
- The editorial face is limited to page, track, artist, and section titles. It
  never appears in controls, form labels, status messages, or technical proof.
- Page title: fluid 52–106 px desktop and 46–80 px mobile, with short line
  lengths; body remains 16/25 and metadata 12–14/18.
- Addresses, hashes, room codes, durations, and DOT amounts use tabular figures;
  long proofs use the system monospace stack.
- Sentence case everywhere. Avoid all-caps except short state labels such as
  `LIVE`, with an accessible text equivalent.

### Layout

- Desktop: 12-column grid, 24 px gutters, content width up to 1280 px.
- Reading and forms: 720 px maximum line width.
- Header: horizontal, sticky, and limited to the three intentional destinations.
- Mobile: one column, 16 px gutters, three-item bottom navigation and player
  dock with safe-area padding.
- Breakpoints respond to available space, not device names: 720 px and 1100 px.
- Radius: 8 px controls, 12 px panels, circular avatars only. Shadows are used
  only for overlays and the persistent dock.

### Components

- **Track row:** artwork, title, artist, access label, duration, one action.
- **Room row:** track, host, real presence, sound state, progress when known.
- **Status chip:** icon, literal text, and semantic tone; never color alone.
- **Player dock:** current track, play/pause, real progress, volume, open-player.
- **Featured track presence:** latest-track carousel, combined real-time
  listening total across solo and room playback, rooms currently playing that
  track, and direct solo / host / live-room actions.
- **Room sky:** real room spheres in a pan-and-zoom camera with room-by-room
  recentering; the complete card list remains the mobile/reduced-motion path.
- **Access sheet:** terms and next action; never blocks a room guest.
- **Presence list:** host first, then connected and connecting listeners.
- **Social lane:** real chat, attributed reactions, and track requests.
- **Proof drawer:** runtime, transaction, IPFS, and explorer information.
- **System state:** skeleton for loading, plain empty state, actionable error, and
  retry only when retry is valid.

## 7. Wireframes

The wireframes describe hierarchy, not final styling. Bracketed labels are
controls; parenthesized labels are status.

### Music

```text
┌──────────┬──────────────────────────────────────────────────────┐
│ DOTIFY   │ MUSIC                                [Wallet status] │
│          ├──────────────────────────────────────────────────────┤
│ Music ●  │ Live now                               3 rooms       │
│ Rooms    │ ┌────┬───────────────────────────┬──────────┬──────┐ │
│ Rooms    │ │art │ Marée basse · Aicha      │ 5 here   │Enter │ │
│ You      │ │    │ hosted by Nia · 01:24    │ (Live)   │      │ │
│          │ └────┴───────────────────────────┴──────────┴──────┘ │
│          │ ───────────────────── real progress ───────●──────  │
│          │                                                      │
│          │ Tracks                                               │
│          │ ┌────┐ Title / artist / Free             [Play]     │
│          │ └────┘ short description                            │
│          │ ┌────┐ Title / artist / 1.2 DOT          [Open]     │
│          │ └────┘ short description                            │
│          ├──────────────────────────────────────────────────────┤
│          │ art  Title — Artist       [◀] [Play] [▶]  01:24/03:42│
└──────────┴──────────────────────────────────────────────────────┘
```

### Room

```text
┌─────────────────────────────────────────────────────────────────┐
│ (Live) ROOM Q7KM · hosted by Nia     [Copy link] [QR] [Leave] │
├────────────────────────────────────────────┬────────────────────┤
│                                            │ PEOPLE · 5         │
│              ┌──────────────┐              │ ● Nia · host       │
│              │  cover art   │              │ ● Aicha            │
│              └──────────────┘              │ ◌ Jules connecting │
│ Marée basse                                ├────────────────────┤
│ Aicha · following the host                 │ ROOM NOTES         │
│ ───────────────●──────────────── 01:24      │ real chat          │
│ [Start audio] only when browser requires   │ reactions requests │
│                                            │ [Send]              │
├────────────────────────────────────────────┴────────────────────┤
│ Guests hear the host stream.                                  │
└─────────────────────────────────────────────────────────────────┘
```

Host transport replaces `following the host` with familiar play, seek, and
queue controls. Guest transport never suggests that the guest controls the
host. On mobile, People and Room notes become two tabs below the track.

### Player

```text
┌─────────────────────────────────────────────────────────────────┐
│ Dotify              Music  Rooms  You               Confirmation │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  Marée basse                                   │
│ │              │  Aicha                                         │
│ │  cover art   │  (Listening closed) · 1.2 DOT                 │
│ │              │  [Support and open]                            │
│ └──────────────┘                                                 │
│                                                                  │
│ [◀] [Play] [▶]  ─────────●────────  01:24 / 03:42              │
│ Description · terms · collaborators                     [More]  │
│ Open this listening moment to others               [Open room]  │
└─────────────────────────────────────────────────────────────────┘
```

### You

```text
┌─────────────────────────────────────────────────────────────────┐
│ YOUR MUSIC, ON YOUR TERMS                                       │
├────────────────────────────────────────┬────────────────────────┤
│ Your music                             │ Artist space           │
│ 3 tracks opened · 2 artists supported  │ Aicha · 2 releases     │
│                                        │ [Open Studio]          │
│ Tracks opened      Artists supported   ├────────────────────────┤
│ Title · artist     Artist · 2 tracks   │ Confirmation method    │
│ Title · artist     Artist · 1 track    │ ready only when useful │
│                                        │ [Manage]               │
└────────────────────────────────────────┴────────────────────────┘
```

Disconnected state explains that rooms remain usable without an account and
offers one `Connect wallet` action. It does not show fabricated zero-value
analytics as activity.

### Studio

```text
┌─────────────────────────────────────────────────────────────────┐
│ AICHA STUDIO                          publication open          │
│ Runtime verified on the active factory/directory.               │
├─────────────────────────────────────────────────────────────────┤
│ Overview | New release | Releases | Royalties | Advanced        │
├───────────────────────────────────────┬─────────────────────────┤
│ 2 releases · 6 supporters · 4.8 DOT  │ Runtime status          │
│                                       │ owner / network / proof │
│ Your releases                         │ [Open explorer]         │
│ ┌────┐ Marée basse · Paid    [Open]  │                         │
│ └────┘                                │ Publishing              │
│ Latest support                        │ Runtime ready           │
│ listener · track · amount · tx        │ [Publish release]       │
└───────────────────────────────────────┴─────────────────────────┘
```

`New release` uses a linear stepper: Assets, Details, Access, Review. The Access
step includes the listening door, price, primary artist share, and additional
rights-holder split rows. The quarantine banner and disabled state take
precedence over the form whenever a deployment is not attested.

## 8. Accessibility

- Target WCAG 2.2 AA: 4.5:1 body contrast, 3:1 large text and component
  boundaries, and 44 by 44 px minimum touch targets.
- Use semantic landmarks, headings, lists, tables, buttons, links, labels,
  fieldsets, progress elements, and dialogs before ARIA.
- Keep a visible focus indicator with at least 3:1 contrast and predictable
  focus order. A skip link reaches the main content.
- Dialogs trap focus, close on Escape and backdrop, restore focus, and isolate
  background content from assistive technology.
- Player controls have explicit names, pressed states, disabled explanations,
  and a labelled seek range. Time and access states are available as text.
- Announce room connection, transaction, and playback failures in a polite live
  region. Chat has its own bounded live region and never steals focus.
- Do not announce every progress tick or decorative reaction.
- All responsive layouts work at 200% zoom, 320 CSS px width, text-only zoom,
  keyboard-only input, and forced-colors mode.
- The room sky supports pointer drag, wheel zoom, explicit controls, arrow-key
  pan, `+`/`-` zoom, and `0`/`Home` reset; no room is discoverable only through
  the spatial view.

## 9. Motion and sound

- Motion explains entry, state change, or spatial continuity; it is never
  ambient decoration.
- Use opacity and transform only: 120 ms control feedback, 180 ms panels, 240 ms
  route continuity. No motion should block input.
- Real playback progress may move continuously. The ambient aura may drift
  slowly because it is driven by the real active track; a fake waveform or
  fake equalizer may not move at all.
- Reactions animate only from real room events and remain attributed.
- Under `prefers-reduced-motion: reduce`, remove travel and scaling; retain
  immediate state changes and static reaction entries.
- Never autoplay interface sounds. Music playback follows browser policy and
  exposes `Start audio` when user activation is required.

## 10. Performance

- No WebGL, canvas element, or 3D dependency in the core experience. The
  ambient aura and constellation surfaces are CSS gradients and transforms
  only, and reduced motion disables the drift.
- Load the two display-swap font families without blocking first paint; self-host
  and subset the adopted production faces before a public performance sign-off.
- Reserve image dimensions to keep CLS below 0.1; serve responsive artwork and
  lazy-load below-the-fold covers.
- Load room metadata and signaling in parallel on a shared link. Do not wait for
  wallet, catalog, or chain initialization before showing the room.
- Keep transport and the persistent audio element mounted across navigation.
- Defer Proof drawers, explorer helpers, Studio-only code, and nonessential
  social history until opened.
- Target p75 LCP below 2.5 s and INP below 200 ms on a mid-tier mobile device.
  Track room-link-to-metadata and link-to-first-audio separately.
- Preserve a useful loading, empty, offline, and retry state when signaling,
  RPC, IPFS, or the key service is slow.

## 11. Capability mapping and current limits

| Shared Score promise  | Current capability                                             | Product constraint                                                                                      |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Finite catalog on Music | Runtime catalog plus seed tracks                             | Do not imply an indexed, infinite, or personalized feed                                                 |
| Live room rows        | Socket.IO open-room state, track, player state, host, count    | Show only returned data; public payload contains no host wallet or protected ref                        |
| One-link room entry   | Canonical hash link, room resolution, local display name       | Guest entry is direct and room-unavailable is a first-class state                                       |
| Shared room audio     | Host `captureStream` to WebRTC peers                           | Single host; no handoff or SFU; host departure ends the room                                            |
| Room conversation     | Attributed chat, reactions, and track requests                 | No fabricated activity, persistent community, or moderation claim                                       |
| Free playback         | Backend verifies current Free policy before key delivery       | Service availability and on-chain policy remain authoritative                                           |
| Paid playback         | Classic payment, access re-check, royalty distribution         | No preview fallback; display exact transaction failure                                                  |
| Human free            | Contract-level personhood mode and UI states                   | Live Individuality/Proof of Personhood is not integrated; label beta/upcoming                           |
| Protected delivery    | Server upload, encryption, signed session/key request          | Browser secrets are demo-only; do not claim DRM                                                         |
| DAV2 streaming        | First Range/MSE vertical slice and fallback metrics            | Real-browser, container, gateway, and device matrix remains release work                                |
| You                   | Connected wallet, opened tracks, backed artists, artist runtime | No platform profile, cloud account, or cross-device history is implied                                  |
| Studio reads/writes   | Runtime, releases, royalties, transaction and archive proofs, multi-recipient split publication | New runtime creation and release publication fail closed when the configured deployment is not attested |
| Artist sovereignty    | Artist-owned SmartRuntime model and owner-only source fix      | The active fresh deployment is attested; legacy runtimes remain remediation history                     |

The following remain out of scope and must not appear as active UI: Product
SDK/TrUAPI host integration, live Proof of Personhood, SFU, host handoff,
durable reconnect, Statement Store signaling, catalog indexer, community or
time-bound policies, provenance trails, ambassador rewards, awards, and memory
objects.

## 12. Delivery rules

1. Implement the design as tokens and small components; do not grow business
   logic inside presentational views.
2. Preserve room, wallet, playback, upload, and contract behavior while making
   Player contextual and reducing primary navigation to Music, Rooms, and You.
3. Preserve load-bearing test selectors or migrate tests in the same change.
4. Ship in this order: shell and primitives, Music, Player, Room, You, then Studio.
5. Validate desktop and mobile, keyboard, screen reader, reduced motion,
   forced-colors, browser console, two-device WebRTC, and DAV2 media cases.
6. Publication remains fail-closed unless the configured deployment is covered
   by the checked-in deployment safety attestation.

Shared Score succeeds when Dotify feels calm and obvious before it feels
technical: the track leads, people share one real moment, and the infrastructure
quietly proves the terms.
