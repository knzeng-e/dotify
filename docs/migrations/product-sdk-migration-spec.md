# Dotify Product SDK Migration Spec

Date: 2026-06-19

Status: draft for external technical review

Primary audience:

- Parity engineers reviewing whether Dotify's intended Product SDK usage is aligned with the current Polkadot Apps, Product SDK, dot.li, Desktop, Bulletin, DotNS, Statement Store, and contract tooling direction.
- Dotify maintainers planning a full Product SDK migration.

Document type: architecture explanation and migration reference.

## Review Goal

This document describes how Dotify should migrate from its current browser DApp architecture to a Polkadot Product architecture based on `@parity/product-sdk-*`.

The spec is intentionally detailed enough for a reviewer who has not seen Dotify before. It includes:

- what Dotify is trying to preserve at product level;
- the current application architecture and security boundaries;
- the Parity repositories and APIs considered during research;
- a migration decision matrix;
- target architecture;
- backend, contract, storage, signing, room, and testing changes;
- questions that need explicit review from Parity engineers.

No implementation has been done as part of this spec.

## Executive Summary

Dotify is a decentralized cultural social hub for real-time shared listening. It is not intended to be "Spotify plus a wallet." Its differentiator is the combination of:

1. low-friction shared listening rooms;
2. artist-owned SmartRuntime contracts;
3. rights-aware access policy;
4. protected source-file/key delivery;
5. human-centered discovery;
6. future Proof of Personhood based "Human free" access.

The current application is a static React/Vite frontend with:

- EVM wallet/passkey identity;
- `viem` contract interactions against Paseo Asset Hub EVM/pallet-revive;
- a Node backend for Pinata uploads, server-side audio encryption, nonces, replay protection, and content-key delivery;
- Socket.IO signaling for room discovery and SDP/ICE;
- WebRTC host-to-listener media;
- optional direct Bulletin Chain archival uploads through `@polkadot-apps/*` and `polkadot-api@1.x`.

The desired Product SDK redesign should make a `.dot` Product mode first-class:

- use a Host-derived Product Account as the primary `.dot` app identity;
- route chain access, signing, storage, contracts, local storage, and possibly statement messaging through Product SDK and Host APIs;
- keep room guests able to join without wallet/signature friction;
- keep protected source-file keys out of the frontend;
- keep access checks fail-closed;
- keep backend-held content-key custody until a separate artist-operated key model is designed.

The central architectural risk is identity mismatch: Dotify currently treats an EVM H160 account as canonical. Product SDK uses Host-derived Product Accounts and exposes Polkadot signing. Dotify's contracts and backend access checks currently expect EVM addresses and EIP-191 signatures. The migration must define exactly how Product Accounts map to H160 contract callers and backend-verifiable signatures.

## Product Invariants That Must Not Regress

These are non-negotiable product rules from Dotify's current production spine.

### Room Guests

Room guests must be able to join through a shared link or QR code without wallet/signature friction.

Room guests:

- do not need to connect a wallet merely to listen;
- do not request content keys;
- do not receive encrypted source files;
- receive only the host's ephemeral WebRTC media stream;
- can still hear and record that media outside Dotify, which must be documented honestly.

### Room Hosts

Protected room playback is host-access based.

- If the host is authorized for a protected track, the backend may release a temporary content key to the host only.
- If the host is unauthorized, the room should remain alive and play preview mode with a host-facing unlock/personhood action.
- There must never be a `room_listener` content-key request purpose.

### Audio Protection

Dotify protects distribution access to encrypted source files and content keys. It does not claim full DRM.

Production mode must not:

- bundle production content keys or master secrets into frontend code;
- expose unrestricted Pinata credentials in Vite variables;
- trust frontend-provided access booleans;
- silently use dev/fallback signers in public flows.

### Artist Sovereignty

The active contract direction is artist-owned SmartRuntime:

- one runtime per artist;
- artist runtime creation;
- track registration;
- Classic payment unlock;
- royalty distribution;
- personhood-gated access;
- NFT transfer gating;
- runtime isolation between artists.

The migration should not collapse Dotify back into a monolithic platform registry.

## Current Dotify Architecture

### Repository Layout

Relevant paths:

| Path | Current role |
| --- | --- |
| `web/` | React/Vite app, Socket.IO signaling server, Bulletin deploy script |
| `web/src/App.tsx` | Main app composition and still too much workflow logic |
| `web/src/hooks/useWallet.ts` | Passkey/EVM extension wallet model |
| `web/src/hooks/useArtistConsole.ts` | Artist runtime creation, upload, registration, royalty reads |
| `web/src/hooks/useSession.ts` | Socket.IO room signaling plus WebRTC peer setup |
| `web/src/hooks/useBulletin.ts` | Optional Bulletin Chain uploads using `@polkadot-apps/*` |
| `web/src/services/keyService.ts` | EIP-191 signed key requests to backend |
| `web/src/services/pinata.ts` | Backend uploads in production, browser Pinata in demo/local |
| `web/src/config/contracts.ts` | Hand-maintained viem ABIs and EVM clients |
| `services/api/` | Backend API for upload, encryption, nonce, key delivery |
| `contracts/evm/` | Hardhat/Solidity SmartRuntime contracts |
| `docs/backlog/` | Production spine and stabilization tickets |

