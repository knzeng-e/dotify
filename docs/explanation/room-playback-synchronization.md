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

## Failure and compatibility

Samples are transient and not buffered while disconnected. Room creation and
host resume publish fresh state. No database, contract, permission, dependency,
or environment variable changes are needed. All additional clock state is in
memory. Guest access remains wallet-free and does not expose source keys.

The event payload shape is unchanged. Update signaling and both frontend
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
