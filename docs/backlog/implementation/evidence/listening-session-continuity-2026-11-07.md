# Listening continuity and discovery — 7 November 2026 candidate

Refs #395 (audio lifecycle) and #388 (listening controls and discovery).
Implementation starts from tested `dev` `ec4c583f`. The branch subsequently merges `dev` `898a1cee`. This is a listening candidate,
not a deployment. Product 0.1.78 remains the latest owner-tested rollout.

## Product behavior

The owner reports silent playback with an advancing clock, chiefly on the phone
after closing the player. A closed player previously retained its source, and
selecting that same track could reuse the old element and position. A separate
local checkpoint offered cross-visit restoration. The new rule is explicit:

| Action | Result |
| --- | --- |
| Pause with the player still open, then select that track | Resume the existing session; its catalog cover shows a thin cyan progress strip while paused |
| Minimize the player | Keep listening and browsing; this does not end the session |
| Close the solo mini-player | Stop, cancel pending preparation and retire the output/source; later selection starts at zero through normal access checks |
| Reload the app | No listening checkpoint is restored; remove the old checkpoint key on mount |
| Request Room exit, including a host alone or a guest | Confirm first; Back, Escape, drag and Stay cancel |
| Host confirms Close room and keep listening | End the shared room, retain the local source, position and play/pause state |
| Host chooses Close room and stop | End the shared room and retire local playback |
| Guest confirms leaving, or Room ends externally | Stop and dismiss; never revive an earlier personal track automatically |

The four requested refinements belong to the same listening journey:

1. **Solo becomes shared listening.** The current cover anchors the layout change.
   Room controls and presence enter gently. A cancellable preparation note reports
   the real catalog startup state or honest phase text; it invents no percentage
   and no room link before acknowledgment.
2. **A quieter Room hierarchy.** Track, transport and people lead; host status,
   exit/account, contribution and reactions remain reachable with less visual
   weight. `Access needed to play` replaces the ambiguous standalone `Locked`.
3. **Discover the artist.** The release sheet leads with title, artist, the
   available track story and an artist-profile action. Listening/support terms
   remain expandable; provenance follows. No biography or social activity is
   fabricated. Guests inspect the current Room track without requesting a key.
4. **Predictable movement and return.** Setup, confirmation, queues and release
   details use the same listening-sheet presentation. Vertical motion expands or
   reduces listening surfaces; lateral motion enters or leaves artist discovery.
   Artist Back/Forward restores the underlying view and catalog context, and
   reduced-motion users get immediate transitions. Audio never waits for motion.

The suggested participant-arrival flourish remains a later idea. No fake arrivals,
notifications, new activity source or extra media-session artwork change is added.

## Ownership, alternatives and failure boundaries

`PlaybackProvider` owns the user intent: a still-open same-track session can reuse
its source; a dismissed, ended or failed session follows normal selection.
`useCatalog.clearPlayback` cancels pending/standby work, retires the host audio
output, and clears the resolved source. `PersistentAudio` therefore creates a new
source generation on a later selection. Keeping the old element and merely
seeking to zero would preserve the suspect output lifecycle, so it is deliberately
not the close behavior.

Room teardown already distinguishes peers from the host's shared local output.
The explicit keep-listening choice uses that distinction without reconnecting or
starting a second player. A paused host stays paused. Guest leave-and-open intent
is only armed after confirmation; cancelling the sheet cannot select a solo track.
Unexpected room termination still stops playback. Managed-to-compatible source
migration when opening a mobile Room retains its existing position handoff.

`NavigationProvider` owns artist history and return context. A release sheet
hands its transient history entry to the artist visit before the animation starts;
otherwise sheet cleanup could pop the deferred visit. Existing transition
invalidation prevents a delayed capture from overriding a newer route. Catalog
journey restoration retains its precise grid/search/focus ownership.
`useListeningCoverTransition` only animates the same cover across a room layout
change; unsupported or reduced-motion environments skip it.

Wallet/access invalidation remains authoritative. This does not grant a guest
transport control, make private audio public, bypass a key request, change source
retention policy or persist decrypted bytes. The old listening checkpoint is
removed; rolling the client back cannot reconstruct that deleted bookmark.
The follow-up below changes only plain-text chat normalization on the signaling server. There is no environment, storage-policy, quota or deployment change.

