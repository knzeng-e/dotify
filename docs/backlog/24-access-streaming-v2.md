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
- Land Dotify on the Polkadot App stack: Triangle hosts + Host API signing,
  PoP for humanity, Coinage as candidate payment rail, DotNS name, Statement
  Store presence.

## Phases

| Phase | Scope |
| --- | --- |
| P1 | Access model v2 (contracts + UI); delete the preview machinery |
| P2 | Session auth in the key service (SIWE login, token key requests) |
| P3 | Chunked container publish + MSE playback + v1 fallback |
| P4 | Real PoP behind `human-free` (promotes ticket 11 to build) |
| P5 | Triangle citizenship, DotNS, Statement Store presence |

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
  the file; v1 assets still play.
- P4: `human-free` verified against real PoP status, no admin mock.
- P5: Dotify runs inside a Triangle host with Host API signing and resolves
  under a `.dot` name.

## Non-goals

- Adaptive bitrate / HLS transcoding (revisit only if field data demands it).
- Coinage settlement implementation (tracked as its own design once the rail
  is evaluated).
- Absolute DRM claims - the non-DRM statement in the threat model stands.
