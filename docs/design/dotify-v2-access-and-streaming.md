# Dotify v2 - access, protected streaming, and Polkadot App alignment

Status: living design and delivery plan. Last reviewed: 2026-07-10.

This document is the source of truth for the Dotify v2 access and streaming
pivot. It should answer four questions:

1. What product rules must never be broken?
2. What has already shipped?
3. What remains to build?
4. Which decisions must be made before implementation resumes?

It supersedes the 42% preview doctrine. Related reference docs may still mention
preview behavior; those pages should be treated as stale until they are updated
to match this plan.

## 1. Executive Summary

Dotify v2 changes the production spine in three ways:

1. **No degraded preview mode.** If a listener is not authorized for a protected
   track, Dotify shows the right action: unlock, verify humanity, or sign in.
   It does not play a truncated production file.
2. **Sign once, authorize per track.** A wallet signature opens a short-lived
   session. Every protected key request still performs a server-side on-chain
   access check, but the user is not prompted to sign for every track.
3. **Encrypted audio remains the default.** IPFS stores encrypted bytes. Free
   tracks can release keys without identity, but the track is still published
   through the protected pipeline so the artist can change future key-release
   policy without changing the app's storage model.

The next major unfinished piece is `dotify.audio.v2`: a chunked encrypted audio
container intended to let playback start after the first appendable decrypted
segment instead of after the whole file.

## 2. Current Delivery State

| Area | Status | Notes |
| --- | --- | --- |
| Access model v2, P1 | Delivered | `free`, paid/classic, and `human-free` modes are modeled; preview playback is retired for production access denial. |
| Session auth, P2 | Delivered | One sign-in session token can carry later key requests; legacy per-request signing remains as fallback. |
| Free-track key delivery | Delivered | The backend verifies public access on-chain before releasing a key with no wallet or signature. |
| Room access doctrine | Delivered and preserved | Only the host needs access; listeners receive only the WebRTC stream. |
| Chunked encrypted streaming, P3 | Open | v1 full-file encrypted blobs still play; v2 chunked publish/playback is not built. |
| Real Proof of Personhood integration, P4 | Open | Current `human-free` remains structurally ready but not backed by the live platform source. |
| Polkadot App / Triangle integration, P5 | Open | DotNS/Bulletin alignment exists conceptually; Product SDK, Host API signing, and Statement Store migration are future work. |

## 3. Non-Negotiable Invariants

These are product and security rules, not implementation preferences.

1. **Artist policy is the source of truth.** The current artist runtime decides
   who can receive a content key for a track.
2. **Fail closed.** Missing RPC config, ambiguous runtime ownership, invalid
   session tokens, unavailable personhood checks, and malformed refs deny keys.
3. **Room guests do not become wallet users by accident.** Joining a room never
   requires a wallet, payment, personhood proof, or content-key request.
4. **Room listeners never receive source material.** They receive an ephemeral
   WebRTC stream from the host, not encrypted files, clear files, or keys.
5. **Free means no wallet friction.** A `free` track can be played by a guest
   with no session. The backend still proves that the current on-chain policy is
   public before releasing the key.
6. **Encryption is not DRM.** Dotify protects source-file and key distribution.
   It cannot prevent recording by someone authorized to hear the music.
7. **Every realtime change needs browser validation.** Room streaming depends on
   actual browser media behavior; unit tests are not enough for capture,
   autoplay, MSE, or WebRTC timing.

## 4. Access Model V2

### Naming

The product language should converge on `free`, `paid`, and `human-free`.
Current code and contracts still use the historical `classic` enum/string for
the paid mode. Until the contracts are renamed, docs and UI should be explicit:

| Product mode | Current code/contract name | Who can play | Key path |
| --- | --- | --- | --- |
| `free` | `free` | Everyone | Backend zero-address access probe, no wallet/session |
| `paid` | `classic` | Buyers and the artist | Session-token key request, or legacy signed request fallback |
| `human-free` | `human-free` | Verified humans and the artist | Session-token key request plus personhood-backed access check |

### Artist updates

