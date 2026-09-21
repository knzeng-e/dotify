# W08 — Next and Previous preparation

## Identity and scope

- Date: 2026-09-21.
- Reviewed base: `898579df5c403d9a3ea1c3eb39d9309e83c2cae2` (`dev`, PR #208).
- Branch: `perf/fluid-next-previous`.
- PR: [#209](https://github.com/knzeng-e/dotify/pull/209), draft into `dev`.
- Implementation: `3f84a5c` (source and regression tests; this record is a later documentation commit).
- Refs #88; room regression coverage also relates to #89. Neither epic is completed by this slice.
- Scope: the first listening-performance increment requested after the roadmap audit. Existing visual work is retained; Product messaging, queues, download rights, and NFTs are separate increments.

## Delivered behavior

Next and Previous both prepare the bounded DAV2 header and first encrypted
chunk of their target. One neighbor plan drives preparation and the button
action, so hovering Next does not select a different random target when shuffle
is enabled. Previous preserves catalog order, including wraparound; this is not
a newly introduced listening-history policy.

After the current audio is playing, preparation waits 500 ms and requires at
least ten seconds buffered, or the entire remaining track for a shorter clip.
Neighbors are fetched sequentially, deduplicated, and limited to two. Pause,
seek, buffering, a hidden page, offline state, and reported Save-Data/2G
connections cancel automatic preparation. Browsers without connection hints
use visibility and media-buffer checks. A deliberate cover or transport gesture
takes priority; choosing the in-flight neighbor transfers ownership of its
request before the outgoing audio pauses.

Next/Previous remain usable during a slow selection. Each new selection
retires the previous attempt. Existing selection IDs and separate native media
generations keep stale responses and media events from replacing the final
choice. Play/seek still wait for media readiness.

## Architecture and boundaries

1. `trackNavigation.ts` plans the two target IDs and defines the readiness policy.
2. `usePlaybackPrefetch.ts` observes local media and page lifecycle. It only runs
   in host/individual mode; room guests continue to consume WebRTC audio.
3. `audioV2IntentPrefetch.ts` coordinates one explicit intent and one bounded,
   serial neighbor batch. It cannot request access, signatures, or content keys.
4. `audioV2Gateway.ts` reuses exact encrypted ranges and pending requests. Leases
   keep current neighbors useful beyond the ordinary 90-second age limit during
   long tracks; the existing 8-entry/3-MiB LRU budget always wins. Lease release
   restores ordinary expiration; no durable cache or clear media is introduced.
5. `useCatalog.selectTrack` promotes the selected DAV2 preparation before
   pausing the outgoing audio and retains all existing authorization/decryption
   checks. Selecting a non-DAV2 source cancels obsolete speculative work.

Prefetch failure is silent and optional: real playback retains its own bounded
gateway retry path. Encrypted bytes are not playable access. An unauthorized
neighbor still fails closed when selected, and listeners never receive keys.
Network gateways can observe requested content identifiers as with existing
intent warming. No additional analytics or cross-session listening history is
introduced.

There are no new environment variables, permissions, server configuration,
contracts, ABIs, SDK dependencies, or data migrations. Deployment configuration
is unchanged. Rollback is a code revert; nothing has been deployed. This does
not change room signaling or replace WebRTC peers.

## Validation

| Check | Result and meaning |
| --- | --- |
| `npm --prefix web run test:unit` | 590 tests passed in 74 files; focused navigation rerun passed after restoring the existing missing-selection fallback. |
| Focused DAV2/navigation unit tests | Sequential Next/Previous, deduplication, bounded count/size, promotion without duplicate fetch, obsolete-request cancellation, failure isolation, long-track TTL, data-saving and buffer policy. |
| `npm --prefix web run build` | Passed; unchanged Rollup warnings for large chunks, mixed imports, and a dependency annotation. |
| `npm --prefix web run lint` | Passed, zero errors; three existing hook-dependency warnings in unchanged App/ArtistShell. |
| `npm --prefix web run build:product-devnet:frozen` | Passed on finalized source. Validates the Product package using the committed catalog bootstrap; does not refresh live catalog data or deploy. |
| `npm --prefix web run test:e2e -- --workers=2` | 116 tests passed in 2.9 minutes on the finalized source, including both capture paths, mobile/desktop layouts, room sync, blocked autoplay, access and artist/support journeys. |
| Visual inspection | Inspected generated player screenshots at 390×844 and room screenshots at 1435×833; cover, timeline, transport and conversation remain separate and visible. |
| Formatting, `git diff --check`, offline backlog sync | Passed for changed source/tests and backlog consistency. |

The browser regression tests exercise real native audio and real local WebRTC.
The receiver's analyser distinguishes 440 → 660 → 440 → 660 Hz during
Next → Previous → Next, with the same remote stream and no additional offers,
both with native capture and the Web Audio fallback. Other tests reverse a
blocked Next twice and verify that cancelled attempts never report playback,
exercise automatic encrypted warming only after playback, verify reuse on
Previous hover, deny unauthorized playback, and report zero speculative key
requests. Save-Data suppresses neighbor traffic.

During iteration, one new test initially expected a nonexistent `cancelled`
phase; it now verifies the actual terminal event, `error` with
`selection-interrupted`. A first full run had 113 passes and three room failures
while a source edit triggered Vite updates. The final full run uses stabilized
files and two workers and passed all 116 tests; the interrupted run is not
treated as release evidence.

## Remaining acceptance and exact next step

PR #209 is assigned to `knzeng-e`, labeled `P0`, `audio`, `testing`, and
`dotify-backlog`, and attached to Project 5. Its fields mirror #88:
Priority=P0, Track=Production spine, Phase=Next, Type=Work,
Backlog doc=`docs/backlog/24-access-streaming-v2.md`; draft status is In Progress.
No active milestone or other reviewer ownership was identified. Project fields
were read and set through the existing signed-in browser because the CLI token
does not have the Projects scope; the shared project view was restored afterward.

- Physical Product Desktop, Safari/iPhone, Firefox and Android timing is **not
  measured** by these fixtures. No sub-two-second or gapless claim is made.
- Authorization and key-service latency remain on the selected-track path.
  This slice warms ciphertext, not decrypted audio or rights. Legacy/full-file
  media do not gain DAV2 range preparation.
- The existing local host lineup does not become a shared queue here. Automatic
  end-of-track sequencing, history-aware Previous, and crossfade remain separate.
- After review and merge, bind a test candidate to its exact build identity.
  With an already authorized three-track DAV2 set, collect cold, warm Next, and
  warm Previous samples in solo and host/guest rooms. Include quick Next →
  Previous, a denied release, a slow key service, a gateway failure, background/
  resume, and reported data-saving mode. Record host versions, failures, counts
  and p75 from `window.__DOTIFY_AUDIO_STARTUP__`, using the existing W13 evidence
  workflow. Do not infer physical device support from Chromium tests.
- Only then select the next listening/host-queue increment from current `dev`.
  Product signaling/Statement Store and artist rights remain distinct scopes;
  this PR does not reopen the delivered premium-UX work.
