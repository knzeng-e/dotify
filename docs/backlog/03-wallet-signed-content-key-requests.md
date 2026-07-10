# 03 — Wallet-signed content-key requests for individual and host playback

> Superseded note: ticket 24 access model v2 retired the preview fallback
> described in this historical ticket. Current denied protected playback is a
> gate with no audio; unauthorized hosts stream nothing until they select or
> unlock a playable track.

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
---

## Delivery notes (implemented 2026-06)

### What shipped

- `POST /api/auth/nonce` issues single-use nonces bound to address + chain ID (`services/api/src/services/replayProtection.ts`, in-memory, 5 minute TTL).
- `POST /api/tracks/:contentHash/key-request` verifies an EIP-191 structured signature, consumes the nonce, resolves the owning artist runtime by enumerating the `ArtistDirectory`, calls `musicAccCanAccess(contentHash, requester)`, and only then derives and returns the per-track key (`services/api/src/routes/keys.ts`).
- Purposes: `individual` and `room_host` only. `room_listener` is rejected at the schema boundary; room listeners receive the WebRTC stream, never keys.
- Denials answer 200 with the preview-mode response model (`access: denied`, `previewRatio: 0.42`, reason code, host CTA). Unauthorized room hosts are not hard-failed.
- Frontend: `web/src/services/keyService.ts` (nonce + sign + key request), wired into `useCatalog`. Delivered keys are cached per session, one wallet signature per track per session. Publish flow now sends RAW audio to `/api/uploads/audio` when the backend is configured; the backend encrypts server-side, so the production content key never exists in the browser at publish time.
- Tests: `services/api` `npm test` covers signature verification, replay rejection, purpose handling, denial semantics, and fail-closed RPC behavior.

### Decisions that deviate from the ticket text

1. **Key derivation**: `HKDF-SHA256(masterSecret, salt=empty, info='dotify-content-key-v1:<contentHash>')`, centralized in `services/api/src/services/keyVault.ts`. The ticket suggested `info='dotify-track-key-v1'`; the implemented label matches what the already-shipped upload encryption path (Ticket 02) uses, so previously pinned testnet content stays decryptable and the two paths cannot diverge.
2. **No publish-key endpoint**: artists never receive the production key. Raw audio is encrypted server-side at upload. This is a smaller attack surface than publish-time key delivery.
3. **EIP-191 over EIP-712**: structured, domain-bound personal_sign message (app, action, purpose, contentHash, requester, chainId, nonce, expiry). EIP-712 can replace it without changing the route contract.

### Documented boundaries (do not oversell)

- This protects distribution access, not analog capture. An authorized listener can record what they can play.
- Keys are deterministic per track; "temporary" applies to the grant. Rotating `CONTENT_KEY_MASTER_SECRET` re-keys everything at once.
- The nonce store is in-memory: restarts invalidate outstanding nonces (clients re-request), and horizontal scaling needs a shared store. Both fail closed.
- `musicAccCanAccess` lives behind an artist-upgradeable runtime. The backend answers "does the artist's current policy allow this listener", nothing stronger. That is artist sovereignty, stated plainly.
- **42% preview gap for server-keyed tracks**: tracks encrypted with the server-side key cannot be previewed by unauthorized listeners (the browser has no key to slice 42% from). Demo-mode tracks keep the old preview behavior. Restoring previews for production tracks requires publishing a separate preview asset at publish time - tracked in `18-production-preview-assets.md`.