## Review path

1. `PlaybackProvider` → `useCatalog.clearPlayback` → existing host-output retirement:
   confirm paused preservation, cancellation and fresh source selection after close.
2. `ListenerShell` → `RoomCloseDialog`: ensure every Room exit confirms, guest
   cancellation cannot consume pending solo intent, and close/stop remains explicit.
3. `NavigationProvider` → `ListeningSheet` → `ReleaseDetailsDialog` → `PlayerView`:
   challenge history ownership, artist return, reduced motion and uninterrupted
   playback. `TrackArtworkButton` must expose progress only for the live paused track.

## Initial validation and remaining gate

Local Node 22 validation:

- 1,101 unit tests across 144 files pass; formatting and lint pass (two existing
  `App.tsx` hook-dependency warnings); Web and frozen Product builds pass.
- Core access/exit regressions pass: denial/disconnect, pause/close/reopen,
  host keep/stop and guest exit. The 23-case focused follow-up suite passes for
  keyboard behavior, artist Back/Forward, system controls, dock identity and
  room discovery with zero guest keys.
- The final 31-case motion/continuous-player/Room/adaptive-Room suite passes,
  including delayed room acknowledgment cancellation, reduced motion and source
  identity across artist visits. Four catalog search/grid/focus/scroll cases pass.
- Six Chromium/WebKit cases pass: managed-to-compatible position preservation,
  playing/paused host Room exit, real output energy and fresh audible reopening
  after retiring a suspended output. CI runs these in the existing streaming job
  with its real headless audio service.
- Narrow 320px paused-cover strip, 390px release sheet/Room/preparation and desktop
  captures inspected; keyboard/enlarged-text regressions pass. Backlog offline
  synchronization and whitespace checks pass.

The builds retain existing bundle-size/Browserslist/third-party annotation
warnings. None is new validation of the physical Host.

 The important
regression uses an existing generated MP3 through the real normalization graph:
measured output survives Room → solo, stays silent while paused, and returns after
closing a suspended output and explicitly reopening at zero. PCM data-URL WebKit
capture was not a reliable energy probe and is not claimed as production evidence.

Browser energy and source-identity checks do not reproduce the exact physical
Polkadot iPhone audio stack. After a matching reviewed rollout, test the existing
short protected release and **Adang Fobe** on Web, Desktop and phone: pause/resume
with dock open, close/reopen at zero, host exit with both choices, guest cancellation,
artist return, and phone lock/unlock. Hear the audio at host and guests; an advancing
clock alone is insufficient. No new purchase or publication is needed.


## Two video references, one listening journey

The owner supplied a Radio France player recording (01:11) and a Dotify recording
(01:29) on November 7. Radio France is a reference for stable transport and
editorial exploration, not a request to reproduce its brand. The Dotify recording
makes the same problem concrete: Room preparation repeats the track choice; long
descriptions dominate; the keyboard hides conversation; Send changes focus; Enter
cannot create a paragraph.

- **Stable listening anchor:** solo Queue, Room Up next/suggestions and release
  details share a common-height sheet, independently scrolling content, and the
  current cover/title/artist, Play/Pause and progress at the same bottom position.
  The inspected release stays bound to its original metadata if the song changes;
  the footer follows actual listening. Guests retain local pause/resume only.
  Catalog inspection without an active source does not invent a player.
- **Editorial hierarchy:** the solo story is a three-line invitation to “Behind
  this track”; the complete artist-provided text remains in the detail sheet.
  Artist discovery, Room presence hierarchy and cover-to-mini-player motion remain
  part of the earlier work, with a reduced-motion alternative.
- **Room creation:** opening from the player shows the current track first and
  folds alternatives behind “Choose another track”. Opening from discovery keeps
  the selector visible. Room name is directly visible; the optional invitation
  expands when wanted. Naming remains optional, preserving link-first entry
  without a new validation barrier or server policy.
- **Conversation while typing:** the keyboard layout keeps a compact cover/title,
  44px Play/Pause, timeline, tabs and Done. Secondary transport returns after
  keyboard dismissal. Conversation keeps a readable area, including a 310px
  visual viewport. The textarea grows within a bounded height, then scrolls.
  Send retains editor focus; Enter creates a line break, Ctrl/Cmd+Enter sends,
  and IME composition cannot submit accidentally. Unread/history ownership stays
  in RoomChat; no fake activity is added.

