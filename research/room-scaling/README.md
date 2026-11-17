# W39: local room scaling research

An isolated experiment, **not an alternative Dotify server**. Nothing here is
imported by the app, its services or their deployment images. It uses synthetic
names, an oscillator and short-lived local credentials. No wallet, production
endpoint, protected track, source file or content key is involved.

## Run

Requires Node 22.13.1, Docker (Redis only), a native **LiveKit server 1.13.11**
binary and Playwright Chromium. The server version is checked before startup.
From the
repository root:

```sh
npm ci --prefix web
npm ci --prefix research/room-scaling
cd research/room-scaling
npm exec playwright install chromium
npm test
W39_LIVEKIT_BINARY=/absolute/path/livekit-server npm run measure
# Faster signaling-only replay:
npm run measure -- --signaling-only
```

Docker must be available to the current user. All published ports bind to
`127.0.0.1`; literal loopback URLs are required by the generators. The Redis image is
pinned by digest in `measure.mjs`. CI downloads the official Linux SFU release
and checks its pinned SHA-256 before execution. Ports are selected locally; a
collision fails rather than displacing another process. The harness removes
only its own randomly named containers, child processes and temporary config.
It neither inspects nor changes the running Dotify deployment.
A forced termination can bypass cleanup. If interrupted, inspect local `w39-*`
containers/processes and remove only the resources belonging to that run.

For Linux x86_64, download `livekit_1.13.11_linux_amd64.tar.gz` from the
[official release](https://github.com/livekit/livekit/releases/tag/v1.13.11).
Its SHA-256 is `1e9ee90ca301e1842b2887fc77cb122759756a9c8aeb4334ee91de3325ec43fb`;
verify before extracting. The CI workflow includes the exact procedure. On
macOS, use the official Homebrew `livekit` formula at 1.13.11 and pass the path
to `livekit-server`. The measured native binary is identified in the evidence.
Docker Desktop SFU networking failed on the local Mac; the supported harness
therefore runs the SFU natively on loopback rather than weakening isolation.

`results.json` is ignored. Set `W39_OUTPUT=/absolute/path.json` to choose an
output. Reports contain test identities, counts, timings and RTP statistics,
never tokens. A failed assertion means the experiment failed; no report is
created claiming a pass. Retained reviewed measurements live alongside the
[W39 evidence](../../docs/backlog/implementation/evidence/W39.md).

## What it proves

1. Two instances of the **actual current server**, even with a Redis Socket.IO
   adapter, cannot share a room or recover it after a restart: its application
   `Map` is local. The adapter distributes packets, not application authority.
2. A deliberately reduced shared-state protocol can admit guests on two
   separate Node processes, enforce one atomic 24-guest limit, transfer owner
   authority with an epoch and rotated resume token, and reject stale owners.
   Forced process death waits for an owner lease to expire; a paused Redis
   refuses state mutations instead of inventing local success.
3. A local LiveKit SFU can distribute **one host audio track** to 25 synthetic
   guest connections. Every guest must receive RTP packets and decoded audio
   samples. Guest publication is refused, and the SFU's participant API must
   independently report one publisher and 25 subscribe-only guests.

## Deliberate omissions

The shared-state protocol supports only create/join/resume and a bounded
synthetic host event. It does not implement production SDP/ICE authorization,
chat replay, listener resume, membership leases after a guest process crashes,
Nearby/Worldwide discovery, TURN capabilities, tips, artist identity, rate
limits or all production shutdown semantics. Its room TTL is 60 seconds and
owner lease 1.5 seconds for a short failure experiment. These are test values,
not production recommendations. Never copy this server into a live deployment.

A host lease/epoch fences **future state writes**; it cannot retract a packet
already published or prove audible continuity during a deploy. The prototype's
clients are controlled observers, not migrated production clients. Production
clients would need snapshot/sequence reconciliation and stale-epoch rejection.
Socket.IO WebSocket transport is selected explicitly; polling affinity and
Fly routing are documented decisions, not exercised by this harness.

The SFU experiment exercises actual local WebRTC but does not use protected
music, application encryption, a remote network, TURN, physical audio output
or the Product Host. The SFU terminates ordinary WebRTC encryption and could
record the stream; no end-to-end media secrecy is claimed. This benchmark does
not establish mobile battery, WAN capacity, multi-region latency, sound quality
or a safe audience cap for production.