### Current Frontend Dependencies

`web/package.json` currently includes:

- `@polkadot-apps/chain-client`
- `@polkadot-apps/descriptors`
- `@polkadot-apps/keys`
- `@polkadot-apps/signer`
- `@polkadot-apps/utils`
- `polkadot-api@^1.23.3`
- `viem`
- `socket.io-client`
- `pinata`
- React 18 and Vite 6

The lockfile includes `@polkadot-api/json-rpc-provider@0.0.4` through the current stack. Parity's Product SDK migration notes call this out as a known legacy pattern to review during PAPI 2 migration.

### Current Wallet Model

Dotify currently treats an EVM address as canonical.

There are two wallet paths:

1. Passkey path:
   - WebAuthn PRF derives a local secret.
   - `@polkadot-apps/keys` derives a Substrate account and an EVM private key.
   - The EVM account becomes the app identity.
   - The Substrate signer is only used for optional Bulletin archival uploads.

2. Extension path:
   - `window.ethereum` through EIP-1193.
   - `viem` wallet client signs EVM transactions and EIP-191 messages.

This model conflicts with the Product SDK model, where the Host derives a Product Account scoped to the `.dot` Product identifier and signing routes through the Polkadot Host/phone flow.

### Current Key Request Model

The backend exposes:

```txt
POST /api/auth/nonce
POST /api/tracks/:contentHash/key-request
```

The frontend signs an EIP-191 message with `viem`.

The signed payload binds:

- app: `Dotify`;
- action: `REQUEST_CONTENT_KEY`;
- purpose: `individual` or `room_host`;
- content hash;
- requester EVM address;
- chain ID;
- nonce;
- expiry.

The backend:

- verifies signature;
- consumes nonce;
- resolves artist runtime;
- calls `musicAccCanAccess(contentHash, requester)`;
- derives and returns the content key only on allow;
- returns preview-mode denial otherwise.

This model must be extended or replaced for Product Account signatures.

### Current Storage Model

Production:

- raw audio uploads go to the backend;
- backend encrypts server-side;
- backend pins encrypted audio, cover, and metadata via Pinata;
- frontend reads via IPFS gateway fallback;
- content keys are requested later through the backend.

Demo/local:

- frontend can upload directly to Pinata with `VITE_PINATA_JWT`;
- this is explicitly not production-safe.

Optional archival:

- browser uploads an advanced JSON manifest to Paseo Bulletin Chain with a Substrate signer.

### Current Room Model

Dotify uses:

- Socket.IO for room metadata, room discovery, host heartbeat, and WebRTC SDP/ICE exchange;
- WebRTC for actual host-to-listener audio media;
- TURN config for production reliability.

The signaling server does not carry audio.

Room join links use hash routing:

```txt
#/rooms/<roomId>
```

This is intentional for static hosting and Bulletin/IPFS-style deployment.

## External Inputs Reviewed

The following repositories and docs were considered for this spec.

### Polkadot Apps Documentation

- https://docs.polkadot.com/apps/
- https://docs.polkadot.com/apps/build/
- https://docs.polkadot.com/apps/deploy-your-app/
- https://docs.polkadot.com/reference/apps/hosts/polkadot-web/
- https://docs.polkadot.com/reference/apps/hosts/polkadot-desktop/permissions/
- https://docs.polkadot.com/reference/apps/infrastructure/dotns/
- https://docs.polkadot.com/reference/apps/infrastructure/dotns/name-mechanism/

Relevant conclusions:

- Products are sandboxed single-page apps addressed by `.dot` names.
- The Host mediates identity, signing, chain access, storage, and permissions.
- The user should sign through their phone; the app should not hold private keys.
- Static bundles are uploaded and resolved through Bulletin/DotNS infrastructure.
- Network/microphone/chain capabilities must be handled through Host permission expectations.

### Parity Repositories

