# 03 — Wallet-signed content-key requests

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Implement production-grade content-key delivery for protected audio.

Full encrypted audio must only be decryptable after a wallet-authenticated access check. The frontend must not contain a global content secret.

## Context
The current prototype derives a deterministic key from a frontend-bundled content secret and the content hash. This is useful for proving the audio protection concept, but it is not a production security boundary.

## Target flow

```txt
1. Listener selects registered track.
2. Frontend asks backend for nonce.
3. Listener signs an EIP-712 or EIP-191 message containing:
   - contentHash
   - listener address
   - nonce
   - chainId
   - expiration timestamp
4. Backend verifies signature.
5. Backend calls the track runtime `musicAccCanAccess(contentHash, listener)`.
6. If access is true, backend releases the per-track content key or wrapped key.
7. Frontend decrypts the encrypted IPFS object locally.
```

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

## Signature requirements

Prefer EIP-712 typed data if wallet support is clean. Otherwise EIP-191 personal sign is acceptable for the first production spine, but the signed payload must be structured and domain-bound.

Payload must include:

```ts
{
  app: 'Dotify',
  action: 'REQUEST_CONTENT_KEY',
  contentHash: `0x${string}`,
  listener: `0x${string}`,
  chainId: 420420417,
  nonce: string,
  expiresAt: string
}
```

## Chain access requirements

- Resolve the artist runtime that owns the track, or use known runtime context from metadata/catalog.
- Call `musicAccCanAccess(contentHash, listener)`.
- Fail closed if RPC is unavailable.
- Fail closed if runtime lookup is ambiguous.
- Never trust frontend-provided access booleans.

## Key custody requirements

For first implementation, derive per-track keys server-side from:

```txt
HKDF(CONTENT_KEY_MASTER_SECRET, contentHash, 'dotify-track-key-v1')
```

This is acceptable for testnet production readiness. Document that future artist-operated key custody may replace this.

## Frontend requirements

- Remove production dependence on `VITE_CONTENT_SECRET`.
- Add key request client.
- Add wallet signing UX.
- Show precise states:
  - wallet required
  - signature required
  - checking access
  - access denied
  - key received
  - decryption failed
- Keep 42% preview behavior for unauthorized listeners.

## Acceptance criteria

- Unauthorized listener cannot decrypt full audio without backend key response.
- Classic paid listener can request key after `musicRoyPayAccess` confirms.
- Human free listener can request key only if `musicAccCanAccess` returns true.
- Signature replay is rejected after nonce use or expiration.
- Frontend bundle no longer contains a production content secret.
- Tests cover signature verification and access-check failure modes.

## Non-goals

- Do not implement full DRM.
- Do not promise that decrypted audio cannot be recorded after playback.
- Do not implement artist-operated key services yet.

## Senior-engineer notes

Be explicit in comments and docs: this protects distribution access, not analog capture. Do not oversell security. A serious product earns trust by naming its boundaries.