An artist must be able to change a track's access policy without re-uploading
the audio. This is why free tracks still use encrypted storage: the ciphertext
can stay stable while the on-chain key-release policy changes.

Important caveat: this is not cryptographic revocation. When a track is `free`,
the backend may release its content key to anyone. A listener or scraper that
captures that key can keep decrypting the existing CID after the artist flips
the policy to `paid` or `human-free`. A no-reupload policy flip controls future
Dotify key requests, not keys already released. If an artist needs true
revocation after a public-free period, Dotify must rotate the content key,
re-encrypt the audio, and publish a new CID.

Policy changes must preserve these rules:

- a past paid unlock remains recorded when a track flips away from paid and
  back again;
- a free track stops serving unauthenticated keys immediately after the policy
  changes away from `free`;
- the UI reads the latest policy from the runtime instead of trusting cached
  metadata;
- the room host's access is re-evaluated on track selection and when a selected
  track becomes unplayable.

### Unauthorized playback

Unauthorized individual playback is a gate, not audio:

- no 42% cutoff;
- no preview asset fallback in the v2 production path;
- no key delivered merely to build a teaser;
- CTA text names the real missing condition: pay, verify personhood, or sign in.

Optional artist-chosen excerpts can be revisited later as a separate asset type,
but they are not part of v2.0.

## 5. Session-Based Key Delivery

P2 is delivered and should remain constrained to identity, not access.

Flow:

1. The client asks the backend for a nonce.
2. The wallet signs a `SIGN_IN` challenge.
3. The backend verifies the signature and issues a short-lived bearer token.
4. Later protected key requests send the token and the request purpose.
5. The backend resolves the artist runtime and calls the current access policy
   for the requested `contentHash`.
6. Only then does the backend derive and return the per-track key.

The session token must not encode permanent access. It proves which address is
asking. The chain still decides whether that address may receive each key.

Boundary:

- token theft is bounded by TTL and revocation;
- logout revokes server-side when possible and always clears local storage;
- a stale/revoked token gets one fresh sign-in retry;
- older backends can fall back to per-request signing;
- room listeners are never valid key-request callers.

## 6. Protected Audio Containers

### v1: current full-file encrypted blobs

Current protected tracks use a single encrypted IPFS object:

```txt
audioRef = dotify:enc:ipfs://<CID>
fetch whole object -> decrypt whole object -> Blob URL -> <audio>
```

This is simple and compatible, but it delays first sound until the whole file is
downloaded and decrypted. That delay is visible when a host opens a room or
switches tracks.

v1 must remain playable indefinitely.

### v2: chunked encrypted audio

P3 should introduce an explicit v2 reference, for example:

```txt
audioRef = dotify:enc:v2:ipfs://<CID>
```

The file remains a single IPFS object and a single CID. Internally it contains a
header plus independently encrypted chunks.

Proposed container:

```txt
header:
  magic "DAV2"
  version = 1
  algorithm = "AES-256-GCM"
  chunkSize
  chunkCount
  mediaMime
  mediaCodecHint
  contentHash
  noncePrefix(4)
  headerLength

body:
  chunk[i] = AES-GCM(
    key,
    nonce = noncePrefix || uint64_be(i),
    aad = hash(headerWithoutMutableOffsets) || uint64_be(i) || plaintextLength,
    plaintext = originalBytes[i]
  ) || tag(16)
```

Rules:

- never reuse a `(key, nonce)` pair;
- reject malformed headers, unsupported versions, impossible chunk counts, or
  non-monotonic chunk indexes;
- authenticate chunk index and expected length as AAD so chunks cannot be
  reordered silently;
- keep the original media bytes and codec; do not introduce ffmpeg or HLS in
  P3;
- keep v1 fallback in the same resolver path.

Open technical risk: MSE does not promise that arbitrary byte chunks from every
source container are appendable. P3 must validate the first supported media
types before committing to "original bytes only". If reliable progressive
append requires segment-aligned output or transmuxing, P3 should narrow its
supported input set or explicitly promote a server-side media packaging step
instead of pretending chunked encryption alone solves streaming.