| Repository | Why it matters |
| --- | --- |
| https://github.com/paritytech/product-sdk | Preferred `@parity/product-sdk-*` package family and migration guidance |
| https://github.com/paritytech/truapi | Low-level protocol between Product webviews and Polkadot Hosts |
| https://github.com/paritytech/playground-app-template | Minimal Product Account signing template |
| https://github.com/paritytech/playground-cli | `.dot` build/deploy/mod CLI |
| https://github.com/paritytech/polkadot-apps | Older package family currently used by Dotify |
| https://github.com/paritytech/dotli-community | Browser Host behavior, sandbox checker, `.dot` resolution, bridge |
| https://github.com/paritytech/polkadot-desktop-community | Desktop Host behavior, permissions, phone signing |
| https://github.com/paritytech/host-api-test-sdk | Host API E2E test harness |
| https://github.com/paritytech/polkadot-bulletin-chain | Storage chain behavior, retention, chunking, IPFS access |
| https://github.com/paritytech/statement-store-tools | Statement Store allowance and latency context |
| https://github.com/paritytech/dotns | DotNS contracts and naming rules |
| https://github.com/paritytech/dotns-sdk | DotNS parsing, ABI, network, CLI, shared client tooling |
| https://github.com/paritytech/contract-dependency-manager | CDM contract lifecycle and typed Product SDK contract consumption |
| https://github.com/paritytech/hardhat-polkadot | Solidity/Hardhat path closest to current Dotify contracts |
| https://github.com/paritytech/foundry-polkadot | Alternative Solidity workflow for Polkadot |
| https://github.com/paritytech/revive | Solidity to PolkaVM compiler and semantic differences |
| https://github.com/paritytech/cargo-pvm-contract | Rust PVM contract toolchain |

Important caveat: many of these repos explicitly describe themselves as prototype, reference, proof-of-concept, experimental, or unaudited. Dotify should isolate Product SDK usage behind local adapters so upstream churn does not spread through the entire app.

## Target Architecture

Dotify should become a dual-mode frontend for at least one transition period.

### Mode A: Product Mode

Used when the app runs inside a Polkadot Host such as dot.li or Polkadot Desktop.

Characteristics:

- Product Account identity;
- Host-routed signing;
- Host-routed chain access where supported;
- Product SDK local storage;
- Product SDK contract wrappers;
- Product SDK cloud storage where appropriate;
- Host permission handling;
- no direct browser wallet dependency for the primary `.dot` path.

### Mode B: Standalone Web Mode

Used during transition and local development outside a Host.

Characteristics:

- current EVM extension/passkey flows may remain temporarily;
- backend API remains available;
- Socket.IO signaling remains available;
- Vite local development remains possible;
- useful for CI and compatibility while Product mode matures.

The migration should make this split explicit. It should not let Product-specific assumptions leak into standalone behavior, and it should not let browser-wallet assumptions leak into Product mode.

## Proposed Frontend Module Boundary

The migration should start by adding a Product boundary layer rather than changing every feature directly.

Proposed structure:

```txt
web/src/features/product/
  productEnvironment.ts
  productAccount.ts
  productSigner.ts
  productChain.ts
  productContracts.ts
  productStorage.ts
  productKeyRequests.ts
  productPermissions.ts
  productErrors.ts

web/src/features/wallet/
  legacyEvmWallet.ts
  walletMode.ts

web/src/features/access/
  keyRequestClient.ts
  accessPolicy.ts

web/src/features/runtime/
  runtimeContracts.ts
  runtimeReads.ts
  runtimeWrites.ts

web/src/features/uploads/
  uploadClient.ts
  cloudStorageClient.ts
  backendUploadClient.ts

web/src/features/rooms/
  roomTransport.ts
  socketRoomTransport.ts
  statementRoomTransport.ts
  webrtcPeers.ts
```

The existing `App.tsx` should become an app shell over these modules.

## Product SDK Package Targets

Replace current `@polkadot-apps/*` usage with `@parity/product-sdk-*` packages.

Initial target packages:

| Need | Target package |
| --- | --- |
| Chain access | `@parity/product-sdk-chain-client` |
| Chain descriptors | `@parity/product-sdk-descriptors` |
| Signing/Product Account | `@parity/product-sdk-signer` |
| Transactions | `@parity/product-sdk-tx` |
| Contracts | `@parity/product-sdk-contracts` |
| Cloud/Bulletin storage | `@parity/product-sdk-cloud-storage` |
| Product local storage | `@parity/product-sdk-local-storage` |
| Address conversion | `@parity/product-sdk-address` |
| Crypto primitives | `@parity/product-sdk-crypto` |
| Byte/hash utilities | `@parity/product-sdk-utils` |
| Statement Store | `@parity/product-sdk-statement-store` |
| Host helpers | `@parity/product-sdk-host` |
| Logging | `@parity/product-sdk-logger` |

PAPI should be migrated to 2.x in the same dependency track.

## Migration Decision Matrix

