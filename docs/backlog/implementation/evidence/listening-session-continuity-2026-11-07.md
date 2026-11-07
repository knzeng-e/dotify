# Listening continuity and discovery — 7 November 2026 candidate

Refs #395 (audio lifecycle) and #388 (listening controls and discovery).
Implementation starts from tested `dev` `ec4c583f`. This is a client candidate,
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
There is no server, environment, storage-policy, quota or deployment change.

## Review path

1. `PlaybackProvider` → `useCatalog.clearPlayback` → existing host-output retirement:
   confirm paused preservation, cancellation and fresh source selection after close.
2. `ListenerShell` → `RoomCloseDialog`: ensure every Room exit confirms, guest
   cancellation cannot consume pending solo intent, and close/stop remains explicit.
3. `NavigationProvider` → `ListeningSheet` → `ReleaseDetailsDialog` → `PlayerView`:
   challenge history ownership, artist return, reduced motion and uninterrupted
   playback. `TrackArtworkButton` must expose progress only for the live paused track.

## Validation and remaining gate

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
