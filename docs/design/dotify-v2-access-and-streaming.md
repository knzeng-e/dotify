# Dotify v2 - access model, protected streaming, and the Polkadot App stack

Status: proposed design (no code in this PR). Supersedes the 42% preview
doctrine. Grounded in the Polkadot Apps platform documentation
(https://docs.polkadot.com/apps/): the Polkadot Triangle hosts (Desktop, App,
Web at dot.li), the Product SDK, Proof of Personhood, Coinage, DotNS, Bulletin
Chain, and the Statement Store.

## 1. What changes and why

Three decisions, taken together:

1. **The 42% preview is removed.** Access becomes a clean, artist-chosen
   three-mode policy: `free`, `paid`, `human-free` (free for verified humans,
   via Proof of Personhood). An unauthorized listener sees an honest unlock
   action, not a crippled file. Discovery moves to where the philosophy always
   said it lives: free tracks and shared listening rooms (where the host's
   access already lets anyone hear full tracks).
2. **Sign once, listen freely.** One wallet signature opens a session; every
   later track authorization is an on-chain read performed by the key service,
   not a new user signature. Access feels instant for a logged-in user.
3. **Audio is encrypted at rest and streamed in chunks.** IPFS never holds
   clear audio; playback starts after the first chunk instead of after the
   whole file.

The end state runs as a Polkadot Product inside the Triangle hosts, with PoP
for humanity, Coinage as the candidate payment rail, a DotNS name, and the
Statement Store as the presence layer.

## 2. Access model v2

### Modes

| Mode | Who can play | Authorization source |
| --- | --- | --- |
| `free` | Everyone, no wallet | None (policy readable on-chain) |
| `paid` | Buyers | On-chain payment record (`musicAccCanAccess`; Coinage as future rail) |
| `human-free` | Verified humans | Proof of Personhood status (replaces the mocked `setPersonhoodLevel` admin call) |

The artist sets the mode at publish and can change it later on-chain (their
runtime, their policy). `human-free` maps onto the existing DIM1/DIM2
personhood levels already modeled in the contracts and frontend.

### Everything encrypted at rest - including free tracks

All audio is encrypted before pinning, uniformly. Rationale:

- **Artist sovereignty over time**: the mode is pure on-chain policy. An artist
  can flip `free -> paid` (or the reverse) without re-uploading or re-pinning,
  because the ciphertext never changes - only the key-release policy does.
- **One pipeline**: no clear/encrypted fork in publish, storage, or playback.
- **IPFS is never a leak**: a pinned CID is public forever; if a track is ever
  meant to be protected, its bytes must have been protected from day one.

For `free` tracks the key service releases the content key without any
authentication - the "protection" is only that access policy is enforceable
later. This is documented honestly: encryption here is a policy hinge, not
secrecy.

### What gets deleted

The whole preview apparatus: the 42% slicing path, the preview cutoff/limit
logic, the published preview assets and `/api/uploads/preview` (ticket 18 -
delivered, now consciously retired; the boundary doc gets updated), and the
preview-vs-full playback modes in rooms. Unauthorized playback becomes: no
audio, a clear unlock CTA naming the mode (pay / verify humanity / sign in).
This deletes more code than it adds.

## 3. Sign once: session-based key delivery

### Today

Every protected listen requires a fresh wallet-signed request (nonce, expiry,
replay protection). Correct, but each listen interrupts with a signature.

### Design

1. **Login**: the user signs one SIWE-style message ("Sign in to Dotify",
   address, chainId, nonce, expiry). The key service verifies it once and
   issues a short-lived session token (JWT, ~24h, revocable, bound to the
   address). On Triangle hosts this signature goes through Host API signing.
2. **Per-track authorization**: a key request carries the session token, not a
   signature. The service authorizes by reading the chain:
   - `paid` -> `musicAccCanAccess(contentHash, address)`;
   - `human-free` -> the address's PoP/personhood status;
   - `free` -> released without a token at all.
   Chain reads are free and fast; the user signs nothing.
3. **Client caching**: content keys stay in memory for the session (already the
   case); the session token persists in storage; keys never do.

### Boundary (honest)

- Token theft is bounded by TTL + server-side revocation; a stolen token can
  fetch keys only for tracks that address already has access to.
- Keys are still per-track and delivered only after an on-chain check; nothing
  moves into the bundle. Fail closed everywhere, as today.
- The room doctrine is untouched: only the host needs access; room listeners
  receive the ephemeral WebRTC stream, never keys or files. Room guests still
  need no wallet, no session, no signature.

## 4. Protected chunked streaming: `dotify.audio.v2`

### Problem

