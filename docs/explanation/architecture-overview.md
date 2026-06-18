# Architecture Overview

> **Reading level:** This document has two levels.
>
> - The first section is for anyone who wants to understand what Dotify is made of.
> - The [Technical deep-dive](#technical-deep-dive) section is for developers integrating with or contributing to the codebase.

---

## What Dotify is built from

Dotify is a decentralized music streaming platform. When you stream a track, upload a release, or join a listening room, your actions touch several independent systems — none of which are owned by Dotify itself.

Those systems are:

| Layer                   | Technology                        | What it does                                                  |
| ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| **Identity**            | EVM wallet (passkey or extension) | Proves who you are without a password or an account           |
| **Storage**             | IPFS via Pinata                   | Holds audio files, cover images, and track metadata           |
| **Backend API**         | Node.js + Fastify                 | Keeps Pinata credentials and content-key material server-side |
| **On-chain registry**   | Paseo Asset Hub (EVM)             | Records track ownership, access rules, and payments           |
| **Archival**            | Polkadot Bulletin Chain           | Permanent, tamper-proof backup of the rights manifest         |
| **Real-time streaming** | WebRTC + Socket.IO                | Delivers live audio to listening rooms                        |
| **Frontend**            | React SPA                         | The user interface that ties all of the above together        |

These systems are intentionally separate. If any one of them goes down or is replaced, the others keep working. Your music is not locked into Dotify — it lives on open networks.

---

## How a track moves through the system

### Publishing (artist's journey)

```
Artist selects audio file
        │
        ▼
blake2b-256 hash computed      ← content identity, used everywhere
        │
        ▼
AES-256-GCM encryption         ← backend path protects audio before pinning
        │
        ▼
Upload to IPFS via Pinata      ← backend pins encrypted audio; CID stored on-chain
Cover image → IPFS             ← cover CID stored on-chain
        │
        ▼
Rights manifest built          ← JSON: title, artist, CIDs, access mode, royalties
        │
        ├──► Upload to IPFS    ← canonical metadata path
        │
        └──► Upload to Bulletin Chain (optional) ← permanent archival
                │
                ▼
        musicRegRegister() called on SmartRuntime
        ← on-chain track record created
        ← NFT minted, royalty splits registered
        ← access rules enforced from this point forward
```

### Listening (listener's journey)

```
Listener opens Dotify
        │
        ▼
ArtistDirectory queried        ← finds all registered artist runtimes
        │
        ▼
Each runtime's track list fetched ← on-chain catalog
        │
        ▼
Track selected → access checked
        │
        ├── Has access?  ──► Content key requested, full audio decrypted and played
        │
        └── No access?  ──► 42 % preview played, access gate shown
                │
                ├── Pay DOT     → musicRoyPayAccess() → access granted
                └── Prove PoP   → registrar confirms personhood → access granted
```

---

## Technical deep-dive

### Frontend (React SPA)

The frontend lives at `Dotify/web/src/` and is a Vite + React + TypeScript
application. It talks directly to public RPCs and IPFS gateways for reads, and
uses the backend API when `VITE_DOTIFY_API_URL` is configured for server-side
uploads and wallet-signed content-key delivery.

**Key modules:**

```
src/
├── App.tsx                    # Root: composes hooks, routes to views
├── types.ts                   # All shared TypeScript types
├── hooks/
│   ├── useCatalog.ts          # Catalog state, IPFS resolution, access gating
│   ├── useSession.ts          # WebRTC + Socket.IO room management
│   ├── useArtistConsole.ts    # /artists registration, releases, royalties
│   └── useWallet.ts           # Wallet tiers: passkey → EIP-6963 extension
├── views/                     # One file per screen / tab
│   ├── ListenView.tsx
│   ├── PlayerView.tsx
│   ├── RoomsView.tsx
│   └── artist/                # ArtistOnboarding, ArtistConsole + sub-tabs
└── services/
    ├── keyService.ts          # Wallet-signed content-key requests
    └── pinata.ts              # Backend/demo uploads + gateway fallback reads
```

The three custom hooks own all non-UI state and logic. View components are thin — they receive props and render JSX.

### Backend API

The backend API lives in `services/api/`. It is a Node.js 22 + Fastify service
for production boundaries that must not be bundled into the frontend:

- server-side Pinata uploads;
- server-side AES-256-GCM audio encryption;
- nonce issuance and replay protection;
- wallet-signature verification;
- runtime access checks before content-key delivery.

It exposes health, auth nonce, upload, and track key-request routes. It fails
closed when key material, RPC, or access checks are unavailable.

### Smart contracts (EVM)

Every artist owns a personal **SmartRuntime** — a Diamond proxy (ERC-2535) that routes function calls to stateless pallet implementations. This means:

- Pallets are deployed once, shared across all artists.
- Each artist's runtime has its own isolated storage.
- Pallets can be upgraded without redeploying the runtime.

```
ArtistRuntimeFactory
        │
        └──► deploys SmartRuntime per artist
                │
                ├── DiamondCutPallet     (upgrades)
                ├── DiamondLoupePallet   (introspection)
                ├── OwnershipPallet      (runtime owner)
                ├── MusicRegistryPallet  (track CRUD)
                ├── MusicNFTPallet       (ERC-721 ownership)
                ├── MusicRoyaltiesPallet (payments + splits)
                └── MusicAccessPallet   (access checks)

ArtistDirectory
        └──► global index: artist address → runtime address
```

See [contracts-api.md](../reference/contracts-api.md) for full function signatures.

### Bulletin Chain integration

When an artist enables Bulletin archival, the rights manifest (a compact JSON document) is written to the Polkadot Bulletin Chain via the `TransactionStorage` pallet. This creates a content-addressed, immutable record that cannot be deleted or altered — even by Dotify.

The stored CID is included in the on-chain track record as `metadataRef`, allowing any third party to verify the manifest without trusting any central server.

### Signaling server

The signaling server is a lightweight Socket.IO process (`server/signaling.mjs`) whose only job is to relay WebRTC handshake messages between peers. It never touches audio. Once WebRTC negotiation completes, audio flows peer-to-peer (host → listener) with no server involvement.

---

## What Dotify does not own

- Your audio files — they live on IPFS.
- Your identity — it lives in your wallet.
- Your payments — they go directly to your EVM address via smart contract.
- Your track records — they live on Paseo Asset Hub (and optionally Bulletin Chain).

The frontend is itself distributed via IPFS/DotNS at `dotify.dot.li`.
