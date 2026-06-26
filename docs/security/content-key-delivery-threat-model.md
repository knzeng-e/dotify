# Dotify content-key delivery threat model

## Purpose

This document defines what Dotify's content-key delivery protects, what it does not protect, and which boundaries must be preserved during implementation.

Dotify should be honest: this is protected distribution access, not absolute DRM.

## Assets to protect

- Full encrypted audio source files.
- Per-track content keys.
- Backend master secret or key derivation material.
- Pinata upload credentials.
- Wallet-signature challenge integrity.
- Access-policy correctness.
- Artist runtime trust assumptions.

## Actors

| Actor | Description |
| --- | --- |
| Artist | Publishes protected tracks and defines access policy. |
| Listener | Requests individual playback or joins a room. |
| Host | Streams audio into a room. |
| Room guest | Receives WebRTC stream from host. |
| Backend | Validates signatures, checks runtime access, delivers keys. |
| Attacker | Attempts to obtain source files, keys, or replay access. |

## Trust boundaries

```mermaid
flowchart LR
  Browser[Browser / Frontend] -->|signed request| API[Dotify Backend]
  API -->|read access policy| Runtime[Artist SmartRuntime]
  API -->|fetch/pin refs| IPFS[IPFS / Pinata]
  API -->|temporary key only when allowed| Browser
  Host[Host Browser] -->|WebRTC media stream| Guest[Room Guest]
```

## Core security rules

- Production content keys must never be bundled into the frontend.
- Pinata credentials must not be exposed in Vite frontend variables.
- Backend must verify wallet signatures server-side.
- Signed challenges must include content hash, requester address, purpose, chain ID, nonce, and expiry.
- Nonces must not be replayable.
- Backend must check `musicAccCanAccess` before key release.
- Backend must fail closed on RPC/access ambiguity.
- Room listeners must never receive content keys.
- Room listeners must never receive encrypted source files through the key-delivery path.

## Individual playback threat model

```mermaid
sequenceDiagram
  participant U as Listener
  participant B as Browser
  participant API as Backend
  participant RT as SmartRuntime

  U->>B: Request full individual playback
  B->>API: Nonce request
  API-->>B: Nonce + expiry
  U->>B: Sign challenge
  B->>API: Signature + purpose=individual
  API->>API: Verify signature + nonce
  API->>RT: Check access
  alt allowed
    API-->>B: Temporary content key
  else denied or ambiguous
    API-->>B: Preview-only response
  end
```

### Threats

| Threat | Mitigation |
| --- | --- |
| User extracts frontend bundle | No production key material in bundle. |
| Replay old signature | Nonce and expiry, one-time use. |
| User lies about access | Backend ignores frontend access booleans and reads runtime. |
| RPC unavailable | Fail closed for key release. |
| Leaked temporary key | Keep key scoped to track/session; rotate strategy later. |

## Room playback threat model

```mermaid
sequenceDiagram
  participant H as Host
  participant API as Backend
  participant RT as SmartRuntime
  participant G as Guest

  H->>API: Signed key request purpose=room_host
  API->>RT: Check host access
  alt host allowed
    API-->>H: Temporary content key
    H-->>G: WebRTC full stream
  else host denied
    API-->>H: Preview-mode response
    H-->>G: WebRTC preview stream
  end
```

### Key point

The host may receive a content key if authorized.

Room guests do not receive a key. They receive only the WebRTC media stream.

### Threats

| Threat | Mitigation / boundary |
| --- | --- |
| Guest tries to fetch source file | Guest has no content key and no key request path. |
| Guest records WebRTC stream | Not prevented. This is outside Dotify's distribution-access protection. |
| Unauthorized host tries protected track | Backend returns preview-mode response, no key. |
| Host shares decrypted audio outside Dotify | Not fully preventable once host is authorized. Document boundary. |
| Malicious client claims purpose=room_host for guest | Signature requester is checked; room listeners are not given key-delivery UI/path. |

## Non-DRM statement

Dotify does not promise that audio cannot be recorded after playback.

Dotify protects access to full source files and content keys. It does not prevent analog capture, screen/audio recording, or redistribution by an authorized malicious host.

Do not describe Dotify as perfect DRM.

## Preview asset boundary

Denied access responses may advertise `playbackMode: preview`, but production
tracks encrypted with the backend-held key need a separate preview asset for
the browser to play 42% without receiving the full-track key.

Preview assets are intentionally playable. They protect the full source file by
being incomplete, not by being secret.

## Logging rules

Never log:

- content keys;
- master secrets;
- Pinata JWTs;
- raw audio bytes;
- full signed challenge payloads if they include sensitive session data.

Safe to log:

- content hash;
- request purpose;
- requester address;
- access result;
- reason codes;
- correlation IDs.

## Reason codes

Suggested reason codes:

```ts
type KeyRequestReason =
  | 'ACCESS_ALLOWED'
  | 'LISTENER_ACCESS_REQUIRED'
  | 'HOST_ACCESS_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'PERSONHOOD_REQUIRED'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_SESSION'
  | 'NONCE_REPLAYED'
  | 'RPC_UNAVAILABLE'
  | 'RUNTIME_NOT_FOUND'
  | 'TRACK_NOT_FOUND';
```

## Review checklist

Before merging key-delivery changes, verify:

- frontend bundle has no production key material;
- backend verifies signatures;
- nonce replay is rejected;
- chain access is checked server-side;
- room listener key path does not exist;
- unauthorized host receives preview-mode response;
- server-keyed protected tracks have a preview asset before public production use;
- docs do not claim absolute DRM;
- tests cover denied, allowed, replay, and RPC failure paths.