### v2 playback

The target browser path:

1. Fetch and parse the header.
2. Fetch encrypted chunks using HTTP Range requests.
3. Decrypt each chunk with Web Crypto.
4. Append decrypted bytes to a Media Source Extensions `SourceBuffer`.
5. Start playback after the first appendable segment.

Fallback:

- if MSE is unavailable or the codec is unsupported, fetch/decrypt as v1-style
  full file and play from a Blob URL;
- if the gateway does not support Range or CORS for range fetches, retry through
  configured IPFS gateway fallbacks before using the full-file fallback;
- if decryption fails for any chunk, stop playback and surface a protected
  media error. Do not skip corrupted chunks.

Implementation note: P3 should measure time-to-first-sound, not just time to
`loadedmetadata`. The product problem is audible dead air.

### v2 publish path

The production publish route should remain server-side:

1. Browser computes the raw audio content hash.
2. Browser uploads the raw file to the backend.
3. Backend derives the per-track key.
4. Backend writes the `DAV2` header and encrypts fixed-size plaintext chunks.
5. Backend pins the single encrypted object and returns a v2 audio ref.

The direct-browser demo path can keep publishing v1 blobs until there is a
clear reason to support v2 demo publishing. Do not block production P3 on a
browser-side chunked encryption fallback.

## 7. Rooms and Realtime Impact

Chunking should improve rooms without rewriting room signaling.

Expected effect:

- the host audio element receives playable bytes earlier;
- `captureStream()` still captures from the element;
- the existing host-to-listener WebRTC path continues to carry only the
  ephemeral stream;
- listeners do not request keys;
- the existing broadcast clock remains the first synchronization mechanism.

Out of scope for P3:

- replacing Socket.IO signaling;
- listener-side key delivery;
- adaptive bitrate;
- HLS transcoding;
- shared queue consensus;
- Statement Store migration.

Browser validation remains required before shipping P3:

- host starts a protected v2 track and room audio begins quickly;
- host switches v1 -> v2 and v2 -> v1 tracks;
- listener joins before and after first audio;
- mobile autoplay fallback still shows the explicit "start audio" action;
- `replaceTrack()` behavior remains stable when the source changes.

## 8. Polkadot App Stack Alignment

