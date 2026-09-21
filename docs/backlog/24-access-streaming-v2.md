# 24 - Access model v2 + protected chunked streaming (Dotify v2)

## Sprint

Strategic pivot - supersedes the 42% preview doctrine. Full design in
`docs/design/dotify-v2-access-and-streaming.md`.

## Priority

P0 once approved (it redefines the production spine's access rules).

## Objective

- Replace preview-based gating with a three-mode artist policy: `free`,
  `paid`, `human-free` (Proof of Personhood).
- Sign once per session; per-track authorization becomes an on-chain read by
  the key service (no signature per listen).
- All audio encrypted at rest on IPFS, streamed in chunks
  (`dotify.audio.v2`: chunked AES-256-GCM + Range requests + MSE) for fast
  starts; v1 blobs keep playing.
- Prepare Dotify for the current Polkadot product stack without making it a
  hard dependency for first sound: Product SDK host capabilities, Playground /
  Bulletin / DotNS deployment, Humanity / Individuality research, and Statement
  Store presence where the constraints fit.

## Phases

| Phase | Scope                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1    | Access model v2 (contracts + UI); delete the preview machinery                                                                                                     |
| P2    | Session auth in the key service (SIWE login, token key requests)                                                                                                   |
| P3    | Chunked container publish + MSE playback + v1 fallback + startup metrics                                                                                           |
| P4    | Product SDK feasibility spikes: Host detection/signing, resource allocation, PolkaVM/CDM contract portability, Playground deployment, and Statement Store presence |
| P5    | Real Humanity / Individuality behind `human-free` (promotes ticket 11 only after research proves the live source and privacy model)                                |

## Constraints

- Room doctrine unchanged: host satisfies policy; listeners get only the
  ephemeral WebRTC stream, no wallet, no session.
- Fail closed on every ambiguous access decision; keys never in the bundle.
- Honesty: encryption of `free` tracks is a policy hinge (mode can change
  later), not secrecy - documented as such.
- Realtime changes to the WebRTC path require two-device browser validation
  before landing (standing lesson from the reverted replaceTrack attempt).

## Acceptance criteria (per phase, summarized)

- P1: an unauthorized listener gets a clear unlock CTA (pay / verify / sign
  in), never a truncated file; preview code paths removed; artist can change
  a track's mode without re-uploading.
- P2: exactly one signature per session; subsequent protected listens play
  with no wallet interaction; token TTL + revocation documented in the threat
  model.
- P3: time-to-first-sound on a protected track is bounded by one chunk, not
  the file; v1 assets still play; host startup emits source-to-first-audio
  metrics for QA.
- P4: feasibility docs and prototypes prove which Product SDK capabilities work
  for Dotify without weakening standalone web, DAV2, or room guest invariants.
- P5: `human-free` verified against real Humanity / Individuality status, no
  admin mock, with privacy, consent, and address-binding documented.

## Non-goals

- Adaptive bitrate / HLS transcoding (revisit only if field data demands it).
- Coinage or other payment rail implementation (tracked as its own design once
  the rail is evaluated).
- Absolute DRM claims - the non-DRM statement in the threat model stands.

## Delivery notes

P1 delivered in two stacked PRs:

- P1a (`feat/access-v2-p1`): contracts + key service. `AccessMode.Free`
  (appended, storage-safe), artist-only `musicRegSetAccessMode` (mode changes
  without re-upload; past buyers survive flips), Free branch in
  `musicAccCanAccess`, factory selector routing, ABI regen, 8 hardhat tests.
  Key service: `checkPublicAccess` (zero-address probe), unauthenticated
  `POST /:contentHash/free-key` (rate-limited, chain-verified, fail-closed),
  denials stripped of the preview framing. 4 new API tests.
- P1b (`feat/access-v2-p1b`): web + preview deletion. `free` mode in types,
  encoding, publish UI (third door option + review copy), labels. Guests probe
  access with the zero address, so Free tracks play with no wallet;
  `requestFreeContentKey` fetches their key without a signature. Deleted: the
  42% slicing/cutoff/preview-asset machinery in useCatalog, the preview wiring
  in PlaybackProvider/PersistentAudio/ListenerShell, the WAV preview encoders
  (`shared/utils/audio.ts`), `uploadPreviewToBackend` + publish-time preview
  generation, and the API `/api/uploads/preview` route. Unauthorized playback
  is the unlock gate, no audio. Room hosts without access stream nothing and
  move the room to a playable track; the room playback-mode wire protocol
  stays (always 'full') for compatibility and is scheduled for removal with
  the signaling cleanup. e2e specs rewritten to the v2 expectations
  (locked-not-preview, no-stream-for-unauthorized-host) and covered by the
  current deterministic Playwright suite.

P2 delivered (`feat/access-v2-p2`, stacked on P1b):

- Key service: `sessionTokens.ts` (HMAC tokens HKDF-derived from the master
  secret, 24h TTL, constant-time verify, jti revocation), SIGN_IN message +
  `verifySignInRequest` in signatures.ts, `POST /api/auth/session` +
  `/api/auth/logout`, and a session-token path on the key-request route (the
  on-chain check still runs per request). 13 new API tests (37 total).
- Web: `ensureDotifySession` (one signature, token stored per address with a
  refresh margin), key requests ride the token with a single re-sign retry on
  401 and a clean fallback to per-request signing for backends without
  session support; wallet disconnect signs the session out server-side.
- Threat model updated with the session-auth boundary.

P3 first vertical slice delivered (`agent/audio-v2-p3`):

- Backend: `/api/uploads/audio` now writes a single `DAV2` IPFS object and
  returns `dotify:enc:v2:ipfs://<CID>`. The object keeps original media bytes,
  stores a typed JSON header, and encrypts authenticated chunks with
  AES-256-GCM. New uploads use a smaller first chunk while the table continues
  to describe every exact chunk length.
- Web: v2 refs request the backend-delivered content key, try Range + MSE
  playback through configured IPFS gateways, and fall back to full-file decrypt
  when Range or MSE is unavailable before streaming starts. v1 refs still play.
- Artist publish: the registry stores the full encrypted audio ref while the
  manifest keeps the raw CID field for compatibility.
- QA: the host playback layer emits `dotify:host-audio-startup` events for
  `source-selected`, `metadata-ready`, `first-audio`, and `error`. Browser and
  gateway validation is still required before calling P3 release-ready.

#88 startup hardening slice:

- DAV2 Range reads now use bounded gateway requests, hedge the header and first
  chunk against a second gateway when the first one stalls, and cache the
  winning gateway per CID for the browser session.
- MSE playback now prepares the current chunk plus one future chunk while the
  current clear chunk is appended. Appends stay strictly ordered, track changes
  abort the bounded pipeline, and at most two container chunks are in the
  default preparation window. Existing uniform containers use about 1 MiB;
  newly published containers use about 768 KiB for the 256 KiB first chunk and
  one 512 KiB future chunk.
- The browser imports the AES content key once per playback instead of once per
  chunk. Known chunk ranges must return the exact byte count; truncated or
  mismatched `206` responses retry another gateway instead of being
  misclassified as a content-authentication failure.
- The resolver emits `dotify:dav2-startup` events for key authorization,
  gateway selection, header readiness, first range, first decrypt, first
  append, fallback, and error phases.

W08 first-sound slice:

- The app installs a retained QA snapshot at `window.__DOTIFY_AUDIO_STARTUP__`.
  It records bounded DAV2 startup events plus host source-to-first-audio events,
  so reviewers can compare key authorization, gateway selection, first bytes,
  decryption, MSE append, and actual audible start without leaking content keys.
- The player and dock now surface listener-safe DAV2 startup phases while the
  media element is preparing, replacing the single generic preparing label for
  protected startup.
- Cover artwork gateway recovery now has a 1.2 second per-gateway budget and a
  deterministic generated fallback when all sources fail or time out.
- DAV2 AES-GCM chunk decryption now runs in a dedicated Web Worker in the MSE
  pipeline and the full-download recovery path. Worker startup is bounded to
  1.5 seconds, track changes terminate pending work, and hosts without Worker
  support retain the same fail-closed Web Crypto fallback. Startup telemetry
  records which execution path prepared the first chunk.
- Deliberate track intent now warms the public encrypted DAV2 header and first
  chunk during cover hover/focus/touch and room-track choice. It never performs
  an access read, asks for a signature, requests a content key, decrypts media,
  or starts playback.
- Playback shares an in-flight intent request or reuses exact encrypted ranges
  for 90 seconds, extended for the current two transport neighbors while
  listening. The session-only LRU remains bounded to 8 entries and 3
  MiB; speculative headers above 256 KiB and first chunks above 768 KiB are
  refused. Startup telemetry distinguishes an intent-prefetched range from the
  existing winning-gateway cache.
- Next and Previous share a stable neighbor plan with their preparation path,
  including a single shuffle choice. After playback has enough buffered audio,
  the host prepares the next and previous DAV2 headers and first chunks
  sequentially. Backgrounding, pause, seek, buffering, offline, and reported
  data-saving/2G connections suspend that speculative work. Explicit transport
  intent takes priority and adopts a matching in-flight neighbor request.
  Direction changes remain available while loading; selection cancellation and
  media-generation ownership discard obsolete results. This adds no key
  request, download right, queue, or gapless guarantee. See the
  [dated Next/Previous evidence](implementation/evidence/W08-next-previous-2026-09-21.md).
- New backend publications now use a 256 KiB baseline first clear chunk
  followed by the existing 512 KiB steady-state chunks. For an MP3 with
  validated leading ID3 metadata, the API expands that first chunk only enough
  to retain up to 64 KiB of audio payload, capped at the former 512 KiB
  boundary. An ordinary first encrypted media range therefore falls from
  524,304 to 262,160 bytes including its AES-GCM tag without letting a large
  cover tag consume the complete warm range. The DAV2 schema and key derivation
  are unchanged, existing uniform containers remain readable, and explicit
  chunk-size callers retain uniform behavior.
- Remaining #88 work: validate the selected first-chunk size on the physical
  browser/device matrix, collect cold/warm samples, and make the backend
  read-through gateway decision from those measurements.

#87 responsive-cover slice (2026-09-18):

- New backend cover uploads are decoded and normalized server-side into square
  WebP variants at 64, 160, 320, and 640 px plus a 24 px blurred placeholder.
  The archival original remains in the same immutable IPFS directory. The API
  serializes the memory-heavy normalization stage process-wide, decodes and
  attention-crops the source once, then derives smaller variants sequentially
  from the bounded 640 px canonical image.
- The registry-compatible `imageRef` remains a normal image URI and now points
  to `<directory CID>/cover/640.webp`; no contract or manifest migration is
  required. Legacy single-file cover refs continue through the existing
  gateway and generated-aura fallback path.
- `CoverImage` derives same-CID `srcset` and placeholder URLs from that stable
  directory shape, defaults non-hero artwork to lazy/async loading, and marks
  the player hero as eager/high priority.
- Remaining #87 work: perform a real authorized upload against Pinata, collect
  cold mobile transfer/paint samples, decide the read-through edge policy, and
  backfill selected legacy originals only after the new path is proven.

Product SDK adaptation note (updated 2026-09-12):

- Product SDK 0.27.0 and deploy tooling 0.16.2 remain
  prototype/reference/unaudited in Dotify's pinned baseline after the Product
  DevNet DotNS/CDM/descriptors refresh.
- Root PAPI 3.0.0 is not adopted yet because the current Product SDK graph
  uses PAPI 2.2.x while `@polkadot-apps` still uses PAPI 1.23.x.
- Host APIs are progressive enhancement for Product containers; standalone web
  remains a supported mode.
- Host detection, explicit Product account identity, a Product DevNet build,
  canonical room links, and dual-origin Fly configuration are implemented.
- Product SDK contracts use `pallet-revive`, PolkaVM artifacts, and CDM
  manifests. Dotify's current Hardhat + viem + Paseo Asset Hub EVM path needs a
  portability spike before adopting that layer.
- Statement Store constraints make it a fit for small signed presence/discovery,
  not DAV2 media reads, SDP/ICE, durable chat history, or walletless guest
  reactions.
- Playground deploy / Bulletin / DotNS belong to the deployment track, not the
  playback/key-delivery boundary. They cannot substitute for backend-held
  content-key custody or server-side upload validation.