`ListeningSheet` receives a presentation slot rather than importing playback
providers. `ListeningNowPlaying` reads existing catalog/session/transport and
creates no source or key request. Progress uses accessible native `<progress>`.
`Dialog` retains focus/history; scrolling content cannot dismiss the sheet, and
only its explicit handle owns drag-to-close.

Signaling preserves chat newlines as plain text, normalizes CRLF, removes controls,
caps consecutive newlines at two and retains the 280-character limit, rate limit,
membership check and ephemeral history. Track requests remain single-line. React
renders text with `white-space: pre-wrap`, never HTML. An older server flattens
line breaks; matching signaling rollout is required for end-to-end paragraphs.
No server is deployed here. Rollback requires no migration.

## Follow-up validation

The first CI exposed stale expectations around exit confirmation/progressive
disclosure and measurements during entry animation. Checks now follow the actual
UI and wait for finite entry motion before measuring. The WebKit Room-to-solo
check waits for capture readiness before recording source identity: initial local
sound can precede the URL-to-Blob preparation handoff. Same-source, pause-state
and audible-energy assertions remain.

Follow-up Node 22 validation:

- 64 browser cases pass across motion/discovery, mobile layout, Room workspace
  and form keyboards. Six keyboard cases pass again after the final bottom-margin
  adjustment, including a two-client paragraph exchange at 310px visual height.
- All six Chromium/WebKit cases used by the audio-enabled CI gate pass: managed
  source handoff and playing/paused Room-to-solo continuity with fresh audible
  reopening. The wider local 14-case probe also exposes an existing WebKit PCM
  fixture energy failure, reproduced unchanged at `28e01f4f`; it is not claimed
  as a passing cross-browser fixture. A second WebKit room-opening case timed out
  in that wider run, then passed twice in isolation; unchanged baseline also passes.
  The supported MP3 energy checks remain green.
- 1,101 unit tests and 68 signaling cases pass. Web and frozen Product builds,
  formatting, lint and backlog checks pass; two existing App.tsx hook warnings
  and existing bundle/Browserslist/third-party annotation warnings remain.
- Final queue/discovery anchor and smallest keyboard captures inspected. CI now
  retains Room audio diagnostics as well as streaming diagnostics on failure.

The new commit's remote CI remains a separate gate until it completes.
Physical acceptance still needs matching reviewed Web/Product/signaling rollout:
control audio in each sheet, receive/send paragraphs with the real iPhone keyboard,
retain older history when scrolled up, return from artist discovery, and hear
host/guest audio through each exit choice.


## CI correction: catalog position and Room setup

Run `42322972437` passed 327/329 core cases and the three-engine audio gate.
The two failures were catalog scroll restoration and the two-client suggestion
scenario's overall 30-second deadline.

`CatalogBrowser` now remembers the activated card's viewport position along with
its identity. A live Room shelf can change the document above that card while an
artist profile is open; returning to an absolute `scrollY` is not sufficient.
Restoration uses the card's current position and clamps naturally at document
edges. `NavigationProvider` owns manual history scroll restoration while mounted,
restoring the prior browser setting on cleanup: otherwise native Back can overwrite
the restored position after `popstate`. The controlled test reproduced a 240px
error with native restoration still enabled, including reduced motion. This remains in-memory presentation state; it does not persist listening
history or affect audio/access.

The catalog regression introduces a controlled 240px shelf-height change and
checks the focused card's restored viewport position within 3px, replacing the
previous loose 120px absolute-scroll allowance. Both viewport sizes and motion
preferences remain covered. Room setup waits for layout motion but excludes the
4.8-second decorative online pulse. Only the two-client suggestion scenario gets
60 seconds for total setup and interaction; assertion deadlines stay unchanged,
and it still verifies that curation neither starts nor pays for the track.

The controlled catalog regression passes twice in all four combinations (8/8).
TypeScript, targeted ESLint, formatting and offline backlog validation pass.
The related navigation/Room/exit suites and new remote CI run remain verification
gates; final run evidence belongs to the PR checks, not the earlier failed run.
