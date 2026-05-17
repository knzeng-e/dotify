# Dotify technical memory

## Current architecture

Dotify currently uses:

- React + Vite frontend under `web/`;
- Socket.IO signaling server for rooms;
- WebRTC host-to-listener audio transport;
- Pinata/IPFS for audio, cover, and metadata references;
- optional Paseo Bulletin Chain archival publication;
- Paseo Asset Hub EVM contracts;
- artist-owned SmartRuntime model;
- ArtistRuntimeFactory and ArtistDirectory;
- music pallets for registry, NFT ownership, royalties, access, and personhood gating.

## Active product surfaces

### Home / Listen

Catalog browsing, track cards, artwork, description, access badges, player, room-hosting controls.

### Rooms

Room discovery, manual room-code entry, WebRTC join flow, Socket.IO signaling.

### Artist portal

Wallet-gated onboarding, runtime creation, upload, encryption, IPFS publication, metadata, royalty inputs, access mode configuration, on-chain registration.

## Current important limitations

- Browser-side protection is demo-grade.
- `VITE_CONTENT_SECRET` must not remain the production key boundary.
- Pinata uploads from the browser are unsafe for public production.
- Proof of Personhood is currently mocked/dev-operated.
- Listener-side room access is not independently enforced.
- Public rooms require hosted signaling.
- `App.tsx` is still too monolithic.
- Frontend/e2e coverage is missing or insufficient.
- Legacy registry paths should be archived or removed.
- ABI drift risk exists if frontend contract ABIs are manually maintained.

## Production spine

Production readiness means the following must work reliably:

1. Artist connects a real wallet.
2. Artist creates or resolves their SmartRuntime.
3. Artist uploads protected audio through a backend boundary.
4. Artist registers a track on-chain.
5. Listener sees track in catalog.
6. Unauthorized listener receives only preview.
7. Classic listener pays and unlocks.
8. Backend releases the content key only after wallet signature and access check.
9. Host creates room from playable track.
10. Listener joins through simple link.
11. Critical flows are covered by tests.

## Backend direction

Introduce a lean backend service for:

- Pinata uploads;
- content-key custody and delivery;
- wallet signature verification;
- nonce/replay protection;
- access checks against SmartRuntime;
- health and version endpoints;
- future WebAuthn backend support.

The backend should be boring, typed, and auditable.

Recommended baseline:

- Node.js 22;
- TypeScript;
- Fastify or similarly lean framework;
- viem for EVM reads;
- Zod/Valibot for validation;
- structured logs;
- strict env validation.

## Audio protection direction

Do not claim full DRM.

The target is distribution access protection:

```txt
wallet signature -> backend verifies signature -> backend checks runtime access -> backend releases key -> browser decrypts local audio
```

This prevents bundled frontend secrets and direct full-track access by unauthorized listeners. It does not prevent recording after authorized playback.

Document this honestly.

## Room direction

Rooms must become production-stable:

- hosted signaling;
- join links;
- room TTL;
- heartbeat;
- cleanup;
- clear states;
- explicit unsupported-browser behavior;
- simple user language.

Room UX should be benchmarked against Spotify Jam and Jukebox Duo for low friction.

## Contracts direction

The active direction is artist-owned SmartRuntime, not the legacy monolithic registry path.

Maintain and test:

- runtime creation;
- one runtime per artist;
- track registration;
- deactivation;
- Classic payment;
- royalty distribution;
- personhood-gated access;
- NFT transfer gating;
- isolation between artist runtimes;
- safe upgrade/facet mechanics.

Generate frontend ABIs from Hardhat artifacts.

## Frontend direction

Refactor toward feature modules:

```txt
web/src/app/
web/src/features/catalog/
web/src/features/player/
web/src/features/rooms/
web/src/features/artist-studio/
web/src/features/wallet/
web/src/features/access/
web/src/features/runtime/
web/src/features/uploads/
web/src/shared/
```

Keep chain calls out of presentational components.

Keep user-facing blockchain complexity low.

## Testing direction

Add deterministic tests for:

- Classic unlock;
- artist publish;
- room join;
- access-state logic;
- preview/full playback state;
- signature verification;
- key request failure modes;
- upload failure modes;
- chain/RPC unavailable states.

Contracts already have meaningful tests; frontend and e2e must catch up.

## Security principles

- No unrestricted Pinata JWT in frontend.
- No production key material in frontend bundle.
- No dev fallback signer in public flows.
- Access checks must fail closed.
- Backend must not trust frontend-provided access results.
- Wallet signatures must include nonce, chain ID, content hash, listener address, and expiration.
- Replay protection is mandatory for key requests.
- Logs must never expose secrets, keys, or raw uploaded contents.

## Deployment principle

A public testnet MVP should be reproducible.

A fresh contributor should understand:

- how to run web;
- how to run signaling;
- how to run backend;
- how to compile/test contracts;
- which environment variables are needed;
- which flows are local demo only;
- which flows are production-ready.

## Technical mantra

Keep the roots deep, but the fruit easy to reach.