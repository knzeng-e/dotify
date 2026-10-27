# W35 - Make listening continuous: gapless, adaptive, and system-integrated

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W35** only. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/continuous-player` created from the latest tested `origin/dev`.
- Dependencies: W32, W34. W33 recommended.
- Release stage: Next (streaming experience track).
- Product purpose: once music starts, it keeps going, across tracks, network changes, the lock screen, and a reopened app.

## Outcome

1. **Gapless transitions** by appending the next track to the same MSE source buffer, or by alternating two players, with no audible gap on albums and continuous mixes.
2. **Adaptive bitrate.** Choose the W32 rendition from measured throughput; start at the lowest rendition when the network is unknown; keep about 30 seconds of buffer ahead.
3. **Next-track preparation** about 15 seconds before the end: W34 key plus the first two segments, cancelled on pause, skip, background, or data saving (reuse `usePlaybackPrefetch`).
4. **System controls.** Media Session metadata, artwork, and actions (play, pause, next, previous, seek) for lock screens, headsets, and notifications.
5. **Resume.** The queue and position are stored locally (no wallet-linked history server-side) and offered on return.
6. **Background playback evidence.** Record whether Polkadot Desktop and App web views keep audio playing in the background. Do not claim support without device evidence.
7. **Metrics.** Extend the first-sound evidence with time to first sound, Next latency, and rebuffer ratio. Proposed targets: first sound p75 under 1 s on a warm session, Next under 300 ms, rebuffering under 0.5 percent of listening time. These are goals until measured.

## Acceptance and meaningful verification

- Audio continuity Playwright suite extended: gapless boundary, rendition switch under throttling, pause/seek across tracks, failure recovery.
- Media Session actions covered with a stubbed API.
- Device evidence for background playback recorded per host version, or marked not run.

## Scope boundary

No offline downloads (separate decision; it must not be presented as DRM). No change to room transport.

## Handoff

Write `docs/backlog/implementation/evidence/W35.md` using `evidence-template.md`.

## Implementation checkpoint, 2026-10-27

The [continuous-listening design](../../explanation/continuous-listening.md)
uses one silent authorized successor and adopts that exact native element.
It does not concatenate distinct track timelines or alter room transport.
Encrypted standby requires AAC MSE; the compatibility reader remains available
for explicit playback. Native event handoff latency is measured separately from
sample-accurate audible continuity, which still requires physical listening.

The implementation also covers measured rendition selection, Media Session,
account/network-scoped local position/queue resume and identifier-free continuity
aggregates in first-sound exports. See [evidence and remaining gates](evidence/W35.md).
This checkpoint is not a deployment or a physical Host background claim.