| # | Area | Status | Target pattern | Dotify notes |
| --- | --- | --- | --- | --- |
| 1 | Bootstrap | Yes | Product adapter initialized once, feature modules consume adapters | Do not place Product SDK logic directly in UI components |
| 2 | Chain access | Yes | Product SDK chain client, Host provider when inside container, direct fallback only in standalone mode | Current forced EVM RPC in `network.ts` must be removed or scoped |
| 3 | Wallet/signer | Yes | `SignerManager` + Product Account in Product mode | Biggest identity migration; current EVM/passkey model becomes fallback |
| 4 | Crypto primitives | Yes, careful | Product SDK crypto/utils for new code | Do not silently change existing encrypted-track derivation semantics |
| 5 | Utils | Yes | Product SDK utils for bytes/hash/formatting | Replace `@polkadot-apps/utils` |
| 6 | Key management | Deferred/partial | Product Account signatures for access; avoid local passkey key derivation in Product mode | Existing passkey-derived EVM identity should not be the `.dot` canonical path |
| 7 | Address utilities | Yes | Product SDK address helpers | Need exact SS58/H160 mapping reviewed |
| 8 | App storage | Yes | Product SDK local storage in Product mode | Direct `localStorage` should be wrapped and scoped |
| 9 | Cloud storage | Yes, phased | Backend remains for production key custody; Product SDK Cloud Storage for metadata/cover/Bulletin experiments | Product SDK cloud reads are container-only; standalone fallback must remain explicit |
| 10 | Contracts | Yes | Product SDK contracts + CDM-generated metadata where feasible | Need account mapping and H160 origin clarity for pallet-revive |
| 11 | Logger | Optional | Product SDK logger or Dotify wrapper | Useful but not migration-critical |
| 12 | Statement Store | Optional/deferred | Presence, small room metadata, future chat/reactions | Not a trivial Socket.IO replacement because SDP/ICE can exceed small statement limits |
| 13 | Identity/DotNS | Optional | DotNS SDK/Product SDK identity helpers for resolving names | Needed if Dotify resolves other `.dot` names or profiles |
| 14 | PAPI 2.x/descriptors | Yes | Upgrade PAPI and descriptors with Product SDK-compatible versions | Lockfile currently resolves PAPI 1.x stack and legacy json-rpc provider |
| 15 | Dependencies/overrides | Yes | Remove `@polkadot-apps/*`, add `@parity/product-sdk-*`, align host-api versions | Pin carefully; many packages are pre-1.0 |

## Flow-Level Target Design

### 1. Product Account Connection

Product mode should derive a Dotify Product Account from the Host.

Proposed product identifier:

```txt
dotify.dot
```

Local development should allow explicit override:

```txt
VITE_PRODUCT_ACCOUNT_ID=localhost:5273
```

Expected behavior:

- app detects whether it is inside a Product Host;
- Product mode calls `SignerManager.connect("host")`;
- app requests a Product Account for `dotify.dot` and derivation index `0`;
- user approval happens through the Host/phone flow;
- no browser extension or passkey private key is required for Product mode.

Open review need:

- confirm canonical product identifier for `dotify.dot.li` deployments;
- confirm whether Product Account should be app-global (`dotify.dot/0`) or role-specific derivations (`artist`, `listener`, `host`);
- confirm how Product Account H160 should be represented for pallet-revive contract calls.

### 2. Artist Onboarding and Runtime Creation

Current flow:

- artist connects EVM wallet;
- app reads `ArtistDirectory.runtimeOf(artistAddress)`;
- if missing, artist calls `ArtistRuntimeFactory.createRuntime()`;
- artist uploads assets;
- artist calls runtime `musicRegRegister(...)`.

Product target:

- artist connects Product Account;
- app obtains Product Account SS58 and H160-compatible address;
- app ensures Product Account is mapped if pallet-revive requires it;
- app reads/writes contracts through Product SDK contracts;
- transaction signing routes through Host/phone;
- upload path remains backend-mediated for protected audio unless storage/key custody is redesigned.

Key design question:

- Should the artist's runtime owner become the Product Account H160 address?
- If yes, Dotify's current artist identity changes from browser EVM wallet to Product Account.
- If no, Dotify needs an account-linking model between Product Account and existing EVM artist address.

Recommendation:

- For `.dot` Product mode, prefer Product Account as canonical going forward.
- Treat existing EVM-address runtimes as legacy/standalone until migration tooling exists.
- Do not attempt automatic ownership migration without an explicit artist-signed transfer flow.

### 3. Listener Classic Unlock

Current flow:

- listener signs/uses EVM wallet;
- Classic payment calls `musicRoyPayAccess(contentHash)`;
- backend later checks `musicAccCanAccess(contentHash, requester)`;
- backend releases content key if allowed.

Product target:

- listener uses Product Account;
- Classic payment signs through Host/phone;
- backend key request is signed by Product Account;
- backend maps/verifies the Product Account identity and checks runtime access.

Required backend change:

```ts
type KeySignatureScheme =
  | "eip191-evm"
  | "product-account-sr25519";
```

The key request body should include enough information to verify Product Account signatures:

