# 03 — Wallet-signed content-key requests for individual and host playback

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Implement production-grade content-key delivery for protected audio while preserving the UX distinction between individual playback and room playback.

Full encrypted audio must only be decryptable after a wallet-authenticated access check. The frontend must not contain a global content secret.

## Context
The current prototype derives a deterministic key from a frontend-bundled content secret and the content hash. This is useful for proving the audio protection concept, but it is not a production security boundary.

Dotify now distinguishes two protected playback contexts:

1. **Individual playback**: the listener requests full file playback and must satisfy the track access policy.
2. **Room playback**: the host requests full playback for streaming into a room. The host must satisfy the access policy; room listeners receive only the ephemeral WebRTC stream.

## Product decision

### Individual playback

- The listener must prove access.
- If authorized, the backend delivers a temporary content key to the listener.
- If unauthorized, the listener receives preview-only playback and an unlock/personhood action.

### Room playback

- Only the host must prove access.
- If the host is authorized, the backend delivers a temporary content key to the host only.
- Listeners receive only the ephemeral WebRTC stream.
- Listeners never receive the key or source file.
- If the host is unauthorized, Dotify returns preview-mode information instead of hard-failing the room.
- The host streams the 42% preview, sees a discreet unlock/personhood CTA, and the playlist auto-advances after the preview.

## Required endpoints

```txt
POST /api/auth/nonce
POST /api/tracks/:contentHash/key-request
```

## Required backend services

```txt
services/signatures.ts
services/chainAccess.ts
services/keyVault.ts
services/replayProtection.ts
```

## Request purpose

Every key request must declare its purpose:

```ts
type KeyRequestPurpose = 'individual' | 'room_host';
```

- `individual`: the signer is the listener who wants direct full-file playback.
- `room_host`: the signer is the host who wants to stream the track into a room.

There must be no `room_listener` key request purpose. Room listeners must never receive content keys.

## Signature requirements

Prefer EIP-712 typed data if wallet support is clean. Otherwise EIP-191 personal sign is acceptable for the first production spine, but the signed payload must be structured and domain-bound.

Payload must include:

```ts
{
  app: 'Dotify',
  action: 'REQUEST_CONTENT_KEY',
  purpose: 'individual' | 'room_host',
  contentHash: `0x${string}`,
  requester: `0x${string}`,
  chainId: 420420417,
  nonce: string,
  expiresAt: string
}
```

The signature must bind address, chain ID, purpose, expiry, and content hash.

## Chain access requirements

- Resolve the artist runtime that owns the track, or use known runtime context from metadata/catalog.
- Call `musicAccCanAccess(contentHash, requester)`.
- Fail closed if RPC is unavailable.
- Fail closed if runtime lookup is ambiguous.
- Never trust frontend-provided access booleans.

## Suggested response model

```json
{
  "access": "allowed | denied",
  "playbackMode": "full | preview",
  "previewRatio": 0.42,
  "reason": "HOST_ACCESS_REQUIRED | LISTENER_ACCESS_REQUIRED | EXPIRED_SESSION | RPC_UNAVAILABLE | ...",
  "contentKey": "only when access is allowed",
  "hostAction": {
    "type": "unlock | personhood | none",
    "label": "Unlock full stream"
  }
}
```

## Key custody requirements

For the first implementation, derive per-track keys server-side from:

```txt
HKDF(CONTENT_KEY_MASTER_SECRET, contentHash, 'dotify-track-key-v1')
```

This is acceptable for testnet production readiness. Document that future artist-operated key custody may replace this.

## Frontend requirements

- Remove production dependence on `VITE_CONTENT_SECRET`.
- Add key request client.
- Add wallet signing UX for individual full playback and room host full playback.
- Avoid wallet pop-up fatigue: a listening session should require at most one off-chain session signature where feasible, not one signature per track.
- Show precise states:
  - wallet required;
  - signature required;
  - checking access;
  - access denied;
  - preview mode;
  - key received;
  - decryption failed.
- Keep 42% preview behavior for unauthorized individual listeners.
- For unauthorized room hosts, preserve the room and stream the 42% preview instead of blocking the room.

## Acceptance criteria

- Unauthorized individual listener cannot decrypt full audio without backend key response.
- Classic paid listener can request key after `musicRoyPayAccess` confirms.
- Human free listener can request key only if `musicAccCanAccess` returns true.
- Backend can distinguish `individual` vs `room_host` key-request purpose.
- Unauthorized room host receives preview-mode response, not a hard room failure.
- Room listeners never receive content keys or encrypted source files.
- Room listeners are not required to connect a wallet/sign merely to listen to a host stream.
- Signature replay is rejected after nonce use or expiration.
- Frontend bundle no longer contains a production content secret.
- Tests cover signature verification, purpose handling, replay rejection, and access-check failure modes.

## Non-goals

- Do not implement full DRM.
- Do not promise that authorized playback cannot be recorded.
- Do not implement artist-operated key services yet.
- Do not give room listeners content keys.
- Do not require room listeners to sign merely to listen to a host stream.

## Senior-engineer notes

Be explicit in comments and docs: this protects distribution access, not analog capture. Do not oversell security. A serious product earns trust by naming its boundaries.

The social room is a doorway, not a wallet checkpoint.