v1 stores one AES-256-GCM blob. GCM authenticates the whole message, so the
client must download and decrypt the entire file before the first second of
audio. Long tracks = slow starts, for the host too (slow room starts).

### Container

```
header: magic "DAV2" | version | chunkSize (e.g. 512 KiB) | chunkCount | baseNonce(12)
body:   chunk[i] = AES-256-GCM(key, nonce = baseNonce XOR counter(i), plaintext[i]) || tag(16)
```

- Same per-track key derivation as today (HKDF from the master secret,
  server-side at publish).
- Per-chunk nonce derived from a random base nonce + chunk counter; per-chunk
  16-byte auth tag preserves integrity at chunk granularity (this is why plain
  AES-CTR + Range was rejected: no per-range integrity).
- Single file, single CID: no per-chunk pinning fan-out, and IPFS gateways
  already serve HTTP Range requests over unixfs files.

### Playback

- Client fetches the header, then chunks progressively via Range requests,
  decrypts each with Web Crypto, and appends to a Media Source Extensions
  `SourceBuffer`. Time-to-first-sound becomes one chunk, not one file.
- Fallback: browsers/codecs without usable MSE take the v1 path (full fetch,
  decrypt, object URL). v1 blobs remain playable forever (version byte).
- No ffmpeg, no HLS transcoding, no server binary: the backend keeps doing
  exactly one thing at publish (encrypt), just in a chunked layout. HLS with
  adaptive bitrate stays a future option if network diversity demands it; it
  is not the balanced first step.

### Rooms and realtime

- The host element is fed by MSE; `captureStream()` on that element works the
  same, so the WebRTC path (capture -> peers) is untouched.
- Faster host loading directly shortens the room's dead air on track change -
  the current renegotiation cost is dominated by source loading, which
  chunking attacks at the root.
- Sync keeps the existing broadcast clock (`player:state` at ~900ms). Two
  candidate refinements are deliberately deferred behind two-device browser
  validation (lesson learned from the reverted `replaceTrack` attempt):
  drift-correcting the listener clock, and in-place track swaps.

## 5. Polkadot App stack alignment

| Platform piece | Use in Dotify |
| --- | --- |
| Triangle hosts (Desktop, App, Web/dot.li) | Run Dotify as a Polkadot Product: host detection + Host API signing next to the extension/passkey paths |
| Product SDK | Chain access, storage, messaging, identity primitives replacing bespoke glue where it fits |
| Proof of Personhood | The real check behind `human-free` (verified-human status without identity disclosure) |
| Coinage | Candidate privacy-preserving rail for `paid`; the EVM runtime stays the settlement of record until Coinage integration is designed |
| DotNS | `dotify.dot` name on the existing single-file Bulletin/IPFS build (`build:bulletin` already produces it) |
| Bulletin Chain | Already used for manifest archival; continues as the availability layer |
| Statement Store | Presence layer migration: room discovery, presence heartbeats, chat as signed pub/sub; Socket.IO remains the SDP/ICE relay initially |

## 6. Phases (each independently shippable)

| Phase | Scope | Unlocks |
| --- | --- | --- |
| P1 | Access model v2 in contracts + UI; delete preview machinery | Simpler product, honest gating, less code |
| P2 | Session auth in the key service (SIWE login, token-carrying key requests) | Sign once, listen freely |
| P3 | `dotify.audio.v2` chunked container: publish + MSE playback + v1 fallback | Fast starts, fast rooms |
| P4 | PoP integration for `human-free` (promote ticket 11 research to build) | The differentiator, real |
| P5 | Triangle citizenship: host detection, Host API signing, DotNS name; Statement Store presence | Native Polkadot Product |

Order rationale: P1/P2 are cheap and remove friction immediately; P3 is the
perf backbone; P4/P5 are the platform moves and depend on nothing in P1-P3
being wrong.

## 7. Open questions (decisions to take before P1 lands)

1. **Key custody decentralization**: the master-secret HKDF stays for P1-P3;
   the improvement plan's per-artist derivation / threshold-shares path should
   be scheduled no later than P4.
2. **Chunk size**: 512 KiB default (about 30s of 128kbps audio, 3-4 RTTs to
   first sound on decent links); tune with real gateway latency measurements.
3. **Free-mode key delivery**: unauthenticated key release (proposed) vs a
   session requirement even for free (more uniform, more friction). Proposed:
   unauthenticated - free must feel free.
4. **What "unlock" looks like without a preview**: rooms and free tracks are
   the discovery surface; does the catalog card need a 15-30s artist-chosen
   excerpt as a separate optional asset later? Out of scope for v2.0, flagged.