```ts
type ProductAccountKeyRequest = {
  scheme: "product-account-sr25519";
  productId: "dotify.dot";
  derivationIndex: number;
  requesterSs58: string;
  requesterH160?: `0x${string}`;
  signature: `0x${string}`;
  nonce: string;
  chainId: number;
  expiresAt: string;
  purpose: "individual" | "room_host";
};
```

Open review need:

- exact signature primitive exposed by Product SDK for raw message signing;
- recommended anti-phishing envelope/message format;
- backend verification library and canonical payload bytes;
- whether request should bind genesis hash in addition to EVM chain ID.

### 4. Room Hosting

Current flow:

- host creates Socket.IO room;
- host streams audio over WebRTC;
- protected track content key is requested by host only;
- guests join by link without wallet.

Product target:

- host may use Product Account for protected-track key request;
- guests still join without any account requirement;
- room transport remains explicitly separate from key delivery;
- Host permissions for microphone/media and external network must be handled.

Recommendation:

- Phase 1 keeps Socket.IO signaling and WebRTC media.
- Product mode declares/requests any required external network and media capabilities.
- Phase 2 evaluates Statement Store for room presence, room listing, and lightweight messages.
- Do not replace all signaling with Statement Store until SDP/ICE payload size, latency, TTL, retry, and mobile-host behavior are proven.

Open review need:

- whether `RTCPeerConnection` is allowed inside dot.li/Desktop Product sandbox;
- whether STUN/TURN endpoints require declared `ExternalRequest` permission;
- whether Socket.IO WebSocket endpoints are allowed through `ExternalRequest`;
- whether microphone/audio capture is available through the current Product permission model.

### 5. Room Guests

Product mode must not accidentally make guest join dependent on Product Account connection.

Required UX rule:

- Opening `#/rooms/<roomId>` should show the listener room experience first.
- If the guest has no Product Account connected, the guest can still receive the WebRTC stream.
- Any Product Account prompt must be optional and clearly unrelated to simply listening as a room guest.

Test requirement:

- Host Product mode creates protected room.
- Guest Product mode opens join link.
- Guest is not asked to connect/sign.
- Guest never calls backend key request route.

### 6. Upload and Storage

Current production upload is backend-mediated. That should remain true for protected audio until a separate key-custody redesign exists.

Three storage options:

#### Option A: Keep Backend + Pinata For Production

Pros:

- smallest security change;
- existing key custody remains server-side;
- existing backend tests remain meaningful;
- supports standalone and Product modes.

Cons:

- less `.dot` native;
- depends on external API permissions;
- Pinata remains operational infrastructure.

#### Option B: Backend Uploads Encrypted Assets To Bulletin

Pros:

- moves stored encrypted assets closer to Polkadot infrastructure;
- keeps production content keys out of frontend;
- avoids artist browser holding raw encryption key.

Cons:

- backend needs Bulletin upload authorization/tooling;
- retention and renewal model must be understood;
- reads need Product Host path or gateway fallback.

#### Option C: Product Uploads Through Product SDK Cloud Storage

Pros:

- more Product-native;
- artist signs storage operations through Host;
- content-addressed on Bulletin.

Cons:

- raw/protected audio encryption must be redesigned so frontend does not become key custodian again;
- Product SDK cloud reads are container-only according to current SDK notes, so standalone fallback is still needed;
- upload authorization and large-file behavior need product testing.

Recommendation:

- Phase 1: keep Option A.
- Phase 2: move metadata and cover images to Product SDK Cloud Storage where possible.
- Phase 3: evaluate Option B for encrypted audio.
- Do not use Option C for protected production audio until the key-custody model is explicitly redesigned and reviewed.

### 7. Catalog Reads

Current catalog reads:

- seed catalog;
- runtime enumeration through `ArtistDirectory`;
- IPFS gateway fetches for metadata;
- Pinata list for demo/local catalog.

Product target:

- contract reads through Product SDK chain/contracts;
- metadata reads through Product SDK Cloud Storage when content is Bulletin-hosted and app runs in Host;
- gateway fallback remains explicit for standalone mode and existing IPFS CIDs.

Catalog must tolerate mixed historical content:

- Pinata CIDs;
- Bulletin CIDs;
- demo/local refs;
- server-keyed encrypted audio refs;
- potential future Product Cloud Storage refs.

### 8. Contracts and ABIs

Current frontend ABIs are hand-maintained in `web/src/config/contracts.ts`.

Product migration should align with existing backlog ticket 09:

- generate ABIs from `contracts/evm` artifacts;
- move generated bindings under `web/src/generated/contracts/` or CDM-managed equivalent;
- avoid stale copied ABIs;
- add CI check for drift.

Two contract tooling routes should be compared.

