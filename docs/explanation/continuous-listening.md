# Continuous listening

W35 (#290) builds on the current authenticated AAC format (W32) and short-lived
access preparation (W34). It does not replace WebRTC or give room guests a
content key. Code readiness and a published, physically verified experience
remain separate gates.

## One active source, one silent successor

While solo audio is advancing with enough buffered headroom, the last 15 seconds
can prepare one successor. Queue order wins over catalog order. Pause, seek,
stall, backgrounding, data saving, an offline connection, a changed selection,
repeat mode, room entry or dismissal cancels speculation. The current source is
not canceled by those speculative failures.

`useNextTrackPreparation` reuses the existing prefetch eligibility/headroom
rules. `useCatalog.prepareNextPlayback` obtains a Free authorization or uses an
existing W34 session grant. Protected speculation never opens a wallet or
creates a new identity session. It authenticates the manifest and media under
the full release scope before loading a detached, paused native audio element.
Only the first two segments are prepared while that element is detached.

Policy coverage is independent of encryption. A non-encrypted artist-runtime
source is not speculatively loaded and cannot use a ready player or key-cache
entry to skip its ordinary runtime access check on selection. A denied or
unavailable check leaves it stopped. Non-policy-managed local/demo sources keep
their existing preparation path. This client guard cannot make an already
public, unencrypted URL confidential; protected distribution still requires
the authenticated encrypted format.

`StandbyAudio` holds one candidate for at most a 30-second adoption window. A
protected handoff additionally needs a currently valid W34 grant. The candidate
must match the current account/network, purpose and release identity (including
source/encryption classification, artist and local URL), be ready,
and have no native error. A miss, expired grant or denial takes the ordinary
authoritative selection path. No key, source URL or decrypted media is persisted.
Already delivered material cannot be cryptographically recalled.

At the natural boundary, ownership of that exact element transfers to the new
selection before retiring its predecessor. The native pause/timeupdate events
that precede `ended` must not cancel the successor. `PersistentAudio` mounts the
prepared element, replays readiness callbacks after the source owner commits,
and preserves generation/element guards against stale media events. The player
and dock still share one active transport. There is no crossfade or early cut.

This avoids waiting for a key, network fetch and decoder startup at the boundary.
It is an alternating-player implementation, not a sample-clock scheduling
guarantee. Browser event latency and actual audible gaps are different measures;
albums, continuous mixes and physical Hosts still need listening evidence.
Encrypted standby preparation is disabled when AAC MSE is unavailable; explicit
playback retains the bounded authenticated compatibility reader.

## Adaptive delivery

Each playback starts at 96 kb/s. Only measured network reads contribute to a
per-playback throughput estimate; ciphertext-cache hits do not masquerade as
bandwidth. Selection uses a 55% safety budget, drops promptly after congestion,
and requires eight seconds of buffer and two segments between upgrades.
Data-saving mode stays at 96. Active read-ahead is about 30 seconds; the existing
bounded ciphertext cache is shared with intent preparation.

Rendition changes append the authenticated initialization segment before its
media, keeping the AAC codec and W32 segment timeline. Inconsistent rendition
segment counts disable switching. Authentication failure is terminal: there is
no archival-master fallback or unverified alternate key. The compatibility
reader uses the lowest rendition rather than claiming adaptive MSE support.

## System controls and return

Media Session publishes the actual title, artist, artwork and transport state.
Play and Pause are explicit, idempotent commands. Only hosts/solo listeners get
supported Next/Previous/seek actions; guests keep local pause/resume. Unsupported
actions are optional individually, and dismissal clears system controls and
metadata. See the [Media Session specification](https://www.w3.org/TR/mediasession/).

One versioned checkpoint stores a release ID/hash, position, at most 24 queued
IDs, save time and local account/network scope. It expires after seven days and
is saved only on this device, never sent as listening history. Keys, media URLs,
room invitations and draft uploads are excluded. Another account/network cannot
see a matching resume offer. Storage denial leaves playback usable.

Returning offers Resume; it does not play or rejoin automatically. Resume
resolves active catalog entries and repeats the ordinary access flow, then seeks
after metadata. Closing the mini-player or dismissing saved listening clears the
checkpoint. A new explicit music choice replaces the old intent.

## Evidence boundaries

The first-sound export retains schema 6 and adds optional session aggregates:
up to 40 host/solo Next-to-`playing` latencies, native playing/post-start waiting time and rebuffer
ratio. These contain no account, room or release identifiers. Intentional pause
and native paused time are excluded; guest transport is outside this measurement.
They are media-event observations, not proof of audible output or
background execution. Rendition diagnostics remain in the existing bounded,
local startup observer; no analytics endpoint is added.

First sound p75 below one second, Next below 300 ms and rebuffering below 0.5%
remain measurement targets. Record physical Desktop/mobile Host versions,
foreground/background/lock behavior and actual audio on the release candidate;
never infer those from browser fixtures or a successful build.