External platform target, reviewed against the Polkadot Apps docs
(https://docs.polkadot.com/apps/) on 2026-07-10:

- Polkadot Products are sandboxed single-page apps addressed by `.dot` names
  and loaded by the Polkadot Triangle hosts: Polkadot App, Polkadot Desktop,
  and Polkadot Web at `dot.li`.
- The platform model includes Host-mediated signing, chain access, storage,
  Statement Store messaging, Coinage payments, local storage, and
  Proof-of-Personhood-aware identity.
- The Host boundary matters: a Product should not assume arbitrary network or
  key access when running inside the Triangle.

Dotify mapping:

| Platform piece | Dotify use |
| --- | --- |
| Triangle hosts | Run the Dotify bundle as a Polkadot Product, using Host signing where available and existing wallet paths elsewhere. |
| Product SDK / Host API | Replace bespoke chain, signing, storage, and permission glue only where the SDK gives equivalent or better behavior. |
| Proof of Personhood | Replace the current admin/personhood mock with the live verified-human source for `human-free`. |
| Coinage | Candidate future payment rail for paid access; EVM runtime remains the settlement record until Coinage design is explicit. |
| DotNS | Keep `dotify.dot.li` / `.dot` resolution aligned with the Bulletin single-file build. |
| Bulletin Chain | Continue as a publication and availability layer for product bundles and manifests. |
| Statement Store | Future presence/chat/room-discovery layer; Socket.IO remains SDP/ICE relay until a separate migration is designed. |

P5 should start with a capability matrix, not a rewrite.

## 9. Phases and Acceptance Criteria

| Phase | Status | Scope | Acceptance criteria |
| --- | --- | --- | --- |
| P1 | Delivered | Access model v2 in contracts, backend, and UI; remove preview playback. | Free tracks play with no wallet; unauthorized protected tracks show gates with no audio; artists can change future key-release policy without changing app flow. |
| P2 | Delivered | Session auth for key service. | One signature opens a session; later protected listens do not prompt again; every key request still checks chain access. |
| P3 | Open | `dotify.audio.v2` chunked container, publish path, playback path, v1 fallback. | Protected first sound is bounded by one chunk on supported browsers; v1 assets still play; fallback is visible and tested. |
| P4 | Open | Real Proof of Personhood integration for `human-free`. | No admin mock in production; denied PoP checks fail closed; UI explains the exact missing proof. |
| P5 | Open | Triangle/Host API/Product SDK alignment and Statement Store design. | Dotify runs as a Host-compatible Product without assuming direct wallet/RPC access; room social state has a migration design. |

## 10. Required Test Coverage

### P1/P2 regression coverage

- access-mode encoding/decoding, including `free`;
- artist mode updates and paid-access persistence;
- free-key route: allowed, not-free, RPC failure, ambiguous runtime;
- session issue/verify/revoke/expiry;
- session key request still performs an on-chain access check;
- room guests never call key routes.

### P3 coverage

- container parser rejects malformed headers and unsupported versions;
- nonce construction is unique for every chunk;
- chunk AAD catches reordered or truncated chunks;
- v2 decrypts to exactly the original bytes;
- resolver chooses v2 playback for `dotify:enc:v2:ipfs://...` and v1 playback
  for `dotify:enc:ipfs://...`;
- MSE path can append the first supported decrypted segment and start playback;
- full-file fallback works when MSE or Range support is unavailable;
- room e2e measures that host source loading no longer creates multi-second
  silence on ordinary protected tracks.

### Manual QA before release

- two desktop browsers, host + listener;
- one mobile listener browser with autoplay restrictions;
- one slow gateway path to verify fallback messaging;
- one policy flip while a track is selected;
- one session expiry or logout while attempting protected playback.

## 11. Open Decisions

Blocking before P3 implementation:

1. **Chunk size.** Start with 256 KiB or 512 KiB, then tune with gateway latency
   and time-to-first-sound data. The decision should be metric-driven.
2. **Container prefix.** Confirm `dotify:enc:v2:ipfs://<CID>` fits contract
   string limits and all serializers before publishing v2 assets.
3. **MSE support matrix.** Decide the first supported media types, containers,
   and browsers. Do not design around codecs the current app cannot reliably
   append from decrypted chunks.
4. **Gateway strategy.** Decide whether P3 depends on public gateways supporting
   Range + CORS, or whether the backend must provide a read-through fallback.
5. **Instrumentation.** Define the exact metrics for dead air: source selected,
   first byte, first decrypted chunk, `loadedmetadata`, first audible play.

Blocking before stronger policy-flip claims:

1. **Key rotation.** Decide whether `free -> paid` should merely stop future
   unauthenticated key requests or should cryptographically revoke the formerly
   public key. The latter requires re-encryption and a new CID.

Blocking before P4:

1. **PoP source of truth.** Choose the live query path and privacy boundary for
   verified-human status.
2. **Failure copy.** Decide what the UI says when PoP cannot be checked versus
   when the listener is known not to satisfy the required level.

Blocking before P5:

1. **Capability matrix.** Compare current direct browser integrations with Host
   API/Product SDK equivalents.
2. **Statement Store scope.** Decide whether to migrate chat, presence,
   reactions, room discovery, or only one surface first.
3. **Payment rail.** Keep EVM settlement until Coinage has a separate design
   with accounting, refunds, and royalty-split semantics.

## 12. Documentation Cleanup Queue

After this plan is accepted, update the docs that still describe preview-era
behavior:

- `docs/explanation/access-control-model.md`;
- `docs/reference/hooks-api.md`;
- `docs/reference/types.md`;
- `README.md` sections that still say unauthorized hosts stream a 42% preview;
- any backlog rows that mark P2 as open even though session auth has landed.

This cleanup should be a docs-only PR unless implementation drift is found.