#### Route A: Keep Hardhat/Solidity, Add Generated ABIs, Consume With Product SDK Contracts

Pros:

- lowest change to existing contracts;
- aligns with current `contracts/evm` project;
- `hardhat-polkadot` is the closest Parity tooling match.

Cons:

- may not get CDM package registry benefits initially;
- still need Product SDK contract wrapper integration.

#### Route B: Adopt CDM For Contract Deployment/Metadata

Pros:

- CDM produces `cdm.json` and typed Product SDK contract handles;
- aligns with Product SDK contract documentation;
- better long-term dependency metadata and contract registry flow.

Cons:

- larger contract workflow migration;
- may require restructuring existing contracts and deployment assumptions;
- needs clear fit with artist-owned runtime/factory pattern.

Recommendation:

- Phase 1: Route A, generated ABIs, Product SDK contract wrappers.
- Phase 2: evaluate CDM for new contract packages or a future runtime version.

Open review need:

- Product SDK contract support for current Solidity/pallet-revive ABI patterns;
- account mapping requirements for Product Account H160 callers;
- recommended way to call existing `musicRoyPayAccess` payable functions from Product SDK contracts;
- semantic differences from EVM that could affect current SmartRuntime code.

## Backend API Migration

The backend remains necessary for production key delivery.

### Existing API To Preserve

```txt
POST /api/auth/nonce
POST /api/tracks/:contentHash/key-request
```

Existing `eip191-evm` requests must remain during transition.

### New Product Account Signature Scheme

Add a parallel verification path.

Proposed route behavior:

1. issue nonce for account identity and signature scheme;
2. Product Account signs canonical payload;
3. backend verifies signature;
4. backend maps Product Account to contract access address;
5. backend calls `musicAccCanAccess(contentHash, requesterH160)`;
6. backend releases key only if allowed.

The canonical payload should bind:

- app: `Dotify`;
- product ID: `dotify.dot`;
- action: `REQUEST_CONTENT_KEY`;
- purpose: `individual` or `room_host`;
- content hash;
- requester Product Account;
- requester contract/H160 identity if applicable;
- chain ID or genesis hash;
- nonce;
- expiry.

Product mode must not remove nonce/replay protection.

### Backend Verification Open Questions

Need Parity review on:

- canonical raw signing method for Product Account;
- signature bytes and payload construction;
- recommended backend verification package;
- whether Product Account public key can be independently derived from parent public key and product ID for verification, or whether Host returns enough account metadata;
- whether H160 conversion should be verified from SS58 public key server-side;
- how to bind Product Account to existing `musicAccCanAccess` EVM address safely.

## Permissions and Sandbox Requirements

Dotify Product mode may need these capabilities:

| Capability | Why |
| --- | --- |
| ChainSubmit | Artist runtime creation, track registration, Classic unlock, optional storage tx |
| Microphone/media capture | WebRTC room hosting may need captured local audio stream |
| ExternalRequest to Dotify API | backend uploads and key delivery |
| ExternalRequest to signaling server | Socket.IO room signaling |
| ExternalRequest to TURN/STUN | WebRTC NAT traversal |
| ExternalRequest to IPFS gateways | fallback reads for legacy CIDs |
| Local storage | user preferences, local cache, artist display names |

Open review need:

- exact Product manifest shape for these permissions;
- whether WebRTC is available and permissioned separately from ordinary network requests;
- whether `captureStream()` from an audio element is allowed in Host containers;
- expected Origin header/CORS behavior for Product iframes under dot.li;
- whether dot.li app subdomains and sandbox origins require special CORS handling.

## Statement Store Assessment

Statement Store is attractive for Dotify rooms because it is Polkadot-native and fits the social presence direction.

However, current Product SDK notes identify a small statement payload limit. Dotify's WebRTC signaling carries SDP and ICE candidate payloads that can exceed small statement sizes and have strict timing/retry expectations.

Recommended use:

- room presence;
- room discovery metadata;
- "host is live" heartbeat;
- small reactions/chat;
- future ambassador/social propagation events.

Not recommended as first migration target:

- full replacement for SDP/ICE signaling.

Before replacing Socket.IO, build a spike that measures:

- SDP payload sizes across Chrome/Safari/Firefox;
- ICE candidate volume;
- statement latency;
- mobile Host behavior;
- failure recovery;
- TTL/cleanup semantics;
- privacy of room metadata.

## Product Mode Data Model Changes

The current track manifest includes EVM-oriented settlement metadata:

```ts
settlement: {
  target: "evm";
  royaltyBps: number;
  pricePlanck: string;
}
```

For Product mode, avoid changing historical manifests immediately.

Add optional fields only when necessary:

```ts
product?: {
  productId: "dotify.dot";
  storage?: "pinata" | "bulletin" | "product-cloud-storage";
  publisherAccount?: {
    ss58: string;
    h160?: `0x${string}`;
  };
}
```

