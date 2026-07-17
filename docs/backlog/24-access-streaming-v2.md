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

| Phase | Scope |
| --- | --- |
| P1 | Access model v2 (contracts + UI); delete the preview machinery |
| P2 | Session auth in the key service (SIWE login, token key requests) |
| P3 | Chunked container publish + MSE playback + v1 fallback + startup metrics |
| P4 | Product SDK feasibility spikes: Host detection/signing, resource allocation, PolkaVM/CDM contract portability, Playground deployment, and Statement Store presence |
| P5 | Real Humanity / Individuality behind `human-free` (promotes ticket 11 only after research proves the live source and privacy model) |

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
  stores a typed JSON header, and encrypts fixed-size chunks with AES-256-GCM.
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
- The resolver emits `dotify:dav2-startup` events for key authorization,
  gateway selection, header readiness, first range, first decrypt, first
  append, fallback, and error phases.
- Remaining #88 work: worker-based decryption, chunk read-ahead/pipelining,
  first-chunk sizing experiments, the browser/device validation matrix, and the
  backend read-through gateway decision.

Product SDK replanning note (2026-07-14):

- Product SDK (`@parity/product-sdk` 0.17.0 at
  `2f359bba28ca72855207a0a519d4118b37b4438c`) is prototype/reference/unaudited.
- Host APIs are progressive enhancement for Product containers; standalone web
  remains a supported mode.
- Product SDK contracts use `pallet-revive`, PolkaVM artifacts, and CDM
  manifests. Dotify's current Hardhat + viem + Paseo Asset Hub EVM path needs a
  portability spike before adopting that layer.
- Statement Store constraints make it a fit for small signed presence/discovery,
  not DAV2 media reads, SDP/ICE, durable chat history, or walletless guest
  reactions.
- Playground deploy / Bulletin / DotNS belong to the deployment track, not the
  playback/key-delivery boundary. They cannot substitute for backend-held
  content-key custody or server-side upload validation.
