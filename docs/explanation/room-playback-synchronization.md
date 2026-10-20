# Room playback synchronization

The host owns the song position. WebRTC carries sound; Socket.IO carries the
position, duration, and playing state. Guests display that shared position and
may pause their own listening without changing the room.

## Why the receiver cannot own the clock

The regression had two clocks writing the same transport state: host samples
and the guest's `<audio>` events. In a reproduction, a host paused halfway
through a 60-second track while a late guest displayed 9.6% instead of 50%.
The guest's stream reception time had overwritten the host's song position.

A live MediaStream has an elapsed reception timeline and cannot be sought like
a song file. That behavior is defined in the
[Media Capture specification](https://www.w3.org/TR/mediacapture-streams/#mediastreams-in-media-elements).
The remote element's play, pause, metadata, and timeupdate events must therefore
never write the room transport. Both the full player and dock read one clock.

## State and sound

1. `useSession.emitPlayerState` samples the host media element. Play, pause,
   seeking, waiting, ended, and source preparation publish immediate updates;
   normal timeupdate events are throttled to approximately 900 ms.
2. The signaling server accepts only the room host. The join snapshot advances
   the stored sample by its server receipt age, bounded to 2.5 seconds. A changed
   track clears the old position before the host publishes its new snapshot.
3. `useRoomClock` interpolates at 250 ms intervals using local monotonic elapsed
   time. It does not compare wall clocks from different devices. Paused positions
   hold; playing samples become stale after 2.5 seconds without an update.
4. Pausing, seeking, or waiting disables captured host audio tracks without
   stopping them. Guests mute the element and disable received tracks when the
   host pauses, their own listening is paused, or the clock is stale. A fresh
   playing sample restores output unless the guest chose to remain paused.
5. The guest element continues consuming the live stream. Resume enables output
   at the live point; it never seeks, repeats buffered audio, or rebuilds a peer
   solely for a pause. Guest repeat and seek controls are disabled explicitly.

Disabled audio tracks produce silence under the
[media-flow specification](https://www.w3.org/TR/mediacapture-streams/#life-cycle-and-media-flow).
Muting both element and tracks covers normal playback and Web Audio consumers.
The host's existing capture backend, access checks, and source lifecycle remain
responsible for obtaining and distributing authorized audio.

## Host pause and source ownership

The Web Audio graph also gates the local speaker. A shared playback gain before
the speaker and room branches becomes zero on pause, seek, or loss of media
readiness; host mute still controls only the separate speaker gain. This stops
residual engine frames from sounding locally while the transport says paused.
Play resumes an existing AudioContext in the same gesture as the media element.

Next/Previous preserve an explicit pause. Choosing Play from the catalog starts
a new playback intent. Capture URL replacement and DAV2 recovery preserve that
intent rather than forcing autoplay. A replacement URL also takes over any
pending media-readiness wait.

Changing tracks immediately silences and releases the old Web Audio graph,
clears its media source, and resets the element. The keyed PersistentAudio ref
also retires a replaced node, including recovery-driven replacements. Delayed
capture requests can no longer match the retired DOM source. Media startup
events and Play completions must belong to the current element. Guests retain
their receiver while the existing sender replacement path attaches the new
stream; pause alone never rebuilds the connection.

`mobile-host-playback.spec.ts` measures local output RMS, including an injected
residual signal, and distinguishes the selected 440 Hz and 660 Hz tracks. It
also exercises a suspended AudioContext and delayed capture fetch in Chromium
and WebKit with an iPhone viewport. These are controlled browser tests, not a
recording from a physical Product host.

## Failure and compatibility

Periodic samples are volatile. Forced transitions use reliable emission while
connected, so backpressure cannot drop a paused seek with no later update.
New commands are not buffered while disconnected. Room creation and
host resume publish fresh state. No database, contract, permission, dependency,
or environment variable changes are needed. All additional clock state is in
memory. Guest access remains wallet-free and does not expose source keys.

Join snapshots add an optional server-derived `stale` marker to distinguish an
interrupted playing clock from an intentional pause. Both have `playing: false`
for safe output on older clients; updated clients show "Syncing with host" for
the stale case. Fresh host samples clear the marker. The server strips any
host-supplied marker before storage. Other event fields are unchanged. Update signaling and both frontend
surfaces for the full fix, then refresh both peers. Older listeners still have
the competing clock behavior; older servers cannot age the join snapshot.

The 2.5-second bound trades uninterrupted sound during a signaling outage for
an honest degraded state. Background timer throttling and long network stalls
can trigger it even while WebRTC media is healthy. This is a UI/control clock,
not sample-accurate synchronization between speakers: network transit and
WebRTC buffering still contribute audible latency. Physical iOS, Android,
Product WebViews, lock-screen behavior, and forced TURN need separate evidence.

## Regression coverage

- `roomClock.test.ts`: clock skew, pause/backward seek, stale/recovery, bounds.
- `signaling.test.mjs`: aged late-join snapshot, host-only publication, pause
  relay, and old-clock reset on track change.
- `room-sync.spec.ts`: late join at 50%, seek to 75%, held paused position,
  disabled guest seek, repeated host pauses, and persistent local guest pause.
  The Web Audio case sends a generated tone through real local WebRTC and
  measures receiver RMS becoming zero during pause and nonzero after resume,
  while retaining the same receiver stream. The tone exists only in the
  explicit E2E fixture.

Run from `web`: `npm run test:unit`, `npm run test:signal`, and
`npm run test:e2e -- --workers=1`. See the
[evidence record](../backlog/implementation/evidence/room-playback-sync.md).