Do not require all historical manifests to include Product metadata.

## Dependency Migration Plan

High-level package change for `web/package.json`:

Remove over time:

- `@polkadot-apps/chain-client`
- `@polkadot-apps/descriptors`
- `@polkadot-apps/keys`
- `@polkadot-apps/signer`
- `@polkadot-apps/utils`
- direct PAPI 1.x descriptors

Add:

- `@parity/product-sdk-chain-client`
- `@parity/product-sdk-descriptors`
- `@parity/product-sdk-signer`
- `@parity/product-sdk-tx`
- `@parity/product-sdk-contracts`
- `@parity/product-sdk-cloud-storage`
- `@parity/product-sdk-local-storage`
- `@parity/product-sdk-address`
- `@parity/product-sdk-crypto`
- `@parity/product-sdk-utils`
- `@parity/product-sdk-host`
- `@parity/product-sdk-statement-store` when room/presence spike begins
- `polkadot-api@^2.x`

Because the packages are pre-1.0 and Host API compatibility matters, avoid broad `latest` ranges in production branches. Use pinned versions and document why.

## Implementation Phases

### Phase 0: Review and Decision Lock

Deliverables:

- this spec reviewed by Dotify and Parity engineers;
- Product Account identity decision;
- contract H160 mapping decision;
- backend signature scheme decision;
- WebRTC/sandbox feasibility decision.

Exit criteria:

- no unresolved blocker around Product Account -> contract caller mapping;
- no unresolved blocker around room host/guest behavior inside dot.li/Desktop.

### Phase 1: Adapter Boundary Without Behavior Change

Deliverables:

- feature-module scaffolding;
- `productEnvironment` detection;
- storage wrapper around local storage;
- no user-facing behavior change;
- tests around mode detection and storage wrapper.

Exit criteria:

- current web app still works;
- Product SDK packages can be installed without breaking build;
- no Product SDK calls in presentational components.

### Phase 2: Product Account Read-Only Mode

Deliverables:

- connect Product Account inside Host;
- display Product Account identity;
- read chain/catalog through Product SDK where possible;
- keep writes on legacy path until contract mapping is verified.

Exit criteria:

- app loads inside dot.li/Desktop;
- Product Account connection succeeds;
- read-only catalog behavior works or fails with clear errors.

### Phase 3: Backend Product Signature Support

Deliverables:

- backend nonce route supports Product Account scheme;
- backend verifies Product Account signatures;
- frontend key request client supports both EIP-191 and Product Account schemes;
- tests cover replay, bad signature, wrong product ID, wrong purpose, expired nonce.

Exit criteria:

- Product Account can request content key only after contract access check;
- room listeners still never request keys.

### Phase 4: Product SDK Contracts For Writes

Deliverables:

- generated ABI or CDM contract metadata;
- artist runtime creation through Product Account;
- Classic unlock through Product Account;
- track registration through Product Account;
- contract error mapping.

Exit criteria:

- artist publish and Classic unlock work inside Host;
- no hidden dev signer in Product mode.

### Phase 5: Storage Migration

Deliverables:

- backend upload remains production path;
- Product Cloud Storage spike for cover/metadata;
- optional Bulletin encrypted-audio path evaluated;
- historical Pinata/IPFS content still readable.

Exit criteria:

- no regression in protected audio key boundary;
- Product mode can read mixed storage refs.

### Phase 6: Rooms In Product Host

Deliverables:

- Product mode can create rooms;
- Product mode can join rooms by link without guest account prompt;
- permissions/CORS/TURN handling documented;
- optional Statement Store spike for room presence.

Exit criteria:

- host and guest room E2E works inside test Host;
- guest receives no key requests;
- host preview/full mode still works.

### Phase 7: Remove Legacy Paths Where Safe

Deliverables:

- remove `@polkadot-apps/*`;
- remove PAPI 1.x descriptors;
- remove browser Pinata demo credentials from public deployment docs;
- archive or isolate legacy EVM wallet mode.

Exit criteria:

- Product mode is the primary documented deployment;
- standalone mode is either supported intentionally or removed.

## Test Strategy

### Unit Tests

Add tests for:

- Product/standalone mode detection;
- Product Account payload canonicalization;
- Product key request body validation;
- room guest no-key invariant;
- storage ref parsing;
- access-state transitions.

### Backend Tests

Extend `services/api` tests for:

- Product Account signature verification;
- wrong product ID rejection;
- wrong derivation index rejection if applicable;
- replay rejection;
- expired nonce rejection;
- access denied preview response;
- `room_listener` schema rejection remains.

### Host E2E Tests

Use `@parity/host-api-test-sdk` for Product mode E2E where possible.

Scenarios:

- Product Account connect;
- account rejection/permission denial;
- Classic unlock;
- artist publish;
- room host creates room;
- room guest joins without signing;
- protected authorized host requests key;
- protected unauthorized host gets preview response;
- guest never calls key route.

### Manual Smoke Tests

Run in:

- dot.li;
- Polkadot Desktop;
- two physical devices or two browser contexts for room media;
- one network with TURN required.

Manual checks:

- phone signing UX;
- permission prompts;
- CORS/origin behavior;
- media capture;
- room QR scanning;
- full vs preview protected playback.

## Security Review Checklist

Before shipping Product mode publicly:

- no production `VITE_PINATA_JWT`;
- no production `VITE_CONTENT_SECRET`;
- backend API origin restricted to actual Product origins;
- signaling origin restricted to actual Product origins;
- Product Account key request payload binds app/product ID;
- nonce is single-use and expires;
- room guests cannot request keys;
- key denial returns preview state, not accidental key material;
- logs never expose content keys, raw audio, JWTs, or signatures beyond what is necessary for debugging;
- Host permission denial produces user-understandable errors;
- fallback standalone mode cannot bypass Product-mode access checks.

## Open Questions For Parity Review

### Product Account and Identity

1. What is the canonical Product Account identifier for a product loaded as `dotify.dot.li` or equivalent dot.li subdomain?
2. Should Dotify use one derivation index for all roles, or separate derivations for artist/listener/host?
3. Does Product SDK expose a canonical H160 for Product Accounts suitable for pallet-revive contracts?
4. How should a backend independently verify that an H160 corresponds to a Product Account public key?
5. Are there recommended account-linking patterns for apps that already have EVM/H160 user state?

### Signing and Backend Verification

6. What raw-message signing API should Product mode use for content-key requests?
7. What canonical message envelope should be used to avoid phishing and replay?
8. Which backend library should verify Product Account signatures?
9. Should key-request payloads bind EVM chain ID, genesis hash, DotNS name, or all of them?
10. Are Product Account raw signatures expected to be stable across dot.li, Desktop, and Mobile Hosts?

### Contracts

11. Is `@parity/product-sdk-contracts` the recommended path for existing Solidity/pallet-revive contracts?
12. Should Dotify adopt CDM immediately, or first consume generated Hardhat ABIs through Product SDK contracts?
13. What is the recommended Product SDK pattern for payable contract calls such as `musicRoyPayAccess`?
14. What explicit `ensureAccountMapped` step is required for Product Account callers?
15. Are there known revive semantic differences that should be reviewed against Dotify's Diamond/SmartRuntime pattern?

### Storage

16. Is Product SDK Cloud Storage appropriate for multi-megabyte encrypted audio assets, or should Dotify keep backend-managed Pinata/Bulletin for audio?
17. Can a backend safely upload to Bulletin on behalf of artists while preserving artist sovereignty, or should storage writes be artist-signed?
18. What is the recommended retention/renewal strategy for music assets on Bulletin?
19. Product SDK cloud reads are currently described as container-only. What is the recommended standalone fallback?

### Rooms, WebRTC, and Network Permissions

20. Are `RTCPeerConnection`, STUN/TURN, and `HTMLMediaElement.captureStream()` expected to work inside dot.li and Desktop Product sandboxes?
21. Are WebSocket endpoints such as Socket.IO allowed with declared `ExternalRequest` permissions?
22. How should a Product manifest declare TURN/STUN, backend API, and signaling endpoints?
23. Is Statement Store intended to support SDP/ICE-sized signaling payloads, or should Dotify limit it to presence/metadata?
24. Are there Host-level constraints for background room hosting or long-lived audio streams?

### Testing and Deployment

25. Is `@parity/host-api-test-sdk` the correct E2E test harness for Product mode?
26. Are there current examples that test Product SDK contracts plus Product Account signing end-to-end?
27. Which Host should Dotify treat as the reference target first: dot.li, Desktop, or both?
28. Which package versions are considered best aligned as of this migration?

## Proposed Review Outcomes

The review should produce explicit decisions for:

- Product Account identity and H160 mapping;
- Product key-request signature scheme;
- contract tooling path: generated Hardhat ABI vs CDM;
- storage path for protected audio;
- whether Socket.IO/WebRTC is acceptable in Product mode;
- whether Statement Store should remain a later room-presence feature;
- target Host for first Product-mode acceptance testing.

## Recommended First Engineering Ticket

After review, the first implementation ticket should be:

```txt
Add Dotify Product mode adapter boundary without changing user behavior
```

Scope:

- add `web/src/features/product/`;
- add Host/Product environment detection;
- add Product Account adapter skeleton;
- wrap local storage access;
- add dependency pins in `package.json`;
- add tests for mode detection and storage;
- do not change artist publish, room, or key request behavior yet.

This creates a safe foundation for the larger migration without disturbing the production spine.

